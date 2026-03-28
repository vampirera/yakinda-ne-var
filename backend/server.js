require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const twilio = require('twilio');
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// =============================================================
// IN-MEMORY CACHE
// =============================================================

var _cache = {};
var CACHE_TTL = { esnaflar: 2*60*1000, ilceler: 60*60*1000, esnaf_detay: 5*60*1000 };

function cacheAl(key) {
  var e = _cache[key];
  if (!e) return null;
  if (Date.now() > e.exp) { delete _cache[key]; return null; }
  return e.data;
}
function cacheKaydet(key, data, ttl) {
  _cache[key] = { data: data, exp: Date.now() + ttl };
}
function cacheSil(prefix) {
  Object.keys(_cache).forEach(function(k) { if (k.startsWith(prefix)) delete _cache[k]; });
}

// =============================================================
// OTP STORE
// =============================================================

var _otpStore = {};

function otpOlustur(telefon) {
  var kod = Math.floor(100000 + Math.random() * 900000).toString();
  _otpStore[telefon] = { kod: kod, exp: Date.now() + 10 * 60 * 1000 };
  console.log('[OTP] ' + telefon + ': ' + kod);
  return kod;
}

function otpDogrula(telefon, kod) {
  var kayit = _otpStore[telefon];
  if (!kayit) return false;
  if (Date.now() > kayit.exp) { delete _otpStore[telefon]; return false; }
  if (kayit.kod !== kod) return false;
  delete _otpStore[telefon];
  return true;
}

// =============================================================

function telefonNormalize(telefon) {
  var t = telefon.replace(/\D/g, ''); // sadece rakam
  if (t.startsWith('90') && t.length === 12) return '+' + t;
  if (t.startsWith('0') && t.length === 11) return '+90' + t.slice(1);
  if (t.length === 10) return '+90' + t;
  return '+' + t;
}

