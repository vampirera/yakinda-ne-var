'use strict';
const express = require('express');
const router = express.Router();
const { pool, cacheAl, cacheKaydet, cacheSil, CACHE_TTL } = require('../db/pool');
const { esnafAuth, adminAuth } = require('../middleware/auth');
const { upload, cloudinary, openai, telefonNormalize, whatsappGonder, mesafeHesapla, esnafSil, fs } = require('../utils/helpers');
const { listeLimit } = require('../middleware/rateLimit');

router.get('/config', function(req, res) {
  var tel = (process.env.ADMIN_TELEFON || '').replace(/\D/g, '');
  if (tel.startsWith('0')) tel = '90' + tel.slice(1);
  res.json({ admin_wa: tel ? 'https://wa.me/' + tel : null });
});

router.get('/esnaflar', listeLimit, async function(req, res) {
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
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.get('/esnaflar/:id', async function(req, res) {
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
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.post('/esnaf-kayit', upload.fields([{name:'vergi_levhasi',maxCount:1},{name:'urun_fotograflari',maxCount:10}]), async function(req, res) {
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
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.get('/one-cikanlar', async function(req, res) {
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
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Admin müşteri sil
router.delete('/admin/musteri/:id', adminAuth, async function(req, res) {
  try {
    await pool.query('DELETE FROM kullanicilar WHERE id=$1 AND tip=$2', [req.params.id, 'musteri']);
    res.json({ basari: true, mesaj: 'Musteri silindi.' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.post('/esnaflar/:id/urunler', esnafAuth, async function(req, res) {
  try {
    var { ad, fiyat, aciklama } = req.body;
    if (!ad) return res.status(400).json({ basari: false, mesaj: 'Ürün adı zorunlu' });
    var result = await pool.query('INSERT INTO urunler (esnaf_id,ad,fiyat,aciklama) VALUES ($1,$2,$3,$4) RETURNING *', [req.params.id, ad, parseFloat(fiyat) || 0, aciklama || '']);
    cacheSil('esnaf_detay:' + req.params.id);
    res.json({ basari: true, veri: result.rows[0] });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.put('/esnaflar/:id/urunler/:urun_id', esnafAuth, async function(req, res) {
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
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.delete('/esnaflar/:id/urunler/:urun_id', esnafAuth, async function(req, res) {
  try {
    await pool.query('DELETE FROM urunler WHERE id=$1 AND esnaf_id=$2', [req.params.urun_id, req.params.id]);
    cacheSil('esnaf_detay:' + req.params.id);
    res.json({ basari: true, mesaj: 'Ürün silindi' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.post('/esnaflar/:id/yorumlar', async function(req, res) {
  try {
    await pool.query('INSERT INTO yorumlar (esnaf_id,kullanici,puan,yorum) VALUES ($1,$2,$3,$4)', [req.params.id, req.body.kullanici, parseInt(req.body.puan), req.body.yorum]);
    var yorumlar = await pool.query('SELECT puan FROM yorumlar WHERE esnaf_id=$1', [req.params.id]);
    var toplam = yorumlar.rows.reduce(function(t,y){return t+y.puan;},0);
    var ort = Math.round((toplam/yorumlar.rows.length)*10)/10;
    await pool.query('UPDATE esnaflar SET puan=$1, yorum_sayisi=$2 WHERE id=$3', [ort, yorumlar.rows.length, req.params.id]);
    cacheSil('esnaf_detay:' + req.params.id);
    cacheSil('esnaflar:');
    res.json({ basari: true, mesaj: 'Yorum eklendi!' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.post('/esnaflar/:id/kapak-foto', esnafAuth, upload.single('kapak_foto'), async function(req, res) {
  try {
    if (!req.file) return res.status(400).json({ basari: false, mesaj: 'Dosya yok.' });
    var result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'yakinda-ne-var/kapak',
      transformation: [{ width: 1200, crop: 'limit' }]
    });
    fs.unlink(req.file.path, function() {});
    await pool.query('UPDATE esnaflar SET kapak_foto=$1 WHERE id=$2', [result.secure_url, req.params.id]);
    cacheSil('esnaf_detay:' + req.params.id);
    cacheSil('esnaflar:');
    res.json({ basari: true, url: result.secure_url });
  } catch(err) {
    console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' });
  }
});

// ── UYGULAMA İÇİ BİLDİRİM ENDPOINTLERİ ─────────────────────────

// Kullanıcının bildirimlerini getir
router.put('/esnaflar/:id/goruntuleme', async function(req, res) {
  try {
    await pool.query('UPDATE esnaflar SET goruntuleme_sayisi = COALESCE(goruntuleme_sayisi,0) + 1 WHERE id=$1', [req.params.id]);
    res.json({ basari: true });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});


module.exports = router;
