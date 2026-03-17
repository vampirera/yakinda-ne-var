const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
  await pool.query(`CREATE TABLE IF NOT EXISTS siparisler (id SERIAL PRIMARY KEY, esnaf_id INTEGER, esnaf_adi VARCHAR(255), urunler JSONB, teslimat_turu VARCHAR(50), adres TEXT, ara_toplam DECIMAL(10,2), kurye_ucreti DECIMAL(10,2), komisyon DECIMAL(10,2), genel_toplam DECIMAL(10,2), durum VARCHAR(50) DEFAULT 'bekliyor', tarih TIMESTAMP DEFAULT NOW())`);

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
    var result = await pool.query('INSERT INTO siparisler (esnaf_id,esnaf_adi,urunler,teslimat_turu,adres,ara_toplam,kurye_ucreti,komisyon,genel_toplam) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [req.body.esnaf_id, esnaf.rows[0].ad, JSON.stringify(req.body.urunler), req.body.teslimat_turu||'gel-al', req.body.adres||'', toplam, kurye, komisyon, toplam+kurye+komisyon]);
    res.json({ basari: true, veri: result.rows[0] });
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
    var mimeType = req.file.mimetype || 'image/jpeg';
    fs.unlink(req.file.path, function(){});

    var kategori = null, anahtarKelimeler = [];
    try {
      var claudeRes = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: base64Image }
            },
            {
              type: 'text',
              text: "Bu fotografta ne goruyorsun? Turkiye'deki bir yerel pazar uygulamasi icin, bu fotograf hangi esnaf kategorisine uyar? Sadece JSON dondur: {\"kategori\": \"yemek\" veya \"urun\" veya \"hizmet\" veya \"tumu\", \"anahtar_kelimeler\": [\"kelime1\",\"kelime2\"]}"
            }
          ]
        }]
      });
      var textBlok = claudeRes.content.find(function(b){ return b.type === 'text'; });
      if (textBlok) {
        var jsonEslesmesi = textBlok.text.match(/\{[\s\S]*\}/);
        if (jsonEslesmesi) {
          var parsed = JSON.parse(jsonEslesmesi[0]);
          kategori = parsed.kategori && parsed.kategori !== 'tumu' ? parsed.kategori : null;
          anahtarKelimeler = parsed.anahtar_kelimeler || [];
        }
      }
    } catch(claudeErr) { console.log('Claude hatasi:', claudeErr.message); }

    var query = `SELECT e.*, json_agg(DISTINCT jsonb_build_object('id',u.id,'ad',u.ad,'fiyat',u.fiyat,'fotograf_url',u.fotograf_url)) FILTER (WHERE u.id IS NOT NULL) as urunler FROM esnaflar e LEFT JOIN urunler u ON e.id=u.esnaf_id WHERE e.onaylandi=true`;
    var params = [];
    if (kategori) { query += ' AND e.kategori=$1'; params.push(kategori); }
    query += ' GROUP BY e.id';
    var result = await pool.query(query, params);
    res.json({ basari: true, kategori: kategori||'tumu', anahtar_kelimeler: anahtarKelimeler, mesaj: kategori?(kategori+' kategorisinde esnaflar bulundu'):'Tum esnaflar listelendi', veri: result.rows });
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