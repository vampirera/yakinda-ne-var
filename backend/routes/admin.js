'use strict';
const express = require('express');
const router = express.Router();
const { pool, cacheAl, cacheKaydet, cacheSil } = require('../db/pool');
const { esnafAuth, adminAuth } = require('../middleware/auth');
const { upload, cloudinary, openai, telefonNormalize, whatsappGonder, mesafeHesapla, esnafSil, fs } = require('../utils/helpers');

router.get('/admin/ozet', adminAuth, async function(req, res) {
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
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.get('/admin/bekleyenler', adminAuth, async function(req, res) {
  try {
    var result = await pool.query(`SELECT e.*, json_agg(DISTINCT jsonb_build_object('id',u.id,'ad',u.ad,'fiyat',u.fiyat,'fotograf_url',u.fotograf_url)) FILTER (WHERE u.id IS NOT NULL) as urunler FROM esnaflar e LEFT JOIN urunler u ON e.id=u.esnaf_id WHERE e.onaylandi=false GROUP BY e.id ORDER BY e.kayit_tarihi DESC`);
    res.json({ basari: true, veri: result.rows });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.get('/admin/aktifler', adminAuth, async function(req, res) {
  try {
    var result = await pool.query('SELECT * FROM esnaflar ORDER BY kayit_tarihi DESC');
    res.json({ basari: true, veri: result.rows });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.post('/admin/onayla/:id', adminAuth, async function(req, res) {
  try {
    await pool.query('UPDATE esnaflar SET onaylandi=true WHERE id=$1', [req.params.id]);
    cacheSil('esnaflar:'); cacheSil('esnaf_detay:' + req.params.id);
    res.json({ basari: true, mesaj: 'Esnaf onaylandi!' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.post('/admin/pasif/:id', adminAuth, async function(req, res) {
  try {
    await pool.query('UPDATE esnaflar SET onaylandi=false WHERE id=$1', [req.params.id]);
    cacheSil('esnaflar:'); cacheSil('esnaf_detay:' + req.params.id);
    res.json({ basari: true, mesaj: 'Esnaf yayindan kaldirildi.' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.post('/admin/aktif/:id', adminAuth, async function(req, res) {
  try {
    await pool.query('UPDATE esnaflar SET onaylandi=true WHERE id=$1', [req.params.id]);
    cacheSil('esnaflar:'); cacheSil('esnaf_detay:' + req.params.id);
    res.json({ basari: true, mesaj: 'Esnaf yayina alindi!' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});


router.delete('/admin/reddet/:id', adminAuth, async function(req, res) {
  try {
    await esnafSil(req.params.id);
    res.json({ basari: true, mesaj: 'Esnaf reddedildi.' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.delete('/admin/sil/:id', adminAuth, async function(req, res) {
  try {
    await esnafSil(req.params.id);
    res.json({ basari: true, mesaj: 'Esnaf silindi.' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Kurye kayıt
router.post('/kurye-kayit', async function(req, res) {
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
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Admin kurye listesi
router.get('/admin/kuryeler', adminAuth, async function(req, res) {
  try {
    var result = await pool.query('SELECT * FROM kuryeler ORDER BY kayit_tarihi DESC');
    res.json({ basari: true, veri: result.rows });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Admin kurye onayla
router.post('/admin/kurye-onayla/:id', adminAuth, async function(req, res) {
  try {
    await pool.query('UPDATE kuryeler SET onaylandi=true WHERE id=$1', [req.params.id]);
    res.json({ basari: true, mesaj: 'Kurye onaylandi.' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Admin kurye sil
router.delete('/admin/kurye-sil/:id', adminAuth, async function(req, res) {
  try {
    await pool.query('DELETE FROM kuryeler WHERE id=$1', [req.params.id]);
    res.json({ basari: true, mesaj: 'Kurye silindi.' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Admin müşteriler listesi
router.get('/admin/musteriler', adminAuth, async function(req, res) {
  try {
    var result = await pool.query("SELECT id, ad, telefon, olusturma FROM kullanicilar WHERE tip='musteri' ORDER BY olusturma DESC");
    res.json({ basari: true, veri: result.rows });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Admin tüm siparişler
router.get('/admin/siparisler', adminAuth, async function(req, res) {
  try {
    var where = ''; var params = [];
    if (req.query.durum) { where = ' WHERE durum=$1'; params = [req.query.durum]; }
    var result = await pool.query('SELECT * FROM siparisler' + where + ' ORDER BY tarih DESC', params);
    res.json({ basari: true, veri: result.rows });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Admin esnaf bilgi güncelle
router.put('/admin/esnaf/:id', adminAuth, async function(req, res) {
  try {
    var { ad, kategori, ilce, adres, telefon } = req.body;
    await pool.query('UPDATE esnaflar SET ad=$1, kategori=$2, ilce=$3, adres=$4, telefon=$5 WHERE id=$6', [ad, kategori, ilce||'', adres||'', telefon, req.params.id]);
    cacheSil('esnaf_detay:' + req.params.id);
    cacheSil('esnaflar:');
    res.json({ basari: true, mesaj: 'Esnaf guncellendi.' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Admin: esnafı öne çıkar / geri al
router.put('/admin/esnaf/:id/one-cikan', adminAuth, async function(req, res) {
  try {
    var { aktif, etiket } = req.body;
    await pool.query('UPDATE esnaflar SET one_cikan=$1, one_cikan_etiket=$2 WHERE id=$3', [!!aktif, etiket || null, req.params.id]);
    cacheSil('esnaf_detay:' + req.params.id);
    cacheSil('esnaflar:');
    res.json({ basari: true, mesaj: aktif ? 'Esnaf one cikanlara eklendi.' : 'Kaldirildi.' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Herkese açık: öne çıkan esnaflar
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

module.exports = router;
