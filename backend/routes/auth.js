'use strict';
const express = require('express');
const router = express.Router();
const { pool, cacheAl, cacheKaydet, cacheSil } = require('../db/pool');
const { esnafAuth, adminAuth } = require('../middleware/auth');
const { upload, cloudinary, openai, telefonNormalize, whatsappGonder, mesafeHesapla, esnafSil, fs } = require('../utils/helpers');
const { girisLimit, otpLimit } = require('../middleware/rateLimit');

router.post('/otp-gonder', otpLimit, async function(req, res) {
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

router.post('/kayit', async function(req, res) {
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
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.post('/giris', girisLimit, async function(req, res) {
  try {
    var { telefon, sifre } = req.body;
    if (!telefon || !sifre) return res.status(400).json({ basari: false, mesaj: 'Telefon ve sifre zorunlu' });
    // Admin kontrolü (env'den)
    if (process.env.ADMIN_TELEFON && process.env.ADMIN_SIFRE &&
        telefon === process.env.ADMIN_TELEFON && sifre === process.env.ADMIN_SIFRE) {
      var adminVeri = { kullanici_id: 0, ad: 'Admin', telefon: telefon, tip: 'admin', esnaf_id: null, kurye_id: null };
      var adminToken = sessionOlustur(adminVeri);
      return res.json({ basari: true, veri: Object.assign({}, adminVeri, { token: adminToken }) });
    }
    // Kullanicilar tablosu — telefon ile çek, sonra şifre doğrula (bcrypt lazy migration)
    var r = await pool.query('SELECT id,ad,telefon,tip,esnaf_id,kurye_id,email,adresler,sifre FROM kullanicilar WHERE telefon=$1', [telefon]);
    if (r.rows.length) {
      var u = r.rows[0];
      var sifreEslesti = false;
      var hashli = u.sifre && (u.sifre.startsWith('$2b$') || u.sifre.startsWith('$2a$'));
      if (hashli) {
        sifreEslesti = await bcrypt.compare(sifre, u.sifre);
      } else {
        sifreEslesti = (u.sifre === sifre);
        if (sifreEslesti) {
          // Lazy migration: ilk girişte hashle
          var hashed = await bcrypt.hash(sifre, 10);
          await pool.query('UPDATE kullanicilar SET sifre=$1 WHERE id=$2', [hashed, u.id]);
        }
      }
      if (!sifreEslesti) return res.status(401).json({ basari: false, mesaj: 'Telefon veya sifre yanlis' });
      var veri = { kullanici_id: u.id, ad: u.ad, telefon: u.telefon, tip: u.tip, esnaf_id: u.esnaf_id, kurye_id: u.kurye_id, email: u.email || '', adresler: u.adresler || [] };
      if (u.tip === 'kurye' && u.kurye_id) {
        var kr = await pool.query('SELECT ilce, arac_tipi, onaylandi FROM kuryeler WHERE id=$1', [u.kurye_id]);
        if (kr.rows.length) { veri.ilce = kr.rows[0].ilce; veri.arac_tipi = kr.rows[0].arac_tipi; veri.onaylandi = kr.rows[0].onaylandi; }
      }
      var token = sessionOlustur(veri);
      return res.json({ basari: true, veri: Object.assign({}, veri, { token: token }) });
    }
    // Geriye dönük uyumluluk: esnaflar tablosundaki sifre (bcrypt lazy migration)
    var er = await pool.query('SELECT id,ad,sifre FROM esnaflar WHERE telefon=$1', [telefon]);
    if (er.rows.length) {
      var e = er.rows[0];
      var eSifreEslesti = false;
      var eHashli = e.sifre && (e.sifre.startsWith('$2b$') || e.sifre.startsWith('$2a$'));
      if (eHashli) {
        eSifreEslesti = await bcrypt.compare(sifre, e.sifre);
      } else {
        eSifreEslesti = (e.sifre === sifre);
        if (eSifreEslesti) {
          var eHashed = await bcrypt.hash(sifre, 10);
          await pool.query('UPDATE esnaflar SET sifre=$1 WHERE id=$2', [eHashed, e.id]);
        }
      }
      if (!eSifreEslesti) return res.status(401).json({ basari: false, mesaj: 'Telefon veya sifre yanlis' });
      var eVeri = { kullanici_id: null, ad: e.ad, telefon: telefon, tip: 'esnaf', esnaf_id: e.id, kurye_id: null };
      var eToken = sessionOlustur(eVeri);
      return res.json({ basari: true, veri: Object.assign({}, eVeri, { token: eToken }) });
    }
    res.status(401).json({ basari: false, mesaj: 'Telefon veya sifre yanlis' });
  } catch(err) { res.status(500).json({ basari: false, mesaj: 'Giris hatasi.' }); }
});

router.put('/musteri/profil', async function(req, res) {
  try {
    var { id, telefon, email, adresler } = req.body;
    if (!id || !telefon) return res.status(400).json({ basari: false, mesaj: 'id ve telefon zorunlu' });
    var kontrol = await pool.query('SELECT id FROM kullanicilar WHERE id=$1 AND telefon=$2', [id, telefon]);
    if (!kontrol.rows.length) return res.status(403).json({ basari: false, mesaj: 'Yetkisiz' });
    await pool.query('UPDATE kullanicilar SET email=$1, adresler=$2 WHERE id=$3', [email || null, JSON.stringify(adresler || []), id]);
    res.json({ basari: true });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});


module.exports = router;
