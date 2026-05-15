'use strict';
const express = require('express');
const router = express.Router();
const { pool, cacheAl, cacheKaydet, cacheSil } = require('../db/pool');
const { esnafAuth, adminAuth } = require('../middleware/auth');
const { upload, cloudinary, openai, telefonNormalize, whatsappGonder, mesafeHesapla, esnafSil, fs } = require('../utils/helpers');

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
router.post('/kurye-kabul', async function(req, res) {
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
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Kuryenin üstlendiği aktif siparişleri listele
router.get('/kurye-siparislerim', async function(req, res) {
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
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Kuryenin bölgesindeki henüz alınmamış siparişler
router.get('/kurye-bekleyen', async function(req, res) {
  try {
    var ilce = req.query.ilce;
    if (!ilce) return res.json({ basari: true, veri: [] });
    var result = await pool.query(
      "SELECT s.*, e.ad as esnaf_adi, e.ilce as esnaf_ilce, e.adres as esnaf_adres FROM siparisler s LEFT JOIN esnaflar e ON e.id=s.esnaf_id WHERE s.teslimat_turu='kurye' AND s.kurye_id IS NULL AND s.durum='bekliyor' AND LOWER(e.ilce)=LOWER($1) ORDER BY s.tarih DESC",
      [ilce]
    );
    res.json({ basari: true, veri: result.rows });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Kurye: konumunu güncelle
router.put('/kurye-konum', async function(req, res) {
  try {
    var { telefon, lat, lng } = req.body;
    if (!telefon || lat == null || lng == null) return res.status(400).json({ basari: false, mesaj: 'Eksik bilgi.' });
    await pool.query(
      'UPDATE kuryeler SET lat=$1, lng=$2, konum_guncelleme=NOW() WHERE telefon=$3',
      [parseFloat(lat), parseFloat(lng), telefon]
    );
    res.json({ basari: true });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Sipariş: atanan kuryenin konumunu al
router.get('/siparis/:id/kurye-konum', async function(req, res) {
  try {
    var r = await pool.query(
      'SELECT k.lat, k.lng, k.ad AS kurye_ad, k.konum_guncelleme FROM siparisler s JOIN kuryeler k ON k.id=s.kurye_id WHERE s.id=$1',
      [req.params.id]
    );
    if (!r.rows.length || r.rows[0].lat == null) return res.json({ basari: false, mesaj: 'Kurye konumu yok.' });
    res.json({ basari: true, veri: r.rows[0] });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});


module.exports = router;
