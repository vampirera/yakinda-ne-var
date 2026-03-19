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

function whatsappGonder(telefon, mesaj) {
  if (!telefon || !process.env.TWILIO_WHATSAPP_FROM) return;
  var to = telefon.startsWith('whatsapp:') ? telefon : 'whatsapp:' + telefon;
  twilioClient.messages.create({ from: process.env.TWILIO_WHATSAPP_FROM, to: to, body: mesaj })
    .then(function(m) { console.log('[WhatsApp] Gönderildi:', m.sid); })
    .catch(function(e) { console.log('[WhatsApp] Hata:', e.message); });
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

app.get('/', function(req, res) { res.json({ mesaj: 'Yakinda Ne Var API calisiyor!', versiyon: '4.2' }); });

app.get('/api/esnaflar', async function(req, res) {
  try {
    var ilce = req.query.ilce, kategori = req.query.kategori, siralama = req.query.siralama || 'mesafe';
    var lat = parseFloat(req.query.lat), lng = parseFloat(req.query.lng);
    var arama = req.query.arama ? req.query.arama.toLowerCase() : null;
    var query = `SELECT e.*, json_agg(DISTINCT jsonb_build_object('id',u.id,'ad',u.ad,'fiyat',u.fiyat,'aciklama',u.aciklama,'fotograf_url',u.fotograf_url)) FILTER (WHERE u.id IS NOT NULL) as urunler FROM esnaflar e LEFT JOIN urunler u ON e.id=u.esnaf_id WHERE e.onaylandi=true`;
    var params = [], pi = 1;
    if (ilce) { query += ' AND LOWER(e.ilce)=$'+pi; params.push(ilce.toLowerCase()); pi++; }
    if (kategori) { query += ' AND e.kategori=$'+pi; params.push(kategori); pi++; }
    if (arama) { query += ' AND (LOWER(e.ad) LIKE $'+pi+' OR LOWER(e.kategori) LIKE $'+pi+' OR EXISTS (SELECT 1 FROM urunler u2 WHERE u2.esnaf_id=e.id AND LOWER(u2.ad) LIKE $'+pi+'))'; params.push('%'+arama+'%'); pi++; }
    query += ' GROUP BY e.id';
    var result = await pool.query(query, params);
    var esnaflar = result.rows.map(function(e) {
      e.urunler = e.urunler || [];
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
    var result = await pool.query(`SELECT e.*, json_agg(DISTINCT jsonb_build_object('id',u.id,'ad',u.ad,'fiyat',u.fiyat,'aciklama',u.aciklama,'fotograf_url',u.fotograf_url)) FILTER (WHERE u.id IS NOT NULL) as urunler, json_agg(DISTINCT jsonb_build_object('id',y.id,'kullanici',y.kullanici,'puan',y.puan,'yorum',y.yorum,'tarih',y.tarih)) FILTER (WHERE y.id IS NOT NULL) as yorumlar FROM esnaflar e LEFT JOIN urunler u ON e.id=u.esnaf_id LEFT JOIN yorumlar y ON e.id=y.esnaf_id WHERE e.id=$1 GROUP BY e.id`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ basari: false, mesaj: 'Esnaf bulunamadi' });
    var e = result.rows[0];
    e.urunler = e.urunler || []; e.yorumlar = e.yorumlar || [];
    var lat = parseFloat(req.query.lat), lng = parseFloat(req.query.lng);
    if (lat && lng) { var km = mesafeHesapla(lat, lng, parseFloat(e.lat), parseFloat(e.lng)); e.mesafe_km = Math.round(km*10)/10; e.mesafe_text = km < 1 ? Math.round(km*1000)+'m' : km.toFixed(1)+'km'; }
    res.json({ basari: true, veri: e });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.post('/api/esnaf-kayit', upload.fields([{name:'vergi_levhasi',maxCount:1},{name:'urun_fotograflari',maxCount:10}]), async function(req, res) {
  try {
    var body = req.body;
    if (!body.ad||!body.kategori||!body.ilce||!body.telefon||!body.vergi_no) return res.status(400).json({ basari: false, mesaj: 'Lutfen tum zorunlu alanlari doldurun' });
    var result = await pool.query('INSERT INTO esnaflar (ad,kategori,ilce,adres,telefon,email,vergi_no,lat,lng,onaylandi) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false) RETURNING id', [body.ad, body.kategori, body.ilce, body.adres||'', body.telefon, body.email||'', body.vergi_no, parseFloat(body.lat)||36.8550, parseFloat(body.lng)||28.2753]);
    var esnafId = result.rows[0].id;
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
    var waMesaj = 'Merhaba! Yakinda Ne Var uygulamasina kayit olmak istiyorum.%0A%0AIsletme: '+body.ad+'%0AKategori: '+body.kategori+'%0AIlce: '+body.ilce+'%0ATelefon: '+body.telefon+'%0AVergi No: '+body.vergi_no+'%0AKayit ID: '+esnafId;
    res.json({ basari: true, mesaj: 'Kaydiniz alindi!', kayit_id: esnafId, whatsapp_url: 'https://wa.me/905XXXXXXXXX?text='+waMesaj });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.get('/api/admin/bekleyenler', async function(req, res) {
  if (req.query.key !== 'yakinda2024') return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    var result = await pool.query(`SELECT e.*, json_agg(DISTINCT jsonb_build_object('id',u.id,'ad',u.ad,'fiyat',u.fiyat,'fotograf_url',u.fotograf_url)) FILTER (WHERE u.id IS NOT NULL) as urunler FROM esnaflar e LEFT JOIN urunler u ON e.id=u.esnaf_id WHERE e.onaylandi=false GROUP BY e.id ORDER BY e.kayit_tarihi DESC`);
    res.json({ basari: true, veri: result.rows });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.get('/api/admin/aktifler', async function(req, res) {
  if (req.query.key !== 'yakinda2024') return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    var result = await pool.query('SELECT * FROM esnaflar ORDER BY kayit_tarihi DESC');
    res.json({ basari: true, veri: result.rows });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.post('/api/admin/onayla/:id', async function(req, res) {
  if (req.body.key !== 'yakinda2024') return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    await pool.query('UPDATE esnaflar SET onaylandi=true WHERE id=$1', [req.params.id]);
    res.json({ basari: true, mesaj: 'Esnaf onaylandi!' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.post('/api/admin/pasif/:id', async function(req, res) {
  if (req.body.key !== 'yakinda2024') return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    await pool.query('UPDATE esnaflar SET onaylandi=false WHERE id=$1', [req.params.id]);
    res.json({ basari: true, mesaj: 'Esnaf yayindan kaldirildi.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.post('/api/admin/aktif/:id', async function(req, res) {
  if (req.body.key !== 'yakinda2024') return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    await pool.query('UPDATE esnaflar SET onaylandi=true WHERE id=$1', [req.params.id]);
    res.json({ basari: true, mesaj: 'Esnaf yayina alindi!' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.delete('/api/admin/reddet/:id', async function(req, res) {
  if (req.query.key !== 'yakinda2024') return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    await pool.query('DELETE FROM urunler WHERE esnaf_id=$1', [req.params.id]);
    await pool.query('DELETE FROM esnaflar WHERE id=$1', [req.params.id]);
    res.json({ basari: true, mesaj: 'Esnaf reddedildi.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.delete('/api/admin/sil/:id', async function(req, res) {
  if (req.query.key !== 'yakinda2024') return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    await pool.query('DELETE FROM urunler WHERE esnaf_id=$1', [req.params.id]);
    await pool.query('DELETE FROM yorumlar WHERE esnaf_id=$1', [req.params.id]);
    await pool.query('DELETE FROM esnaflar WHERE id=$1', [req.params.id]);
    res.json({ basari: true, mesaj: 'Esnaf silindi.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Kurye kayıt
app.post('/api/kurye-kayit', async function(req, res) {
  try {
    var { ad, telefon, arac_tipi, ilce } = req.body;
    if (!ad || !telefon || !arac_tipi || !ilce) return res.status(400).json({ basari: false, mesaj: 'Tum alanlar zorunlu' });
    await pool.query('INSERT INTO kuryeler (ad,telefon,arac_tipi,ilce) VALUES ($1,$2,$3,$4)', [ad, telefon, arac_tipi, ilce]);

    // Admine bildirim
    if (process.env.ADMIN_TELEFON) {
      whatsappGonder(process.env.ADMIN_TELEFON, '🛵 Yeni kurye başvurusu: ' + ad + ', ' + ilce + ', ' + arac_tipi);
    }

    res.json({ basari: true, mesaj: 'Basvuru alindi.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Admin kurye listesi
app.get('/api/admin/kuryeler', async function(req, res) {
  if (req.query.key !== 'yakinda2024') return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    var result = await pool.query('SELECT * FROM kuryeler ORDER BY kayit_tarihi DESC');
    res.json({ basari: true, veri: result.rows });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Admin kurye onayla
app.post('/api/admin/kurye-onayla/:id', async function(req, res) {
  if (req.body.key !== 'yakinda2024') return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    await pool.query('UPDATE kuryeler SET onaylandi=true WHERE id=$1', [req.params.id]);
    res.json({ basari: true, mesaj: 'Kurye onaylandi.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

// Admin kurye sil
app.delete('/api/admin/kurye-sil/:id', async function(req, res) {
  if (req.query.key !== 'yakinda2024') return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
  try {
    await pool.query('DELETE FROM kuryeler WHERE id=$1', [req.params.id]);
    res.json({ basari: true, mesaj: 'Kurye silindi.' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.post('/api/esnaflar/:id/urunler', async function(req, res) {
  try {
    var result = await pool.query('INSERT INTO urunler (esnaf_id,ad,fiyat,aciklama) VALUES ($1,$2,$3,$4) RETURNING *', [req.params.id, req.body.ad, parseFloat(req.body.fiyat), req.body.aciklama||'']);
    res.json({ basari: true, veri: result.rows[0] });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.post('/api/esnaflar/:id/yorumlar', async function(req, res) {
  try {
    await pool.query('INSERT INTO yorumlar (esnaf_id,kullanici,puan,yorum) VALUES ($1,$2,$3,$4)', [req.params.id, req.body.kullanici, parseInt(req.body.puan), req.body.yorum]);
    var yorumlar = await pool.query('SELECT puan FROM yorumlar WHERE esnaf_id=$1', [req.params.id]);
    var toplam = yorumlar.rows.reduce(function(t,y){return t+y.puan;},0);
    var ort = Math.round((toplam/yorumlar.rows.length)*10)/10;
    await pool.query('UPDATE esnaflar SET puan=$1, yorum_sayisi=$2 WHERE id=$3', [ort, yorumlar.rows.length, req.params.id]);
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

app.get('/api/siparisler/:id', async function(req, res) {
  try {
    var result = await pool.query('SELECT * FROM siparisler WHERE id=$1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ basari: false, mesaj: 'Siparis bulunamadi' });
    res.json({ basari: true, veri: result.rows[0] });
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
    var result = await pool.query('SELECT * FROM siparisler ORDER BY tarih DESC');
    res.json({ basari: true, veri: result.rows });
  } catch(err) { res.status(500).json({ basari: false, mesaj: err.message }); }
});

app.put('/api/siparisler/:id/durum', async function(req, res) {
  try {
    await pool.query('UPDATE siparisler SET durum=$1 WHERE id=$2', [req.body.durum, req.params.id]);
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

app.get('/api/ilceler', function(req, res) {
  res.json({ basari: true, veri: ['Marmaris','Bodrum','Fethiye','Datca','Milas','Mugla Merkez'] });
});

tablolarOlustur().then(function() {
  app.listen(3000, function() { console.log('API calisiyor: http://localhost:3000'); });
}).catch(function(err) {
  console.error('Veritabani hatasi:', err);
  process.exit(1);
});