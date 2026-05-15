'use strict';
const express = require('express');
const router = express.Router();
const { pool, cacheAl, cacheKaydet, cacheSil } = require('../db/pool');
const { esnafAuth, adminAuth } = require('../middleware/auth');
const { upload, cloudinary, openai, telefonNormalize, whatsappGonder, mesafeHesapla, esnafSil, fs } = require('../utils/helpers');

router.post('/siparisler', async function(req, res) {
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
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.get('/siparis-detay/:id', async function(req, res) {
  try {
    var result = await pool.query(
      'SELECT s.*, k.ad AS kurye_ad, k.telefon AS kurye_telefon, k.arac_tipi AS kurye_arac, k.lat AS kurye_lat, k.lng AS kurye_lng ' +
      'FROM siparisler s LEFT JOIN kuryeler k ON k.id=s.kurye_id WHERE s.id=$1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ basari: false, mesaj: 'Siparis bulunamadi' });
    res.json({ basari: true, veri: result.rows[0] });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.put('/siparis-iptal/:id', async function(req, res) {
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
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.get('/siparislerim', async function(req, res) {
  try {
    var telefon = req.query.telefon;
    if (!telefon) return res.status(400).json({ basari: false, mesaj: 'Telefon gerekli' });
    var result = await pool.query('SELECT * FROM siparisler WHERE musteri_telefon=$1 ORDER BY tarih DESC', [telefon]);
    res.json({ basari: true, veri: result.rows });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.get('/siparisler', async function(req, res) {
  try {
    var esnafId = req.query.esnaf_id;
    var result = esnafId
      ? await pool.query('SELECT * FROM siparisler WHERE esnaf_id=$1 ORDER BY tarih DESC', [esnafId])
      : await pool.query('SELECT * FROM siparisler ORDER BY tarih DESC');
    res.json({ basari: true, veri: result.rows });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.put('/siparisler/:id/durum', async function(req, res) {
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
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});


module.exports = router;