function whatsappGonder(telefon, mesaj) {
  if (!telefon || !process.env.TWILIO_WHATSAPP_FROM) return Promise.resolve();
  var normalized = telefonNormalize(telefon);
  var to = normalized.startsWith('whatsapp:') ? normalized : 'whatsapp:' + normalized;
  return twilioClient.messages.create({ from: process.env.TWILIO_WHATSAPP_FROM, to: to, body: mesaj })
    .then(function(m) { console.log('[WhatsApp] Gönderildi:', m.sid); })
    .catch(function(e) { console.log('[WhatsApp] Hata:', e.message); throw e; });
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
const upload = multer({ dest: 'uploads/', limits: { fileSize: 5 * 1024 * 1024 } });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function tablolarOlustur() {
  await pool.query(`CREATE TABLE IF NOT EXISTS esnaflar (id SERIAL PRIMARY KEY, ad VARCHAR(255) NOT NULL, kategori VARCHAR(50) NOT NULL, ilce VARCHAR(100) NOT NULL, adres TEXT, telefon VARCHAR(20), email VARCHAR(255), vergi_no VARCHAR(20), lat DECIMAL(10,6) DEFAULT 36.8550, lng DECIMAL(10,6) DEFAULT 28.2753, puan DECIMAL(3,1) DEFAULT 0, yorum_sayisi INTEGER DEFAULT 0, acik BOOLEAN DEFAULT true, onayli BOOLEAN DEFAULT false, onaylandi BOOLEAN DEFAULT false, kayit_tarihi TIMESTAMP DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS urunler (id SERIAL PRIMARY KEY, esnaf_id INTEGER REFERENCES esnaflar(id), ad VARCHAR(255) NOT NULL, fiyat DECIMAL(10,2) DEFAULT 0, aciklama TEXT, fotograf_url TEXT)`);
  await pool.query(`ALTER TABLE urunler ADD COLUMN IF NOT EXISTS fotograf_url TEXT`);
  await pool.query(`CREATE TABLE IF NOT EXISTS yorumlar (id SERIAL PRIMARY KEY, esnaf_id INTEGER REFERENCES esnaflar(id), kullanici VARCHAR(255), puan INTEGER, yorum TEXT, tarih DATE DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS siparisler (id SERIAL PRIMARY KEY, esnaf_id INTEGER, esnaf_adi VARCHAR(255), musteri_telefon VARCHAR(20), urunler JSONB, teslimat_turu VARCHAR(50), adres TEXT, ara_toplam DECIMAL(10,2), kurye_ucreti DECIMAL(10,2), komisyon DECIMAL(10,2), genel_toplam DECIMAL(10,2), durum VARCHAR(50) DEFAULT 'bekliyor', tarih TIMESTAMP DEFAULT NOW())`);
  await pool.query(`ALTER TABLE siparisler ADD COLUMN IF NOT EXISTS musteri_telefon VARCHAR(20)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS kuryeler (id SERIAL PRIMARY KEY, ad VARCHAR(255) NOT NULL, telefon VARCHAR(20) NOT NULL, arac_tipi VARCHAR(50), ilce VARCHAR(100), onaylandi BOOLEAN DEFAULT false, kayit_tarihi TIMESTAMP DEFAULT NOW())`);
  await pool.query(`ALTER TABLE siparisler ADD COLUMN IF NOT EXISTS kurye_id INTEGER REFERENCES kuryeler(id)`);
  await pool.query(`ALTER TABLE esnaflar ADD COLUMN IF NOT EXISTS calisma_saatleri JSONB`);
  await pool.query(`ALTER TABLE esnaflar ADD COLUMN IF NOT EXISTS sifre VARCHAR(100)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS kullanicilar (id SERIAL PRIMARY KEY, ad VARCHAR(100), telefon VARCHAR(20) UNIQUE NOT NULL, sifre VARCHAR(100) NOT NULL, tip VARCHAR(20) DEFAULT 'musteri', esnaf_id INTEGER REFERENCES esnaflar(id), kurye_id INTEGER REFERENCES kuryeler(id), olusturma TIMESTAMP DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS kampanyalar (id SERIAL PRIMARY KEY, esnaf_id INTEGER REFERENCES esnaflar(id) ON DELETE CASCADE, baslik VARCHAR(255) NOT NULL, aciklama TEXT, indirim_orani INTEGER DEFAULT 0, bitis_tarihi DATE, aktif BOOLEAN DEFAULT true, olusturma_tarihi TIMESTAMP DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS bildirim_tokenler (id SERIAL PRIMARY KEY, token TEXT UNIQUE NOT NULL, kullanici_telefon VARCHAR(20), olusturma TIMESTAMP DEFAULT NOW())`);
  await pool.query(`ALTER TABLE kullanicilar ADD COLUMN IF NOT EXISTS email TEXT`);
  await pool.query(`ALTER TABLE kullanicilar ADD COLUMN IF NOT EXISTS adresler JSONB DEFAULT '[]'`);
  await pool.query(`ALTER TABLE esnaflar ADD COLUMN IF NOT EXISTS goruntuleme_sayisi INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE esnaflar ADD COLUMN IF NOT EXISTS instagram_url TEXT`);
  await pool.query(`ALTER TABLE esnaflar ADD COLUMN IF NOT EXISTS google_maps_url TEXT`);

  // ── RANDEVU SİSTEMİ ────────────────────────────────────────────
  await pool.query(`ALTER TABLE esnaflar ADD COLUMN IF NOT EXISTS randevu_modu BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE esnaflar ADD COLUMN IF NOT EXISTS slot_suresi INTEGER DEFAULT 30`);
  await pool.query(`ALTER TABLE esnaflar ADD COLUMN IF NOT EXISTS indirimli_saatler JSONB DEFAULT '{}'`);
  await pool.query(`ALTER TABLE esnaflar ADD COLUMN IF NOT EXISTS one_cikan BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE esnaflar ADD COLUMN IF NOT EXISTS one_cikan_etiket TEXT`);
  // ── KURYE KONUM TAKİBİ ─────────────────────────────────────────
  await pool.query(`ALTER TABLE kuryeler ADD COLUMN IF NOT EXISTS lat DECIMAL(10,6)`);
  await pool.query(`ALTER TABLE kuryeler ADD COLUMN IF NOT EXISTS lng DECIMAL(10,6)`);
  await pool.query(`ALTER TABLE kuryeler ADD COLUMN IF NOT EXISTS konum_guncelleme TIMESTAMP`);
  await pool.query(`CREATE TABLE IF NOT EXISTS hizmetler (
    id SERIAL PRIMARY KEY,
    esnaf_id INTEGER REFERENCES esnaflar(id) ON DELETE CASCADE,
    ad VARCHAR(255) NOT NULL,
    sure INTEGER DEFAULT 30,
    fiyat DECIMAL(10,2) DEFAULT 0,
    aciklama TEXT,
    aktif BOOLEAN DEFAULT true,
    olusturma TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS randevular (
    id SERIAL PRIMARY KEY,
    esnaf_id INTEGER REFERENCES esnaflar(id) ON DELETE CASCADE,
    musteri_telefon VARCHAR(20),
    musteri_ad VARCHAR(100),
    hizmet_id INTEGER REFERENCES hizmetler(id) ON DELETE SET NULL,
    tarih DATE NOT NULL,
    saat TIME NOT NULL,
    sure INTEGER DEFAULT 30,
    durum VARCHAR(20) DEFAULT 'bekliyor',
    notlar TEXT,
    olusturma TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS bekleme_listesi (
    id SERIAL PRIMARY KEY,
    esnaf_id INTEGER REFERENCES esnaflar(id) ON DELETE CASCADE,
    musteri_telefon VARCHAR(20),
    musteri_ad VARCHAR(100),
    hizmet_id INTEGER REFERENCES hizmetler(id) ON DELETE SET NULL,
    tarih DATE NOT NULL,
    olusturma TIMESTAMP DEFAULT NOW()
  )`);

  var sayac = await pool.query('SELECT COUNT(*) FROM esnaflar');
  if (parseInt(sayac.rows[0].count) === 0) {
    var e1 = await pool.query(`INSERT INTO esnaflar (ad,kategori,ilce,adres,telefon,email,vergi_no,lat,lng,puan,yorum_sayisi,acik,onayli,onaylandi) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`, ['Usta Kebapci','yemek','Marmaris','Ataturk Cad. No:1','05001234567','usta@kebapci.com','1234567890',36.8550,28.2753,4.8,124,true,true,true]);
    var id1 = e1.rows[0].id;
    await pool.query('INSERT INTO urunler (esnaf_id,ad,fiyat,aciklama) VALUES ($1,$2,$3,$4),($1,$5,$6,$7),($1,$8,$9,$10),($1,$11,$12,$13)', [id1,'Karisik Pizza',180,'Buyuk boy','Adana Kebap',160,'Lavash ile','Tavuk Sis',150,'Pilav ile','Ayran',30,'Ev yapimi']);
    await pool.query('INSERT INTO yorumlar (esnaf_id,kullanici,puan,yorum) VALUES ($1,$2,$3,$4),($1,$5,$6,$7)', [id1,'Ahmet K.',5,'Harika lezzet!','Fatma S.',5,'Adana kebap muhtesemdi!']);
    var e2 = await pool.query(`INSERT INTO esnaflar (ad,kategori,ilce,adres,telefon,vergi_no,lat,lng,puan,yorum_sayisi,acik,onayli,onaylandi) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`, ['Kardesler Market','urun','Marmaris','Kordon Cad. No:5','05007654321','0987654321',36.8520,28.2710,4.5,89,true,true,true]);
    var id2 = e2.rows[0].id;
    await pool.query('INSERT INTO urunler (esnaf_id,ad,fiyat,aciklama) VALUES ($1,$2,$3,$4),($1,$5,$6,$7),($1,$8,$9,$10)', [id2,'Dana Kiyma',420,'1 kg','Ekmek',15,'Taze','Sut',45,'1 litre']);
    var e3 = await pool.query(`INSERT INTO esnaflar (ad,kategori,ilce,adres,telefon,vergi_no,lat,lng,puan,yorum_sayisi,acik,onayli,onaylandi) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`, ['Mehmet Usta Tesisatci','hizmet','Marmaris','Yeni Mah. No:12','05005554433','1122334455',36.8580,28.2800,4.9,56,true,true,true]);
    var id3 = e3.rows[0].id;
    await pool.query('INSERT INTO urunler (esnaf_id,ad,fiyat,aciklama) VALUES ($1,$2,$3,$4),($1,$5,$6,$7)', [id3,'Musluk Tamiri',250,'Yerinde servis','Tesisat Kontrolu',150,'Genel kontrol']);
    var e4 = await pool.query(`INSERT INTO esnaflar (ad,kategori,ilce,adres,telefon,vergi_no,lat,lng,puan,yorum_sayisi,acik,onayli,onaylandi) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`, ['Berber Murat','hizmet','Marmaris','Merkez Mah. No:8','05009876543','5566778899',36.8535,28.2740,4.7,203,true,false,true]);
    var id4 = e4.rows[0].id;
    await pool.query('INSERT INTO urunler (esnaf_id,ad,fiyat,aciklama) VALUES ($1,$2,$3,$4),($1,$5,$6,$7)', [id4,'Sac Kesimi',150,'Erkek sac','Sakal Tiras',80,'Klasik tiras']);
    console.log('Ornek veriler eklendi!');
  }
  console.log('Tablolar hazir!');
}

function mesafeHesapla(lat1, lng1, lat2, lng2) {
  var R = 6371;
  var dLat = (lat2-lat1) * Math.PI/180;
  var dLng = (lng2-lng1) * Math.PI/180;
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

app.get('/', function(req, res) { res.json({ mesaj: 'Yakinda Ne Var API calisiyor!', versiyon: '5.0' }); });
app.get('/api/ping', function(req, res) { res.sendStatus(200); });
app.get('/api/config', function(req, res) {
  var tel = (process.env.ADMIN_TELEFON || '').replace(/\D/g, '');
  if (tel.startsWith('0')) tel = '90' + tel.slice(1);
  res.json({ admin_wa: tel ? 'https://wa.me/' + tel : null });
});

app.get('/api/esnaflar', async function(req, res) {
  try {
    var ilce = req.query.ilce, kategori = req.query.kategori, siralama = req.query.siralama || 'mesafe';
    var lat = parseFloat(req.query.lat), lng = parseFloat(req.query.lng);
    var arama = req.query.arama ? req.query.arama.toLowerCase() : null;

    // Cache key: konum hariç parametreler (konum bazlı sıralama/mesafe client'ta da yapılabilir)
    var cacheKey = 'esnaflar:' + (ilce||'') + ':' + (kategori||'') + ':' + (arama||'');
    var cached = cacheAl(cacheKey);
    if (cached) {
      var esnaflar = cached.map(function(e) {
        e = Object.assign({}, e);
        if (lat && lng) { var km = mesafeHesapla(lat, lng, parseFloat(e.lat), parseFloat(e.lng)); e.mesafe_km = Math.round(km*10)/10; e.mesafe_text = km < 1 ? Math.round(km*1000)+'m' : km.toFixed(1)+'km'; }
        else { e.mesafe_km = 0; e.mesafe_text = null; }
        return e;
      });
      if (siralama === 'mesafe') esnaflar.sort(function(a,b){return a.mesafe_km-b.mesafe_km;});
      else if (siralama === 'puan') esnaflar.sort(function(a,b){return b.puan-a.puan;});
      else if (siralama === 'fiyat') esnaflar.sort(function(a,b){ var ma=a.urunler.length?Math.min.apply(null,a.urunler.map(function(u){return u.fiyat;})):999; var mb=b.urunler.length?Math.min.apply(null,b.urunler.map(function(u){return u.fiyat;})):999; return ma-mb; });
      return res.json({ basari: true, veri: esnaflar, _cache: true });
    }

    var query = `SELECT e.*,
      (SELECT COUNT(*) FROM siparisler s WHERE s.esnaf_id=e.id AND s.durum != 'iptal' AND s.tarih >= date_trunc('month', NOW())) as ay_siparis_sayisi,
      json_agg(DISTINCT jsonb_build_object('id',u.id,'ad',u.ad,'fiyat',u.fiyat,'aciklama',u.aciklama,'fotograf_url',u.fotograf_url)) FILTER (WHERE u.id IS NOT NULL) as urunler
      FROM esnaflar e LEFT JOIN urunler u ON e.id=u.esnaf_id WHERE e.onaylandi=true`;
    var params = [], pi = 1;
    if (ilce) { query += ' AND LOWER(e.ilce)=$'+pi; params.push(ilce.toLowerCase()); pi++; }
    if (kategori) { query += ' AND e.kategori=$'+pi; params.push(kategori); pi++; }
    if (arama) { query += ' AND (LOWER(e.ad) LIKE $'+pi+' OR LOWER(e.kategori) LIKE $'+pi+' OR EXISTS (SELECT 1 FROM urunler u2 WHERE u2.esnaf_id=e.id AND LOWER(u2.ad) LIKE $'+pi+'))'; params.push('%'+arama+'%'); pi++; }
    query += ' GROUP BY e.id';
    var result = await pool.query(query, params);
    var base = result.rows.map(function(e) { e.urunler = e.urunler || []; return e; });
    cacheKaydet(cacheKey, base, CACHE_TTL.esnaflar);

    var esnaflar = base.map(function(e) {
      e = Object.assign({}, e);
      if (lat && lng) { var km = mesafeHesapla(lat, lng, parseFloat(e.lat), parseFloat(e.lng)); e.mesafe_km = Math.round(km*10)/10; e.mesafe_text = km < 1 ? Math.round(km*1000)+'m' : km.toFixed(1)+'km'; }
      else { e.mesafe_km = 0; e.mesafe_text = null; }
      return e;
    });
    if (siralama === 'mesafe') esnaflar.sort(function(a,b){return a.mesafe_km-b.mesafe_km;});
    else if (siralama === 'puan') esnaflar.sort(function(a,b){return b.puan-a.puan;});
    else if (siralama === 'fiyat') esnaflar.sort(function(a,b){ var ma=a.urunler.length?Math.min.apply(null,a.urunler.map(function(u){return u.fiyat;})):999; var mb=b.urunler.length?Math.min.apply(null,b.urunler.map(function(u){return u.fiyat;})):999; return ma-mb; });
    res.json({ basari: true, veri: esnaflar });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.get('/api/esnaflar/:id', async function(req, res) {
  try {
    var cacheKey = 'esnaf_detay:' + req.params.id;
    var cached = cacheAl(cacheKey);
    var e = cached ? Object.assign({}, cached) : null;
    if (!e) {
      var result = await pool.query(`SELECT e.*, json_agg(DISTINCT jsonb_build_object('id',u.id,'ad',u.ad,'fiyat',u.fiyat,'aciklama',u.aciklama,'fotograf_url',u.fotograf_url)) FILTER (WHERE u.id IS NOT NULL) as urunler, json_agg(DISTINCT jsonb_build_object('id',y.id,'kullanici',y.kullanici,'puan',y.puan,'yorum',y.yorum,'tarih',y.tarih)) FILTER (WHERE y.id IS NOT NULL) as yorumlar, json_agg(DISTINCT jsonb_build_object('id',k.id,'baslik',k.baslik,'aciklama',k.aciklama,'indirim_orani',k.indirim_orani,'bitis_tarihi',k.bitis_tarihi)) FILTER (WHERE k.id IS NOT NULL AND k.aktif=true AND (k.bitis_tarihi IS NULL OR k.bitis_tarihi >= CURRENT_DATE)) as kampanyalar FROM esnaflar e LEFT JOIN urunler u ON e.id=u.esnaf_id LEFT JOIN yorumlar y ON e.id=y.esnaf_id LEFT JOIN kampanyalar k ON e.id=k.esnaf_id WHERE e.id=$1 GROUP BY e.id`, [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ basari: false, mesaj: 'Esnaf bulunamadi' });
      e = result.rows[0];
      e.urunler = e.urunler || []; e.yorumlar = e.yorumlar || []; e.kampanyalar = e.kampanyalar || [];
      cacheKaydet(cacheKey, e, CACHE_TTL.esnaf_detay);
    }
    var lat = parseFloat(req.query.lat), lng = parseFloat(req.query.lng);
    if (lat && lng) { var km = mesafeHesapla(lat, lng, parseFloat(e.lat), parseFloat(e.lng)); e.mesafe_km = Math.round(km*10)/10; e.mesafe_text = km < 1 ? Math.round(km*1000)+'m' : km.toFixed(1)+'km'; }
    res.json({ basari: true, veri: e });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.post('/api/esnaf-kayit', upload.fields([{name:'vergi_levhasi',maxCount:1},{name:'urun_fotograflari',maxCount:10}]), async function(req, res) {
  try {
    var body = req.body;
    if (!body.ad||!body.kategori||!body.ilce||!body.telefon||!body.vergi_no) return res.status(400).json({ basari: false, mesaj: 'Lutfen tum zorunlu alanlari doldurun' });
    var result = await pool.query('INSERT INTO esnaflar (ad,kategori,ilce,adres,telefon,email,vergi_no,lat,lng,onaylandi,sifre) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false,$10) RETURNING id', [body.ad, body.kategori, body.ilce, body.adres||'', body.telefon, body.email||'', body.vergi_no, parseFloat(body.lat)||36.8550, parseFloat(body.lng)||28.2753, body.sifre||null]);
    var esnafId = result.rows[0].id;
    if (body.sifre) {
      try { await pool.query('INSERT INTO kullanicilar (ad,telefon,sifre,tip,esnaf_id) VALUES ($1,$2,$3,$4,$5)', [body.ad, body.telefon, body.sifre, 'esnaf', esnafId]); }
      catch(e) { /* telefon zaten varsa yoksay */ }
    }
    if (body.urun_adlari) {
      var adlar = Array.isArray(body.urun_adlari) ? body.urun_adlari : [body.urun_adlari];
      var fiyatlar = Array.isArray(body.urun_fiyatlari) ? body.urun_fiyatlari : [body.urun_fiyatlari];
      var fotograflar = req.files['urun_fotograflari'] || [];
      for (var i=0; i<adlar.length; i++) {
        if (adlar[i]) {
          var fotUrl = null;
          if (fotograflar[i]) {
            try {
              var uploadResult = await cloudinary.uploader.upload(fotograflar[i].path, { folder: 'yakinda-ne-var/urunler' });
              fotUrl = uploadResult.secure_url;
              fs.unlink(fotograflar[i].path, function(){});
            } catch(uploadErr) { console.log('Upload hatasi:', uploadErr.message); }
          }
          await pool.query('INSERT INTO urunler (esnaf_id,ad,fiyat,fotograf_url) VALUES ($1,$2,$3,$4)', [esnafId, adlar[i], parseFloat(fiyatlar[i])||0, fotUrl]);
        }
      }
    }
    var adminTel = (process.env.ADMIN_TELEFON || '').replace(/\D/g, '');
    if (adminTel.startsWith('0')) adminTel = '90' + adminTel.slice(1);
    var waMesaj = encodeURIComponent('Merhaba! Yakinda Ne Var uygulamasina kayit olmak istiyorum.\n\nIsletme: '+body.ad+'\nKategori: '+body.kategori+'\nIlce: '+body.ilce+'\nTelefon: '+body.telefon+'\nVergi No: '+body.vergi_no+'\nKayit ID: '+esnafId);
    var whatsapp_url = adminTel ? 'https://wa.me/' + adminTel + '?text=' + waMesaj : null;
    res.json({ basari: true, mesaj: 'Kaydiniz alindi! Onay icin WhatsApp mesaji gonderin.', kayit_id: esnafId, whatsapp_url: whatsapp_url });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.get('/api/admin/ozet', async function(req, res) {
  if (req.query.key !== process.env.ADMIN_SIFRE) return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    var [esnafOnay, esnafAktif, kuryeOnay, kuryeToplam, musteriSayi, siparisBugun, siparisAy, siparisTopTutar] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM esnaflar WHERE onaylandi=false"),
      pool.query("SELECT COUNT(*) FROM esnaflar WHERE onaylandi=true"),
      pool.query("SELECT COUNT(*) FROM kuryeler WHERE onaylandi=false"),
      pool.query("SELECT COUNT(*) FROM kuryeler WHERE onaylandi=true"),
      pool.query("SELECT COUNT(*) FROM kullanicilar WHERE tip='musteri'"),
      pool.query("SELECT COUNT(*) FROM siparisler WHERE durum != 'iptal' AND tarih >= CURRENT_DATE"),
      pool.query("SELECT COUNT(*), COALESCE(SUM(genel_toplam),0) AS tutar FROM siparisler WHERE durum != 'iptal' AND tarih >= date_trunc('month', NOW())"),
      pool.query("SELECT COALESCE(SUM(genel_toplam),0) AS tutar FROM siparisler WHERE durum != 'iptal'")
    ]);
    res.json({ basari: true, veri: {
      esnaf_bekleyen: parseInt(esnafOnay.rows[0].count),
      esnaf_aktif: parseInt(esnafAktif.rows[0].count),
      kurye_bekleyen: parseInt(kuryeOnay.rows[0].count),
      kurye_aktif: parseInt(kuryeToplam.rows[0].count),
      musteri: parseInt(musteriSayi.rows[0].count),
      siparis_bugun: parseInt(siparisBugun.rows[0].count),
      siparis_ay: parseInt(siparisAy.rows[0].count),
      ciro_ay: parseFloat(siparisAy.rows[0].tutar),
      ciro_toplam: parseFloat(siparisTopTutar.rows[0].tutar)
    }});
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.get('/api/admin/bekleyenler', async function(req, res) {
  if (req.query.key !== process.env.ADMIN_SIFRE) return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    var result = await pool.query(`SELECT e.*, json_agg(DISTINCT jsonb_build_object('id',u.id,'ad',u.ad,'fiyat',u.fiyat,'fotograf_url',u.fotograf_url)) FILTER (WHERE u.id IS NOT NULL) as urunler FROM esnaflar e LEFT JOIN urunler u ON e.id=u.esnaf_id WHERE e.onaylandi=false GROUP BY e.id ORDER BY e.kayit_tarihi DESC`);
    res.json({ basari: true, veri: result.rows });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.get('/api/admin/aktifler', async function(req, res) {
  if (req.query.key !== process.env.ADMIN_SIFRE) return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    var result = await pool.query('SELECT * FROM esnaflar ORDER BY kayit_tarihi DESC');
    res.json({ basari: true, veri: result.rows });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.post('/api/admin/onayla/:id', async function(req, res) {
  if (req.body.key !== process.env.ADMIN_SIFRE) return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    await pool.query('UPDATE esnaflar SET onaylandi=true WHERE id=$1', [req.params.id]);
    cacheSil('esnaflar:'); cacheSil('esnaf_detay:' + req.params.id);
    res.json({ basari: true, mesaj: 'Esnaf onaylandi!' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.post('/api/admin/pasif/:id', async function(req, res) {
  if (req.body.key !== process.env.ADMIN_SIFRE) return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    await pool.query('UPDATE esnaflar SET onaylandi=false WHERE id=$1', [req.params.id]);
    cacheSil('esnaflar:'); cacheSil('esnaf_detay:' + req.params.id);
    res.json({ basari: true, mesaj: 'Esnaf yayindan kaldirildi.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.post('/api/admin/aktif/:id', async function(req, res) {
  if (req.body.key !== process.env.ADMIN_SIFRE) return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    await pool.query('UPDATE esnaflar SET onaylandi=true WHERE id=$1', [req.params.id]);
    cacheSil('esnaflar:'); cacheSil('esnaf_detay:' + req.params.id);
    res.json({ basari: true, mesaj: 'Esnaf yayina alindi!' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

async function esnafSil(id) {
  await pool.query('DELETE FROM kampanyalar WHERE esnaf_id=$1', [id]);
  await pool.query('DELETE FROM urunler WHERE esnaf_id=$1', [id]);
  await pool.query('DELETE FROM yorumlar WHERE esnaf_id=$1', [id]);
  await pool.query('UPDATE kullanicilar SET esnaf_id=NULL WHERE esnaf_id=$1', [id]);
  await pool.query('DELETE FROM esnaflar WHERE id=$1', [id]);
  cacheSil('esnaflar:'); cacheSil('esnaf_detay:' + id);
}

app.delete('/api/admin/reddet/:id', async function(req, res) {
  if (req.query.key !== process.env.ADMIN_SIFRE) return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    await esnafSil(req.params.id);
    res.json({ basari: true, mesaj: 'Esnaf reddedildi.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.delete('/api/admin/sil/:id', async function(req, res) {
  if (req.query.key !== process.env.ADMIN_SIFRE) return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    await esnafSil(req.params.id);
    res.json({ basari: true, mesaj: 'Esnaf silindi.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Kurye kayıt
app.post('/api/kurye-kayit', async function(req, res) {
  try {
    var { ad, telefon, arac_tipi, ilce, sifre } = req.body;
    if (!ad || !telefon || !arac_tipi || !ilce) return res.status(400).json({ basari: false, mesaj: 'Tum alanlar zorunlu' });
    var kr = await pool.query('INSERT INTO kuryeler (ad,telefon,arac_tipi,ilce) VALUES ($1,$2,$3,$4) RETURNING id', [ad, telefon, arac_tipi, ilce]);
    var kuryeId = kr.rows[0].id;
    if (sifre) {
      try { await pool.query('INSERT INTO kullanicilar (ad,telefon,sifre,tip,kurye_id) VALUES ($1,$2,$3,$4,$5)', [ad, telefon, sifre, 'kurye', kuryeId]); }
      catch(e) { /* telefon zaten varsa yoksay */ }
    }
    if (process.env.ADMIN_TELEFON) {
      whatsappGonder(process.env.ADMIN_TELEFON, '🛵 Yeni kurye başvurusu: ' + ad + ', ' + ilce + ', ' + arac_tipi);
    }
    res.json({ basari: true, mesaj: 'Basvuru alindi.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Admin kurye listesi
app.get('/api/admin/kuryeler', async function(req, res) {
  if (req.query.key !== process.env.ADMIN_SIFRE) return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    var result = await pool.query('SELECT * FROM kuryeler ORDER BY kayit_tarihi DESC');
    res.json({ basari: true, veri: result.rows });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Admin kurye onayla
app.post('/api/admin/kurye-onayla/:id', async function(req, res) {
  if (req.body.key !== process.env.ADMIN_SIFRE) return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    await pool.query('UPDATE kuryeler SET onaylandi=true WHERE id=$1', [req.params.id]);
    res.json({ basari: true, mesaj: 'Kurye onaylandi.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Admin kurye sil
app.delete('/api/admin/kurye-sil/:id', async function(req, res) {
  if (req.query.key !== process.env.ADMIN_SIFRE) return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    await pool.query('DELETE FROM kuryeler WHERE id=$1', [req.params.id]);
    res.json({ basari: true, mesaj: 'Kurye silindi.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Admin müşteriler listesi
app.get('/api/admin/musteriler', async function(req, res) {
  if (req.query.key !== process.env.ADMIN_SIFRE) return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    var result = await pool.query("SELECT id, ad, telefon, olusturma FROM kullanicilar WHERE tip='musteri' ORDER BY olusturma DESC");
    res.json({ basari: true, veri: result.rows });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Admin tüm siparişler
app.get('/api/admin/siparisler', async function(req, res) {
  if (req.query.key !== process.env.ADMIN_SIFRE) return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    var where = ''; var params = [];
    if (req.query.durum) { where = ' WHERE durum=$1'; params = [req.query.durum]; }
    var result = await pool.query('SELECT * FROM siparisler' + where + ' ORDER BY tarih DESC', params);
    res.json({ basari: true, veri: result.rows });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Admin esnaf bilgi güncelle
app.put('/api/admin/esnaf/:id', async function(req, res) {
  if (req.body.key !== process.env.ADMIN_SIFRE) return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    var { ad, kategori, ilce, adres, telefon } = req.body;
    await pool.query('UPDATE esnaflar SET ad=$1, kategori=$2, ilce=$3, adres=$4, telefon=$5 WHERE id=$6', [ad, kategori, ilce||'', adres||'', telefon, req.params.id]);
    cacheSil('esnaf_detay:' + req.params.id);
    cacheSil('esnaflar:');
    res.json({ basari: true, mesaj: 'Esnaf guncellendi.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Admin: esnafı öne çıkar / geri al
app.put('/api/admin/esnaf/:id/one-cikan', async function(req, res) {
  if (req.body.key !== process.env.ADMIN_SIFRE) return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    var { aktif, etiket } = req.body;
    await pool.query('UPDATE esnaflar SET one_cikan=$1, one_cikan_etiket=$2 WHERE id=$3', [!!aktif, etiket || null, req.params.id]);
    cacheSil('esnaf_detay:' + req.params.id);
    cacheSil('esnaflar:');
    res.json({ basari: true, mesaj: aktif ? 'Esnaf one cikanlara eklendi.' : 'Kaldirildi.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Herkese açık: öne çıkan esnaflar
app.get('/api/one-cikanlar', async function(req, res) {
  try {
    var r = await pool.query(`
      SELECT e.id, e.ad, e.kategori, e.ilce, e.puan, e.yorum_sayisi, e.acik, e.one_cikan_etiket,
        (SELECT COUNT(*) FROM siparisler s WHERE s.esnaf_id=e.id AND s.durum!='iptal' AND s.tarih >= date_trunc('month',NOW())) as ay_siparis_sayisi,
        (SELECT fotograf_url FROM urunler u WHERE u.esnaf_id=e.id LIMIT 1) as kapak_foto
      FROM esnaflar e
      WHERE e.onaylandi=true AND e.one_cikan=true
      ORDER BY e.puan DESC, ay_siparis_sayisi DESC
      LIMIT 10
    `);
    res.json({ basari: true, veri: r.rows });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Admin müşteri sil
app.delete('/api/admin/musteri/:id', async function(req, res) {
  if (req.query.key !== process.env.ADMIN_SIFRE) return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    await pool.query('DELETE FROM kullanicilar WHERE id=$1 AND tip=$2', [req.params.id, 'musteri']);
    res.json({ basari: true, mesaj: 'Musteri silindi.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.post('/api/esnaflar/:id/urunler', async function(req, res) {
  try {
    var { ad, fiyat, aciklama } = req.body;
    if (!ad) return res.status(400).json({ basari: false, mesaj: 'Ürün adı zorunlu' });
    var result = await pool.query('INSERT INTO urunler (esnaf_id,ad,fiyat,aciklama) VALUES ($1,$2,$3,$4) RETURNING *', [req.params.id, ad, parseFloat(fiyat) || 0, aciklama || '']);
    cacheSil('esnaf_detay:' + req.params.id);
    res.json({ basari: true, veri: result.rows[0] });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.put('/api/esnaflar/:id/urunler/:urun_id', async function(req, res) {
  try {
    var { ad, fiyat, aciklama } = req.body;
    if (!ad) return res.status(400).json({ basari: false, mesaj: 'Ürün adı zorunlu' });
    var result = await pool.query(
      'UPDATE urunler SET ad=$1, fiyat=$2, aciklama=$3 WHERE id=$4 AND esnaf_id=$5 RETURNING *',
      [ad, parseFloat(fiyat) || 0, aciklama || '', req.params.urun_id, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ basari: false, mesaj: 'Ürün bulunamadı' });
    cacheSil('esnaf_detay:' + req.params.id);
    res.json({ basari: true, veri: result.rows[0] });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.delete('/api/esnaflar/:id/urunler/:urun_id', async function(req, res) {
  try {
    await pool.query('DELETE FROM urunler WHERE id=$1 AND esnaf_id=$2', [req.params.urun_id, req.params.id]);
    cacheSil('esnaf_detay:' + req.params.id);
    res.json({ basari: true, mesaj: 'Ürün silindi' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.post('/api/esnaflar/:id/yorumlar', async function(req, res) {
  try {
    await pool.query('INSERT INTO yorumlar (esnaf_id,kullanici,puan,yorum) VALUES ($1,$2,$3,$4)', [req.params.id, req.body.kullanici, parseInt(req.body.puan), req.body.yorum]);
    var yorumlar = await pool.query('SELECT puan FROM yorumlar WHERE esnaf_id=$1', [req.params.id]);
    var toplam = yorumlar.rows.reduce(function(t,y){return t+y.puan;},0);
    var ort = Math.round((toplam/yorumlar.rows.length)*10)/10;
    await pool.query('UPDATE esnaflar SET puan=$1, yorum_sayisi=$2 WHERE id=$3', [ort, yorumlar.rows.length, req.params.id]);
    cacheSil('esnaf_detay:' + req.params.id);
    cacheSil('esnaflar:');
    res.json({ basari: true, mesaj: 'Yorum eklendi!' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.post('/api/siparisler', async function(req, res) {
  try {
    var esnaf = await pool.query('SELECT * FROM esnaflar WHERE id=$1', [req.body.esnaf_id]);
    if (!esnaf.rows.length) return res.status(404).json({ basari: false, mesaj: 'Esnaf bulunamadi' });
    var toplam = 0;
    req.body.urunler.forEach(function(u){toplam+=u.fiyat*u.adet;});
    var kurye = req.body.teslimat_turu === 'kurye' ? 15 : 0;
    var komisyon = Math.round(toplam*0.05);
    var result = await pool.query('INSERT INTO siparisler (esnaf_id,esnaf_adi,musteri_telefon,urunler,teslimat_turu,adres,ara_toplam,kurye_ucreti,komisyon,genel_toplam) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *', [req.body.esnaf_id, esnaf.rows[0].ad, req.body.musteri_telefon||null, JSON.stringify(req.body.urunler), req.body.teslimat_turu||'gel-al', req.body.adres||'', toplam, kurye, komisyon, toplam+kurye+komisyon]);
    var siparis = result.rows[0];
    var urunSatiri = req.body.urunler.map(function(u) { return u.ad + ' x' + u.adet; }).join(', ');
    var teslimatBilgi = (siparis.teslimat_turu || 'gel-al') + (siparis.adres ? ' - ' + siparis.adres : '');
    var waMesaj = encodeURIComponent(
      '🆕 Yeni Sipariş #' + siparis.id + '\n' +
      '📦 ' + urunSatiri + '\n' +
      '💰 Toplam: ₺' + (toplam + kurye + komisyon) + '\n' +
      '📍 Teslimat: ' + teslimatBilgi
    );
    var telefon = (esnaf.rows[0].telefon || '').replace(/\D/g, '');
    if (telefon.startsWith('0')) telefon = '90' + telefon.slice(1);
    var whatsapp_url = telefon ? 'https://wa.me/' + telefon + '?text=' + waMesaj : null;

    // Esnafa bildirim
    if (telefon) {
      var musteriTelefon = req.body.musteri_telefon || '-';
      var esnafMesaj = '🛵 Yeni sipariş! Müşteri: ' + musteriTelefon + ', Tutar: ' + (toplam + kurye + komisyon) + '₺. Ürünler: ' + urunSatiri + '. Müşteri telefon: ' + musteriTelefon;
      whatsappGonder('+' + telefon, esnafMesaj);
    }

    // Müşteriye bildirim
    if (req.body.musteri_telefon) {
      var musteriNo = (req.body.musteri_telefon || '').replace(/\D/g, '');
      if (musteriNo.startsWith('0')) musteriNo = '90' + musteriNo.slice(1);
      var musteriMesaj = '✅ Siparişiniz alındı! ' + esnaf.rows[0].ad + '\'na iletildi. Toplam: ' + (toplam + kurye + komisyon) + '₺';
      whatsappGonder('+' + musteriNo, musteriMesaj);
    }

    // Kurye bildirimi (sadece kurye teslimatı ise)
    if (siparis.teslimat_turu === 'kurye') {
      var kuryeler = await pool.query('SELECT * FROM kuryeler WHERE LOWER(ilce)=LOWER($1) AND onaylandi=true', [esnaf.rows[0].ilce]);
      kuryeler.rows.forEach(function(k) {
        var kuryeNo = (k.telefon || '').replace(/\D/g, '');
        if (kuryeNo.startsWith('0')) kuryeNo = '90' + kuryeNo.slice(1);
        var kuryeMesaj = '🛵 Yeni sipariş! ' + esnaf.rows[0].ad + ' - ' + esnaf.rows[0].ilce + '. Tutar: ' + (toplam + kurye + komisyon) + '₺. Kabul etmek için yanıtla: KABUL ' + siparis.id;
        whatsappGonder('+' + kuryeNo, kuryeMesaj);
      });
    }

    cacheSil('esnaflar:');
    res.json({ basari: true, veri: siparis, whatsapp_url: whatsapp_url });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.post('/api/kurye-kabul', async function(req, res) {
  try {
    var { kurye_telefon, siparis_id } = req.body;
    if (!kurye_telefon || !siparis_id) return res.status(400).json({ basari: false, mesaj: 'kurye_telefon ve siparis_id zorunlu' });

    // Kurye ve siparişi bul
    var kuryeRes = await pool.query('SELECT * FROM kuryeler WHERE telefon=$1 AND onaylandi=true', [kurye_telefon]);
    if (!kuryeRes.rows.length) return res.status(404).json({ basari: false, mesaj: 'Onaylı kurye bulunamadı' });
    var kurye = kuryeRes.rows[0];

    var siparisRes = await pool.query('SELECT * FROM siparisler WHERE id=$1', [siparis_id]);
    if (!siparisRes.rows.length) return res.status(404).json({ basari: false, mesaj: 'Sipariş bulunamadı' });
    var siparis = siparisRes.rows[0];

    if (siparis.kurye_id) return res.status(409).json({ basari: false, mesaj: 'Sipariş zaten başka kurye tarafından alındı' });

    // Siparişi kurye üzerine ata
    await pool.query('UPDATE siparisler SET kurye_id=$1, durum=$2 WHERE id=$3', [kurye.id, 'kurye_atandi', siparis_id]);

    var atandiMesaj = '🛵 Kuryeniz atandı! ' + kurye.ad + ' siparişinizi teslim edecek. Tel: ' + kurye.telefon;

    // Esnafa bildirim
    var esnafRes = await pool.query('SELECT * FROM esnaflar WHERE id=$1', [siparis.esnaf_id]);
    if (esnafRes.rows.length) {
      var esnafNo = (esnafRes.rows[0].telefon || '').replace(/\D/g, '');
      if (esnafNo.startsWith('0')) esnafNo = '90' + esnafNo.slice(1);
      if (esnafNo) whatsappGonder('+' + esnafNo, atandiMesaj);
    }

    // Müşteriye bildirim
    if (siparis.musteri_telefon) {
      var musteriNo = (siparis.musteri_telefon || '').replace(/\D/g, '');
      if (musteriNo.startsWith('0')) musteriNo = '90' + musteriNo.slice(1);
      whatsappGonder('+' + musteriNo, atandiMesaj);
    }

    // Aynı ilçedeki diğer kuryalere bildirim
    var digerKuryeler = await pool.query('SELECT * FROM kuryeler WHERE LOWER(ilce)=LOWER($1) AND onaylandi=true AND id!=$2', [kurye.ilce, kurye.id]);
    digerKuryeler.rows.forEach(function(k) {
      var kNo = (k.telefon || '').replace(/\D/g, '');
      if (kNo.startsWith('0')) kNo = '90' + kNo.slice(1);
      whatsappGonder('+' + kNo, 'Bu sipariş başka kurye tarafından alındı.');
    });

    res.json({ basari: true, mesaj: 'Kurye atandı.', kurye: { ad: kurye.ad, telefon: kurye.telefon } });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Kuryenin üstlendiği aktif siparişleri listele
app.get('/api/kurye-siparislerim', async function(req, res) {
  try {
    var telefon = req.query.telefon;
    if (!telefon) return res.status(400).json({ basari: false, mesaj: 'Telefon gerekli' });
    var kuryeRes = await pool.query('SELECT id, ilce FROM kuryeler WHERE telefon=$1 AND onaylandi=true', [telefon]);
    if (!kuryeRes.rows.length) return res.json({ basari: false, mesaj: 'Onaylı kurye bulunamadı' });
    var kurye = kuryeRes.rows[0];
    var aktif = await pool.query(
      "SELECT s.*, e.ad as esnaf_adi, e.adres as esnaf_adres, e.telefon as esnaf_telefon FROM siparisler s LEFT JOIN esnaflar e ON e.id=s.esnaf_id WHERE s.kurye_id=$1 AND s.durum NOT IN ('teslim_edildi','iptal') ORDER BY s.tarih DESC",
      [kurye.id]
    );
    res.json({ basari: true, veri: aktif.rows, kurye_ilce: kurye.ilce });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Kuryenin bölgesindeki henüz alınmamış siparişler
app.get('/api/kurye-bekleyen', async function(req, res) {
  try {
    var ilce = req.query.ilce;
    if (!ilce) return res.json({ basari: true, veri: [] });
    var result = await pool.query(
      "SELECT s.*, e.ad as esnaf_adi, e.ilce as esnaf_ilce, e.adres as esnaf_adres FROM siparisler s LEFT JOIN esnaflar e ON e.id=s.esnaf_id WHERE s.teslimat_turu='kurye' AND s.kurye_id IS NULL AND s.durum='bekliyor' AND LOWER(e.ilce)=LOWER($1) ORDER BY s.tarih DESC",
      [ilce]
    );
    res.json({ basari: true, veri: result.rows });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Kurye: konumunu güncelle
app.put('/api/kurye-konum', async function(req, res) {
  try {
    var { telefon, lat, lng } = req.body;
    if (!telefon || lat == null || lng == null) return res.status(400).json({ basari: false, mesaj: 'Eksik bilgi.' });
    await pool.query(
      'UPDATE kuryeler SET lat=$1, lng=$2, konum_guncelleme=NOW() WHERE telefon=$3',
      [parseFloat(lat), parseFloat(lng), telefon]
    );
    res.json({ basari: true });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Sipariş: atanan kuryenin konumunu al
app.get('/api/siparis/:id/kurye-konum', async function(req, res) {
  try {
    var r = await pool.query(
      'SELECT k.lat, k.lng, k.ad AS kurye_ad, k.konum_guncelleme FROM siparisler s JOIN kuryeler k ON k.id=s.kurye_id WHERE s.id=$1',
      [req.params.id]
    );
    if (!r.rows.length || r.rows[0].lat == null) return res.json({ basari: false, mesaj: 'Kurye konumu yok.' });
    res.json({ basari: true, veri: r.rows[0] });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.get('/api/siparis-detay/:id', async function(req, res) {
  try {
    var result = await pool.query(
      'SELECT s.*, k.ad AS kurye_ad, k.telefon AS kurye_telefon, k.arac_tipi AS kurye_arac, k.lat AS kurye_lat, k.lng AS kurye_lng ' +
      'FROM siparisler s LEFT JOIN kuryeler k ON k.id=s.kurye_id WHERE s.id=$1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ basari: false, mesaj: 'Siparis bulunamadi' });
    res.json({ basari: true, veri: result.rows[0] });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.put('/api/siparis-iptal/:id', async function(req, res) {
  try {
    var telefon = req.body.musteri_telefon;
    if (!telefon) return res.status(400).json({ basari: false, mesaj: 'musteri_telefon gerekli' });
    var siparis = await pool.query('SELECT * FROM siparisler WHERE id=$1', [req.params.id]);
    if (!siparis.rows.length) return res.status(404).json({ basari: false, mesaj: 'Siparis bulunamadi' });
    var s = siparis.rows[0];
    if (s.musteri_telefon !== telefon) return res.status(403).json({ basari: false, mesaj: 'Yetkisiz' });
    if (s.durum !== 'bekliyor') return res.status(400).json({ basari: false, mesaj: 'Sadece bekliyor durumundaki siparisler iptal edilebilir' });
    await pool.query("UPDATE siparisler SET durum='iptal' WHERE id=$1", [req.params.id]);
    res.json({ basari: true, mesaj: 'Siparis iptal edildi' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.get('/api/siparislerim', async function(req, res) {
  try {
    var telefon = req.query.telefon;
    if (!telefon) return res.status(400).json({ basari: false, mesaj: 'Telefon gerekli' });
    var result = await pool.query('SELECT * FROM siparisler WHERE musteri_telefon=$1 ORDER BY tarih DESC', [telefon]);
    res.json({ basari: true, veri: result.rows });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.get('/api/siparisler', async function(req, res) {
  try {
    var esnafId = req.query.esnaf_id;
    var result = esnafId
      ? await pool.query('SELECT * FROM siparisler WHERE esnaf_id=$1 ORDER BY tarih DESC', [esnafId])
      : await pool.query('SELECT * FROM siparisler ORDER BY tarih DESC');
    res.json({ basari: true, veri: result.rows });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.put('/api/siparisler/:id/durum', async function(req, res) {
  try {
    var yeniDurum = req.body.durum;
    var sipRes = await pool.query(
      'SELECT s.*, k.ad as kurye_ad, k.telefon as kurye_tel FROM siparisler s LEFT JOIN kuryeler k ON k.id=s.kurye_id WHERE s.id=$1',
      [req.params.id]
    );
    if (!sipRes.rows.length) return res.status(404).json({ basari: false, mesaj: 'Siparis bulunamadi' });
    var s = sipRes.rows[0];

    await pool.query('UPDATE siparisler SET durum=$1 WHERE id=$2', [yeniDurum, req.params.id]);

    // Müşteri ve esnafa durum bildirimi
    var musteriNo = (s.musteri_telefon || '').replace(/\D/g, '');
    if (musteriNo.startsWith('0')) musteriNo = '90' + musteriNo.slice(1);

    var durumMesajlari = {
      hazirlaniyor: '🍳 Siparişiniz hazırlanıyor! ' + s.esnaf_adi + ' siparişinizi hazırlıyor.',
      yolda: '🛵 Siparişiniz yolda! ' + (s.kurye_ad ? s.kurye_ad + ' siparişinizi getiriyor.' : 'Kurye yola çıktı.'),
      teslim_edildi: '✅ Siparişiniz teslim edildi! Afiyet olsun. ' + s.esnaf_adi,
      iptal: '❌ Siparişiniz iptal edildi. Detaylar için iletişime geçin.'
    };

    if (musteriNo && durumMesajlari[yeniDurum]) {
      whatsappGonder('+' + musteriNo, durumMesajlari[yeniDurum]).catch(function() {});
    }

    res.json({ basari: true, mesaj: 'Durum guncellendi' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.post('/api/gorsel-ara', upload.single('fotograf'), async function(req, res) {
  try {
    if (!req.file) return res.status(400).json({ basari: false, mesaj: 'Fotograf yuklenemedi' });

    var imageBuffer = fs.readFileSync(req.file.path);
    var base64Image = imageBuffer.toString('base64');
    var ext = (req.file.originalname || '').split('.').pop().toLowerCase();
    var extMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
    var mimeType = (req.file.mimetype && req.file.mimetype.startsWith('image/')) ? req.file.mimetype : (extMap[ext] || 'image/jpeg');
    fs.unlink(req.file.path, function(){});

    var kategori = null, anahtarKelimeler = [], urunAdi = '', aciklama = '';
    try {
      var prompt = "Bu fotografta ne goruyorsun? Turkiye'deki bir yerel pazar uygulamasi icin analiz et. Sadece gecerli JSON dondur, baska hicbir sey yazma:\n{\"kategori\": \"yemek\" veya \"urun\" veya \"hizmet\" veya \"tumu\", \"urun_adi\": \"fotograftaki urunun kisa adi\", \"anahtar_kelimeler\": [\"kelime1\",\"kelime2\",\"kelime3\",\"kelime4\",\"kelime5\"], \"aciklama\": \"fotografin kisaca aciklamasi\"}\nOnemli kurallar: Anahtar kelimeleri tek kelime ve mumkun oldugunca kisa yaz, Turkce yaz. Hem genel kategori hem spesifik urun adini ekle. Ornek: ekmek fotografı icin [\"ekmek\",\"unlu\",\"firin\",\"beyaz\"] gibi. \"taze ekmek\" degil \"ekmek\" yaz.";
      var openaiRes = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: 'data:' + mimeType + ';base64,' + base64Image } }
          ]
        }],
        max_tokens: 500
      });
      var text = openaiRes.choices[0].message.content;
      var jsonEslesmesi = text.match(/\{[\s\S]*\}/);
      if (jsonEslesmesi) {
        var parsed = JSON.parse(jsonEslesmesi[0]);
        kategori         = parsed.kategori && parsed.kategori !== 'tumu' ? parsed.kategori : null;
        anahtarKelimeler = parsed.anahtar_kelimeler || [];
        urunAdi          = parsed.urun_adi || '';
        aciklama         = parsed.aciklama || '';
        if (urunAdi && anahtarKelimeler.indexOf(urunAdi.toLowerCase()) === -1) {
          anahtarKelimeler.unshift(urunAdi.toLowerCase());
        }
      }
    } catch(openaiErr) { console.log('OpenAI hatasi:', openaiErr.message); }

    // Anahtar kelimelerle urun adı/acıklamasında eşleşen esnafları skorla
    var esnaflar = [];
    if (anahtarKelimeler.length > 0) {
      // Her anahtar kelime için urunler tablosunda eşleşme sayısını hesapla
      var kelimeSartlari = anahtarKelimeler.map(function(k) {
        return "LOWER(u.ad) LIKE '%" + k.toLowerCase().replace(/'/g, "''") + "%' OR LOWER(COALESCE(u.aciklama,'')) LIKE '%" + k.toLowerCase().replace(/'/g, "''") + "%'";
      }).join(' OR ');

      var skorQuery = `
        SELECT e.*,
          json_agg(DISTINCT jsonb_build_object('id',u.id,'ad',u.ad,'fiyat',u.fiyat,'aciklama',u.aciklama,'fotograf_url',u.fotograf_url))
            FILTER (WHERE u.id IS NOT NULL) as urunler,
          COUNT(DISTINCT CASE WHEN (${kelimeSartlari}) THEN u.id END) as eslesen_urun_sayisi
        FROM esnaflar e
        LEFT JOIN urunler u ON e.id = u.esnaf_id
        WHERE e.onaylandi = true
        ${kategori ? "AND e.kategori = $1" : ""}
        GROUP BY e.id
        HAVING COUNT(DISTINCT CASE WHEN (${kelimeSartlari}) THEN u.id END) > 0
        ORDER BY eslesen_urun_sayisi DESC
      `;
      var params = kategori ? [kategori] : [];
      var eslesenResult = await pool.query(skorQuery, params);

      // Esnaf adı/açıklamasında veya ürünlerinde anahtar kelime geçenleri de ekle
      var eslesenIdler = eslesenResult.rows.map(function(r) { return r.id; });
      var kalanQuery = `
        SELECT e.*,
          json_agg(DISTINCT jsonb_build_object('id',u.id,'ad',u.ad,'fiyat',u.fiyat,'aciklama',u.aciklama,'fotograf_url',u.fotograf_url))
            FILTER (WHERE u.id IS NOT NULL) as urunler,
          0 as eslesen_urun_sayisi
        FROM esnaflar e
        LEFT JOIN urunler u ON e.id = u.esnaf_id
        WHERE e.onaylandi = true
        ${kategori ? "AND e.kategori = $1" : ""}
        ${eslesenIdler.length > 0 ? "AND e.id NOT IN (" + eslesenIdler.join(',') + ")" : ""}
        GROUP BY e.id
        HAVING (${anahtarKelimeler.map(function(k) {
          var kk = k.toLowerCase().replace(/'/g, "''");
          return "bool_or(LOWER(u.ad) LIKE '%" + kk + "%') OR bool_or(LOWER(COALESCE(u.aciklama,'')) LIKE '%" + kk + "%')";
        }).join(') OR (')})
        ORDER BY e.puan DESC
      `;
      var kalanResult = await pool.query(kalanQuery, kategori ? [kategori] : []);

      esnaflar = eslesenResult.rows.concat(kalanResult.rows).map(function(e) {
        e.urunler = e.urunler || [];
        e.eslesen_urun_sayisi = parseInt(e.eslesen_urun_sayisi) || 0;
        return e;
      });
    } else {
      // Claude yanıt veremediyse tüm (veya kategorideki) esnafları getir
      var fallbackQuery = `
        SELECT e.*,
          json_agg(DISTINCT jsonb_build_object('id',u.id,'ad',u.ad,'fiyat',u.fiyat,'aciklama',u.aciklama,'fotograf_url',u.fotograf_url))
            FILTER (WHERE u.id IS NOT NULL) as urunler,
          0 as eslesen_urun_sayisi
        FROM esnaflar e
        LEFT JOIN urunler u ON e.id = u.esnaf_id
        WHERE e.onaylandi = true
        GROUP BY e.id ORDER BY e.puan DESC
      `;
      var fallbackResult = await pool.query(fallbackQuery);
      esnaflar = fallbackResult.rows.map(function(e) { e.urunler = e.urunler || []; return e; });
    }

    res.json({
      basari: true,
      kategori: kategori || 'tumu',
      urun_adi: urunAdi,
      anahtar_kelimeler: anahtarKelimeler,
      aciklama: aciklama,
      mesaj: urunAdi ? ('"' + urunAdi + '" icin sonuclar') : (kategori ? kategori + ' kategorisinde esnaflar' : 'Tum esnaflar'),
      veri: esnaflar
    });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Push bildirim token kaydet
app.post('/api/bildirim-token', async function(req, res) {
  var { token, kullanici_telefon } = req.body;
  if (!token) return res.status(400).json({ basari: false, mesaj: 'Token zorunlu' });
  try {
    await pool.query(
      'INSERT INTO bildirim_tokenler (token, kullanici_telefon) VALUES ($1,$2) ON CONFLICT (token) DO UPDATE SET kullanici_telefon=$2, olusturma=NOW()',
      [token, kullanici_telefon || null]
    );
    res.json({ basari: true });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.get('/api/ilceler', function(req, res) {
  var cached = cacheAl('ilceler');
  if (cached) return res.json({ basari: true, veri: cached });
  var liste = ['Marmaris','Bodrum','Fethiye','Datca','Milas','Mugla Merkez'];
  cacheKaydet('ilceler', liste, CACHE_TTL.ilceler);
  res.json({ basari: true, veri: liste });
});

app.post('/api/otp-gonder', async function(req, res) {
  var telefon = req.body.telefon;
  if (!telefon) return res.status(400).json({ basari: false, mesaj: 'Telefon zorunlu' });
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_WHATSAPP_FROM) {
    return res.status(500).json({ basari: false, mesaj: 'WhatsApp servisi yapılandırılmamış (Twilio env vars eksik)' });
  }
  var kod = otpOlustur(telefon);
  try {
    await whatsappGonder(telefon, 'Yakinda Ne Var dogrulama kodunuz: *' + kod + '*\n(10 dakika gecerli)');
    res.json({ basari: true, mesaj: 'Dogrulama kodu WhatsApp a gonderildi.' });
  } catch(e) {
    res.status(500).json({ basari: false, mesaj: 'WhatsApp gönderilemedi: ' + e.message });
  }
});

app.post('/api/kayit', async function(req, res) {
  try {
    var { ad, telefon, sifre } = req.body;
    if (!ad || !telefon || !sifre) return res.status(400).json({ basari: false, mesaj: 'Ad, telefon ve sifre zorunlu' });
    if (sifre.length < 4) return res.status(400).json({ basari: false, mesaj: 'Sifre en az 4 karakter olmali' });
    var mevcut = await pool.query('SELECT id FROM kullanicilar WHERE telefon=$1', [telefon]);
    if (mevcut.rows.length) return res.status(400).json({ basari: false, mesaj: 'Bu telefon zaten kayitli' });
    var r = await pool.query('INSERT INTO kullanicilar (ad,telefon,sifre,tip) VALUES ($1,$2,$3,$4) RETURNING id', [ad, telefon, sifre, 'musteri']);
    if (process.env.ADMIN_TELEFON) {
      whatsappGonder(process.env.ADMIN_TELEFON, '👤 Yeni müşteri kaydı: ' + ad + ', ' + telefon);
    }
    res.json({ basari: true, mesaj: 'Kayit basarili!', kullanici_id: r.rows[0].id });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.post('/api/giris', async function(req, res) {
  try {
    var { telefon, sifre } = req.body;
    if (!telefon || !sifre) return res.status(400).json({ basari: false, mesaj: 'Telefon ve sifre zorunlu' });
    // Admin kontrolü (env'den)
    if (process.env.ADMIN_TELEFON && process.env.ADMIN_SIFRE &&
        telefon === process.env.ADMIN_TELEFON && sifre === process.env.ADMIN_SIFRE) {
      return res.json({ basari: true, veri: { kullanici_id: 0, ad: 'Admin', telefon: telefon, tip: 'admin', esnaf_id: null, kurye_id: null } });
    }
    // Kullanicilar tablosu
    var r = await pool.query('SELECT id,ad,telefon,tip,esnaf_id,kurye_id,email,adresler FROM kullanicilar WHERE telefon=$1 AND sifre=$2', [telefon, sifre]);
    if (r.rows.length) {
      var u = r.rows[0];
      var veri = { kullanici_id: u.id, ad: u.ad, telefon: u.telefon, tip: u.tip, esnaf_id: u.esnaf_id, kurye_id: u.kurye_id, email: u.email || '', adresler: u.adresler || [] };
      if (u.tip === 'kurye' && u.kurye_id) {
        var kr = await pool.query('SELECT ilce, arac_tipi, onaylandi FROM kuryeler WHERE id=$1', [u.kurye_id]);
        if (kr.rows.length) { veri.ilce = kr.rows[0].ilce; veri.arac_tipi = kr.rows[0].arac_tipi; veri.onaylandi = kr.rows[0].onaylandi; }
      }
      return res.json({ basari: true, veri: veri });
    }
    // Geriye dönük uyumluluk: esnaflar tablosundaki sifre
    var er = await pool.query('SELECT id,ad FROM esnaflar WHERE telefon=$1 AND sifre=$2', [telefon, sifre]);
    if (er.rows.length) {
      return res.json({ basari: true, veri: { kullanici_id: null, ad: er.rows[0].ad, telefon: telefon, tip: 'esnaf', esnaf_id: er.rows[0].id, kurye_id: null } });
    }
    res.status(401).json({ basari: false, mesaj: 'Telefon veya sifre yanlis' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.put('/api/musteri/profil', async function(req, res) {
  try {
    var { id, telefon, email, adresler } = req.body;
    if (!id || !telefon) return res.status(400).json({ basari: false, mesaj: 'id ve telefon zorunlu' });
    var kontrol = await pool.query('SELECT id FROM kullanicilar WHERE id=$1 AND telefon=$2', [id, telefon]);
    if (!kontrol.rows.length) return res.status(403).json({ basari: false, mesaj: 'Yetkisiz' });
    await pool.query('UPDATE kullanicilar SET email=$1, adresler=$2 WHERE id=$3', [email || null, JSON.stringify(adresler || []), id]);
    res.json({ basari: true });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.put('/api/esnaf-panel/:id/profil', async function(req, res) {
  try {
    var { ad, adres, telefon, kategori, instagram_url, google_maps_url } = req.body;
    if (!ad || !telefon) return res.status(400).json({ basari: false, mesaj: 'Ad ve telefon zorunlu' });
    await pool.query(
      'UPDATE esnaflar SET ad=$1, adres=$2, telefon=$3, kategori=$4, instagram_url=$5, google_maps_url=$6 WHERE id=$7',
      [ad, adres||'', telefon, kategori, instagram_url||null, google_maps_url||null, req.params.id]
    );
    cacheSil('esnaf_detay:' + req.params.id);
    cacheSil('esnaflar:');
    res.json({ basari: true, mesaj: 'Profil guncellendi.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.put('/api/esnaflar/:id/goruntuleme', async function(req, res) {
  try {
    await pool.query('UPDATE esnaflar SET goruntuleme_sayisi = COALESCE(goruntuleme_sayisi,0) + 1 WHERE id=$1', [req.params.id]);
    res.json({ basari: true });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.get('/api/esnaf-panel/:id/istatistik', async function(req, res) {
  try {
    var id = req.params.id;

    var [haftaRes, ayRes, toplamRes, goruntulemeRes, saatlikRes, yediGunRes, teslimatRes, tekrarRes, tumSiparisler] = await Promise.all([
      pool.query("SELECT COUNT(*) AS sayi, COALESCE(SUM(genel_toplam),0) AS tutar FROM siparisler WHERE esnaf_id=$1 AND durum != 'iptal' AND tarih >= date_trunc('week', NOW())", [id]),
      pool.query("SELECT COUNT(*) AS sayi, COALESCE(SUM(genel_toplam),0) AS tutar, COALESCE(AVG(genel_toplam),0) AS ort FROM siparisler WHERE esnaf_id=$1 AND durum != 'iptal' AND tarih >= date_trunc('month', NOW())", [id]),
      pool.query("SELECT COUNT(*) AS sayi, COALESCE(SUM(genel_toplam),0) AS tutar FROM siparisler WHERE esnaf_id=$1 AND durum != 'iptal'", [id]),
      pool.query("SELECT COALESCE(goruntuleme_sayisi,0) AS goruntuleme FROM esnaflar WHERE id=$1", [id]),
      pool.query("SELECT EXTRACT(HOUR FROM tarih) AS saat, COUNT(*) AS sayi FROM siparisler WHERE esnaf_id=$1 AND durum != 'iptal' AND tarih >= NOW() - INTERVAL '30 days' GROUP BY saat ORDER BY saat", [id]),
      pool.query("SELECT DATE(tarih) AS gun, COUNT(*) AS sayi, COALESCE(SUM(genel_toplam),0) AS tutar FROM siparisler WHERE esnaf_id=$1 AND durum != 'iptal' AND tarih >= NOW() - INTERVAL '7 days' GROUP BY gun ORDER BY gun", [id]),
      pool.query("SELECT teslimat_turu, COUNT(*) AS sayi FROM siparisler WHERE esnaf_id=$1 AND durum != 'iptal' GROUP BY teslimat_turu", [id]),
      pool.query("SELECT COUNT(*) AS tekrar FROM (SELECT musteri_telefon FROM siparisler WHERE esnaf_id=$1 AND durum != 'iptal' AND musteri_telefon IS NOT NULL GROUP BY musteri_telefon HAVING COUNT(*) > 1) t", [id]),
      pool.query("SELECT urunler FROM siparisler WHERE esnaf_id=$1 AND durum != 'iptal'", [id])
    ]);

    // En çok satanlar
    var urunSayilari = {};
    tumSiparisler.rows.forEach(function(s) {
      var urunler = Array.isArray(s.urunler) ? s.urunler : (typeof s.urunler === 'string' ? JSON.parse(s.urunler || '[]') : []);
      urunler.forEach(function(u) {
        if (!u.ad) return;
        urunSayilari[u.ad] = (urunSayilari[u.ad] || 0) + (parseInt(u.adet) || 1);
      });
    });
    var enCokSatanlar = Object.keys(urunSayilari)
      .map(function(ad) { return { ad: ad, adet: urunSayilari[ad] }; })
      .sort(function(a, b) { return b.adet - a.adet; })
      .slice(0, 5);

    // Saatlik dağılım — 0-23 her saat için
    var saatlik = Array.from({ length: 24 }, function(_, i) { return { saat: i, sayi: 0 }; });
    saatlikRes.rows.forEach(function(r) { saatlik[parseInt(r.saat)].sayi = parseInt(r.sayi); });

    // Son 7 gün — boş günleri de doldur
    var yediGun = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var key = d.toISOString().slice(0, 10);
      var bulunan = yediGunRes.rows.find(function(r) { return r.gun && r.gun.toISOString().slice(0, 10) === key; });
      yediGun.push({ gun: key, sayi: bulunan ? parseInt(bulunan.sayi) : 0, tutar: bulunan ? parseFloat(bulunan.tutar) : 0 });
    }

    // Teslimat türü
    var teslimat = {};
    teslimatRes.rows.forEach(function(r) { teslimat[r.teslimat_turu] = parseInt(r.sayi); });

    res.json({
      basari: true,
      veri: {
        hafta:  { sayi: parseInt(haftaRes.rows[0].sayi), tutar: parseFloat(haftaRes.rows[0].tutar) },
        ay:     { sayi: parseInt(ayRes.rows[0].sayi), tutar: parseFloat(ayRes.rows[0].tutar), ort_tutar: Math.round(parseFloat(ayRes.rows[0].ort)) },
        toplam: { sayi: parseInt(toplamRes.rows[0].sayi), tutar: parseFloat(toplamRes.rows[0].tutar) },
        goruntuleme: parseInt(goruntulemeRes.rows[0]?.goruntuleme || 0),
        en_cok_satanlar: enCokSatanlar,
        saatlik_dagilim: saatlik,
        yedi_gun: yediGun,
        teslimat_dagilim: teslimat,
        tekrar_musteri: parseInt(tekrarRes.rows[0]?.tekrar || 0)
      }
    });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

async function esnafDogrula(id, res) {
  var r = await pool.query('SELECT id FROM esnaflar WHERE id=$1', [id]);
  if (!r.rows.length) { res.status(404).json({ basari: false, mesaj: 'Esnaf bulunamadi' }); return false; }
  return true;
}

app.post('/api/esnaf-panel/:id/kampanya', async function(req, res) {
  try {
    if (!await esnafDogrula(req.params.id, res)) return;
    var { baslik, aciklama, indirim_orani, bitis_tarihi } = req.body;
    if (!baslik) return res.status(400).json({ basari: false, mesaj: 'Baslik zorunlu' });
    var result = await pool.query(
      'INSERT INTO kampanyalar (esnaf_id,baslik,aciklama,indirim_orani,bitis_tarihi,aktif) VALUES ($1,$2,$3,$4,$5,true) RETURNING *',
      [req.params.id, baslik, aciklama||null, parseInt(indirim_orani)||0, bitis_tarihi||null]
    );
    cacheSil('esnaf_detay:' + req.params.id);
    res.json({ basari: true, veri: result.rows[0] });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.delete('/api/esnaf-panel/:id/kampanya/:kampanya_id', async function(req, res) {
  try {
    if (!await esnafDogrula(req.params.id, res)) return;
    await pool.query('DELETE FROM kampanyalar WHERE id=$1 AND esnaf_id=$2', [req.params.kampanya_id, req.params.id]);
    cacheSil('esnaf_detay:' + req.params.id);
    res.json({ basari: true, mesaj: 'Kampanya silindi.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.put('/api/esnaf-panel/:id/calisma-saatleri', async function(req, res) {
  try {
    if (!await esnafDogrula(req.params.id, res)) return;
    var saatler = req.body.calisma_saatleri;
    if (!saatler || typeof saatler !== 'object') return res.status(400).json({ basari: false, mesaj: 'Gecersiz veri' });
    await pool.query('UPDATE esnaflar SET calisma_saatleri=$1 WHERE id=$2', [JSON.stringify(saatler), req.params.id]);
    cacheSil('esnaf_detay:' + req.params.id);
    cacheSil('esnaflar:');
    res.json({ basari: true, mesaj: 'Calisma saatleri guncellendi.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// =============================================================
// RANDEVU SİSTEMİ
// =============================================================

// Randevu ayarları al
app.get('/api/esnaf-panel/:id/randevu-ayar', async function(req, res) {
  try {
    if (!await esnafDogrula(req.params.id, res)) return;
    var r = await pool.query('SELECT randevu_modu, slot_suresi, calisma_saatleri, indirimli_saatler FROM esnaflar WHERE id=$1', [req.params.id]);
    res.json({ basari: true, veri: r.rows[0] });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Randevu ayarları güncelle (modu aç/kapat, slot süresi, indirimli saatler)
app.put('/api/esnaf-panel/:id/randevu-ayar', async function(req, res) {
  try {
    if (!await esnafDogrula(req.params.id, res)) return;
    var { randevu_modu, slot_suresi, indirimli_saatler } = req.body;
    await pool.query(
      'UPDATE esnaflar SET randevu_modu=$1, slot_suresi=$2, indirimli_saatler=$3 WHERE id=$4',
      [!!randevu_modu, parseInt(slot_suresi) || 30, JSON.stringify(indirimli_saatler || {}), req.params.id]
    );
    cacheSil('esnaf_detay:' + req.params.id);
    res.json({ basari: true, mesaj: 'Randevu ayarlari guncellendi.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Hizmetleri listele
app.get('/api/esnaf-panel/:id/hizmetler', async function(req, res) {
  try {
    if (!await esnafDogrula(req.params.id, res)) return;
    var r = await pool.query('SELECT * FROM hizmetler WHERE esnaf_id=$1 ORDER BY id', [req.params.id]);
    res.json({ basari: true, veri: r.rows });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Hizmet ekle
app.post('/api/esnaf-panel/:id/hizmet', async function(req, res) {
  try {
    if (!await esnafDogrula(req.params.id, res)) return;
    var { ad, sure, fiyat, aciklama } = req.body;
    if (!ad) return res.status(400).json({ basari: false, mesaj: 'Hizmet adi gerekli.' });
    var r = await pool.query(
      'INSERT INTO hizmetler (esnaf_id, ad, sure, fiyat, aciklama) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.params.id, ad, parseInt(sure)||30, parseFloat(fiyat)||0, aciklama||null]
    );
    res.json({ basari: true, veri: r.rows[0] });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Hizmet güncelle
app.put('/api/esnaf-panel/:id/hizmet/:hizmet_id', async function(req, res) {
  try {
    if (!await esnafDogrula(req.params.id, res)) return;
    var { ad, sure, fiyat, aciklama, aktif } = req.body;
    var r = await pool.query(
      'UPDATE hizmetler SET ad=$1, sure=$2, fiyat=$3, aciklama=$4, aktif=$5 WHERE id=$6 AND esnaf_id=$7 RETURNING *',
      [ad, parseInt(sure)||30, parseFloat(fiyat)||0, aciklama||null, aktif !== false, req.params.hizmet_id, req.params.id]
    );
    res.json({ basari: true, veri: r.rows[0] });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Hizmet sil
app.delete('/api/esnaf-panel/:id/hizmet/:hizmet_id', async function(req, res) {
  try {
    if (!await esnafDogrula(req.params.id, res)) return;
    await pool.query('DELETE FROM hizmetler WHERE id=$1 AND esnaf_id=$2', [req.params.hizmet_id, req.params.id]);
    res.json({ basari: true, mesaj: 'Hizmet silindi.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Müşteri için: esnaf hizmetlerini al (public)
app.get('/api/esnaf/:id/hizmetler', async function(req, res) {
  try {
    var r = await pool.query('SELECT * FROM hizmetler WHERE esnaf_id=$1 AND aktif=true ORDER BY id', [req.params.id]);
    res.json({ basari: true, veri: r.rows });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Müsait slotları hesapla: GET /api/esnaf/:id/musait-slotlar?tarih=2024-01-15&hizmet_id=1
app.get('/api/esnaf/:id/musait-slotlar', async function(req, res) {
  try {
    var { tarih, hizmet_id } = req.query;
    if (!tarih) return res.status(400).json({ basari: false, mesaj: 'tarih gerekli.' });

    var esnaf = await pool.query('SELECT randevu_modu, slot_suresi, calisma_saatleri, indirimli_saatler FROM esnaflar WHERE id=$1', [req.params.id]);
    if (!esnaf.rows[0] || !esnaf.rows[0].randevu_modu) {
      return res.json({ basari: false, mesaj: 'Bu esnafta randevu sistemi aktif degil.' });
    }

    var slotSuresi = esnaf.rows[0].slot_suresi || 30;
    var calismaSaatleri = esnaf.rows[0].calisma_saatleri;
    var indirimliSaatler = esnaf.rows[0].indirimli_saatler || {};

    // Hizmet varsa kendi süresini kullan
    if (hizmet_id) {
      var hizmet = await pool.query('SELECT sure FROM hizmetler WHERE id=$1 AND esnaf_id=$2 AND aktif=true', [hizmet_id, req.params.id]);
      if (hizmet.rows[0]) slotSuresi = hizmet.rows[0].sure;
    }

    // O gün için çalışma saatlerini bul
    var gun = new Date(tarih).toLocaleDateString('tr-TR', { weekday: 'long' }).toLowerCase();
    var gunMap = { 'pazartesi':'pazartesi','salı':'sali','çarşamba':'carsamba','perşembe':'persembe','cuma':'cuma','cumartesi':'cumartesi','pazar':'pazar' };
    var gunKey = gunMap[gun] || gun;

    var baslangic = '09:00';
    var bitis = '18:00';
    if (calismaSaatleri && calismaSaatleri[gunKey]) {
      var gs = calismaSaatleri[gunKey];
      if (gs.kapali) return res.json({ basari: true, veri: [] });
      if (gs.baslangic) baslangic = gs.baslangic;
      else if (gs.acilis) baslangic = gs.acilis;
      if (gs.bitis) bitis = gs.bitis;
      else if (gs.kapanis) bitis = gs.kapanis;
    }

    // Mevcut randevuları çek
    var mevcutlar = await pool.query(
      "SELECT saat, sure FROM randevular WHERE esnaf_id=$1 AND tarih=$2 AND durum NOT IN ('iptal')",
      [req.params.id, tarih]
    );

    // Dolu zaman dilimlerini hesapla (dakika cinsinden)
    var doluDilimler = mevcutlar.rows.map(function(r) {
      var parcalar = r.saat.split(':');
      var basDk = parseInt(parcalar[0]) * 60 + parseInt(parcalar[1]);
      return { basDk: basDk, bitisDk: basDk + (r.sure || slotSuresi) };
    });

    // Tüm slotları üret
    var basDk = parseInt(baslangic.split(':')[0]) * 60 + parseInt(baslangic.split(':')[1]);
    var bitisDk = parseInt(bitis.split(':')[0]) * 60 + parseInt(bitis.split(':')[1]);
    var slotlar = [];
    var simdi = new Date();
    var bugun = simdi.toISOString().split('T')[0];

    for (var dk = basDk; dk + slotSuresi <= bitisDk; dk += slotSuresi) {
      // Geçmiş slotları atla
      if (tarih === bugun && dk <= simdi.getHours() * 60 + simdi.getMinutes()) continue;

      var musait = !doluDilimler.some(function(d) {
        return dk < d.bitisDk && dk + slotSuresi > d.basDk;
      });

      var saat = String(Math.floor(dk / 60)).padStart(2, '0') + ':' + String(dk % 60).padStart(2, '0');
      var saat_no = String(Math.floor(dk / 60));
      var indirim = indirimliSaatler[saat_no] ? parseInt(indirimliSaatler[saat_no]) : 0;
      slotlar.push({ saat: saat, musait: musait, indirim: indirim });
    }

    res.json({ basari: true, veri: slotlar });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Randevu oluştur
app.post('/api/randevu', async function(req, res) {
  try {
    var { esnaf_id, musteri_telefon, musteri_ad, hizmet_id, tarih, saat, notlar } = req.body;
    if (!esnaf_id || !musteri_telefon || !musteri_ad || !tarih || !saat) {
      return res.status(400).json({ basari: false, mesaj: 'Eksik bilgi.' });
    }

    var esnaf = await pool.query('SELECT ad, telefon, randevu_modu, slot_suresi FROM esnaflar WHERE id=$1', [esnaf_id]);
    if (!esnaf.rows[0] || !esnaf.rows[0].randevu_modu) {
      return res.status(400).json({ basari: false, mesaj: 'Randevu sistemi aktif degil.' });
    }

    var sure = esnaf.rows[0].slot_suresi || 30;
    var hizmetAd = '';
    if (hizmet_id) {
      var hizmet = await pool.query('SELECT ad, sure FROM hizmetler WHERE id=$1 AND esnaf_id=$2 AND aktif=true', [hizmet_id, esnaf_id]);
      if (hizmet.rows[0]) { sure = hizmet.rows[0].sure; hizmetAd = hizmet.rows[0].ad; }
    }

    // Çakışma kontrolü
    var cakisma = await pool.query(
      `SELECT id FROM randevular WHERE esnaf_id=$1 AND tarih=$2 AND durum NOT IN ('iptal') AND saat < ($3::time + ($4 || ' minutes')::interval) AND (saat + (sure || ' minutes')::interval) > $3::time`,
      [esnaf_id, tarih, saat, sure]
    );

    if (cakisma.rows.length > 0) {
      // Bekleme listesine ekle
      await pool.query(
        'INSERT INTO bekleme_listesi (esnaf_id, musteri_telefon, musteri_ad, hizmet_id, tarih) VALUES ($1,$2,$3,$4,$5)',
        [esnaf_id, telefonNormalize(musteri_telefon), musteri_ad, hizmet_id||null, tarih]
      );
      return res.json({ basari: false, bekleme: true, mesaj: 'Bu saat dolu. Bekleme listesine eklendiniz.' });
    }

    var r = await pool.query(
      'INSERT INTO randevular (esnaf_id, musteri_telefon, musteri_ad, hizmet_id, tarih, saat, sure, notlar) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [esnaf_id, telefonNormalize(musteri_telefon), musteri_ad, hizmet_id||null, tarih, saat, sure, notlar||null]
    );
    var randevu = r.rows[0];

    // WhatsApp bildirimleri
    var tarihStr = new Date(tarih).toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' });
    var musterMesaj = `✅ Randevunuz Onaylandı!\n\n📅 Tarih: ${tarihStr}\n🕐 Saat: ${saat}\n💼 Hizmet: ${hizmetAd || 'Genel'}\n🏪 İşletme: ${esnaf.rows[0].ad}\n\nRandevunuzu iptal etmek için: ${process.env.APP_URL || 'yakinda-ne-var.com'}/randevularim`;
    var esnafMesaj = `📅 Yeni Randevu!\n\n👤 Müşteri: ${musteri_ad}\n📞 Telefon: ${musteri_telefon}\n🕐 Tarih/Saat: ${tarihStr} - ${saat}\n💼 Hizmet: ${hizmetAd || 'Genel'}\n${notlar ? '📝 Not: ' + notlar : ''}`;

    Promise.all([
      whatsappGonder(musteri_telefon, musterMesaj).catch(function() {}),
      esnaf.rows[0].telefon ? whatsappGonder(esnaf.rows[0].telefon, esnafMesaj).catch(function() {}) : Promise.resolve()
    ]);

    res.json({ basari: true, veri: randevu, mesaj: 'Randevu olusturuldu.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Müşterinin randevularını listele
app.get('/api/randevularim', async function(req, res) {
  try {
    var rawTel = req.query.telefon;
    if (!rawTel) return res.status(400).json({ basari: false, mesaj: 'Telefon gerekli.' });
    var telefon = telefonNormalize(rawTel);
    var r = await pool.query(
      `SELECT r.*, e.ad as esnaf_adi, h.ad as hizmet_adi
       FROM randevular r
       LEFT JOIN esnaflar e ON e.id = r.esnaf_id
       LEFT JOIN hizmetler h ON h.id = r.hizmet_id
       WHERE r.musteri_telefon=$1
       ORDER BY r.tarih DESC, r.saat DESC`,
      [telefon]
    );
    res.json({ basari: true, veri: r.rows });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Randevu iptal (müşteri)
app.put('/api/randevu/:id/iptal', async function(req, res) {
  try {
    var { musteri_telefon } = req.body;
    if (!musteri_telefon) return res.status(400).json({ basari: false, mesaj: 'Telefon gerekli.' });
    var telefon = telefonNormalize(musteri_telefon);

    var r = await pool.query(
      "UPDATE randevular SET durum='iptal' WHERE id=$1 AND musteri_telefon=$2 AND durum NOT IN ('iptal','tamamlandi') RETURNING *, (SELECT ad FROM esnaflar WHERE id=randevular.esnaf_id) as esnaf_adi",
      [req.params.id, telefon]
    );
    if (!r.rows[0]) return res.status(404).json({ basari: false, mesaj: 'Randevu bulunamadi.' });

    var randevu = r.rows[0];

    // Bekleme listesindeki ilk kişiye bildir
    var bekleyen = await pool.query(
      'SELECT * FROM bekleme_listesi WHERE esnaf_id=$1 AND tarih=$2 ORDER BY olusturma LIMIT 1',
      [randevu.esnaf_id, randevu.tarih]
    );
    if (bekleyen.rows[0]) {
      var b = bekleyen.rows[0];
      await pool.query('DELETE FROM bekleme_listesi WHERE id=$1', [b.id]);
      var tarihStr = new Date(randevu.tarih).toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' });
      whatsappGonder(b.musteri_telefon, `🎉 Müjde! ${randevu.esnaf_adi} için ${tarihStr} tarihinde ${randevu.saat} saatinde bir slot açıldı. Hemen rezervasyon yapın!`).catch(function() {});
    }

    res.json({ basari: true, mesaj: 'Randevu iptal edildi.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Randevu yeniden planla (müşteri)
app.put('/api/randevu/:id/yeniden-planla', async function(req, res) {
  try {
    var { musteri_telefon, tarih, saat } = req.body;
    if (!musteri_telefon || !tarih || !saat) return res.status(400).json({ basari: false, mesaj: 'Eksik bilgi.' });
    var telefon = telefonNormalize(musteri_telefon);

    var mevcut = await pool.query(
      "SELECT * FROM randevular WHERE id=$1 AND musteri_telefon=$2 AND durum NOT IN ('iptal','tamamlandi')",
      [req.params.id, telefon]
    );
    if (!mevcut.rows[0]) return res.status(404).json({ basari: false, mesaj: 'Randevu bulunamadi.' });

    var randevu = mevcut.rows[0];

    // Çakışma kontrolü (yeni tarih/saat için)
    var cakisma = await pool.query(
      `SELECT id FROM randevular WHERE esnaf_id=$1 AND tarih=$2 AND id<>$3 AND durum NOT IN ('iptal') AND saat < ($4::time + ($5 || ' minutes')::interval) AND (saat + (sure || ' minutes')::interval) > $4::time`,
      [randevu.esnaf_id, tarih, req.params.id, saat, randevu.sure]
    );
    if (cakisma.rows.length > 0) return res.status(400).json({ basari: false, mesaj: 'Secilen saat dolu.' });

    await pool.query('UPDATE randevular SET tarih=$1, saat=$2 WHERE id=$3', [tarih, saat, req.params.id]);

    var esnaf = await pool.query('SELECT ad, telefon FROM esnaflar WHERE id=$1', [randevu.esnaf_id]);
    var tarihStr = new Date(tarih).toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' });
    var musterMesaj = `🔄 Randevunuz Yeniden Planlandı!\n\n📅 Yeni Tarih: ${tarihStr}\n🕐 Yeni Saat: ${saat}\n🏪 İşletme: ${esnaf.rows[0].ad}`;
    whatsappGonder(musteri_telefon, musterMesaj).catch(function() {});
    if (esnaf.rows[0].telefon) {
      whatsappGonder(esnaf.rows[0].telefon, `🔄 Randevu Değişikliği!\n\n👤 Müşteri: ${randevu.musteri_ad}\n📅 Yeni Tarih: ${tarihStr}\n🕐 Yeni Saat: ${saat}`).catch(function() {});
    }

    res.json({ basari: true, mesaj: 'Randevu yeniden planlanadi.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Esnaf paneli: tüm randevuları görüntüle
app.get('/api/esnaf-panel/:id/randevular', async function(req, res) {
  try {
    if (!await esnafDogrula(req.params.id, res)) return;
    var { tarih } = req.query;
    var query = `SELECT r.*, h.ad as hizmet_adi FROM randevular r LEFT JOIN hizmetler h ON h.id=r.hizmet_id WHERE r.esnaf_id=$1`;
    var params = [req.params.id];
    if (tarih) { query += ' AND r.tarih=$2'; params.push(tarih); }
    query += ' ORDER BY r.tarih DESC, r.saat';
    var r = await pool.query(query, params);
    res.json({ basari: true, veri: r.rows });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Esnaf paneli: randevu durumu güncelle
app.put('/api/esnaf-panel/:id/randevu/:randevu_id/durum', async function(req, res) {
  try {
    if (!await esnafDogrula(req.params.id, res)) return;
    var { durum } = req.body;
    var gecerliDurumlar = ['bekliyor', 'onaylandi', 'tamamlandi', 'iptal'];
    if (!gecerliDurumlar.includes(durum)) return res.status(400).json({ basari: false, mesaj: 'Gecersiz durum.' });

    var r = await pool.query(
      'UPDATE randevular SET durum=$1 WHERE id=$2 AND esnaf_id=$3 RETURNING *',
      [durum, req.params.randevu_id, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ basari: false, mesaj: 'Randevu bulunamadi.' });

    // Müşteriyi bildir (onaylandı durumunda)
    if (durum === 'onaylandi') {
      var randevu = r.rows[0];
      var esnaf = await pool.query('SELECT ad FROM esnaflar WHERE id=$1', [req.params.id]);
      var tarihStr = new Date(randevu.tarih).toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' });
      whatsappGonder(randevu.musteri_telefon, `✅ Randevunuz onaylandı!\n\n📅 ${tarihStr} - ${randevu.saat}\n🏪 ${esnaf.rows[0].ad}`).catch(function() {});
    }

    res.json({ basari: true, mesaj: 'Durum guncellendi.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Randevu hatırlatma scheduler — her 10 dakikada bir çalışır
async function randevuHatirlatmaCalistir() {
  try {
    // 1 saat sonraki randevuları bul (±10 dk pencere)
    var r = await pool.query(`
      SELECT rn.*, e.ad as esnaf_adi, e.telefon as esnaf_telefon
      FROM randevular rn
      JOIN esnaflar e ON e.id = rn.esnaf_id
      WHERE rn.durum IN ('bekliyor','onaylandi')
        AND rn.hatirlatma_gonderildi IS NOT TRUE
        AND (rn.tarih + rn.saat::time) BETWEEN NOW() + INTERVAL '50 minutes' AND NOW() + INTERVAL '70 minutes'
    `);
    for (var randevu of r.rows) {
      var tarihStr = new Date(randevu.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
      // Müşteriye hatırlatma
      if (randevu.musteri_telefon) {
        await whatsappGonder(randevu.musteri_telefon,
          `⏰ Randevu Hatırlatması!\n\n📅 Tarih: ${tarihStr}\n🕐 Saat: ${randevu.saat}\n🏪 İşletme: ${randevu.esnaf_adi}\n\nRandevunuz 1 saat içinde! Görüşürüz 🙌`
        ).catch(function() {});
      }
      // Esnafa hatırlatma
      if (randevu.esnaf_telefon) {
        await whatsappGonder(randevu.esnaf_telefon,
          `📋 1 Saat Sonra Randevu!\n\n👤 Müşteri: ${randevu.musteri_ad}\n📅 ${tarihStr} - ${randevu.saat}\n💼 Hizmet: ${randevu.hizmet_id ? 'ID:' + randevu.hizmet_id : 'Genel'}`
        ).catch(function() {});
      }
      // Tekrar gönderilmemesi için işaretle
      await pool.query('UPDATE randevular SET hatirlatma_gonderildi=true WHERE id=$1', [randevu.id]);
      console.log('Randevu hatirlatmasi gonderildi: randevu#' + randevu.id);
    }
  } catch (err) {
    console.error('Randevu hatirlatma hatasi:', err.message);
  }
}

tablolarOlustur().then(async function() {
  // hatirlatma_gonderildi kolonu ekle (varsa hata vermez)
  await pool.query('ALTER TABLE randevular ADD COLUMN IF NOT EXISTS hatirlatma_gonderildi BOOLEAN DEFAULT false').catch(function() {});
  app.listen(3000, function() {
    console.log('API calisiyor: http://localhost:3000');
    // Randevu hatırlatıcıyı başlat (10 dk aralıkla)
    setInterval(randevuHatirlatmaCalistir, 10 * 60 * 1000);
    // Sunucu açılışında bir kez hemen çalıştır
    randevuHatirlatmaCalistir();
  });
}).catch(function(err) {
  console.error('Veritabani hatasi:', err);
  process.exit(1);
});