'use strict';
const express = require('express');
const router = express.Router();
const { girisLimit } = require('../middleware/rateLimit');
const { pool, cacheAl, cacheKaydet, cacheSil } = require('../db/pool');
const { esnafAuth, adminAuth, sessionDogrula } = require('../middleware/auth');
const { upload, cloudinary, openai, telefonNormalize, whatsappGonder, mesafeHesapla, esnafSil, fs } = require('../utils/helpers');

router.get('/esnaf/:id/hizmetler', async function(req, res) {
  try {
    var r = await pool.query('SELECT * FROM hizmetler WHERE esnaf_id=$1 AND aktif=true ORDER BY id', [req.params.id]);
    res.json({ basari: true, veri: r.rows });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Müsait slotları hesapla: GET /api/esnaf/:id/musait-slotlar?tarih=2024-01-15&hizmet_id=1
router.get('/esnaf/:id/musait-slotlar', async function(req, res) {
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
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Randevu oluştur
router.post('/randevu', girisLimit, async function(req, res) {
  try {
    // Soft-auth: token varsa musteri_telefon token'dan alınır
    var auth = req.headers['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
      var session = sessionDogrula(auth.slice(7));
      if (session && session.telefon) req.body.musteri_telefon = session.telefon;
    }
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
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Müşterinin randevularını listele
router.get('/randevularim', async function(req, res) {
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
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Randevu iptal (müşteri)
router.put('/randevu/:id/iptal', async function(req, res) {
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
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Randevu yeniden planla (müşteri)
router.put('/randevu/:id/yeniden-planla', async function(req, res) {
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
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Esnaf paneli: tüm randevuları görüntüle

module.exports = router;
