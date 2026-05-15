'use strict';
const express = require('express');
const router = express.Router();
const { pool, cacheAl, cacheKaydet, cacheSil } = require('../db/pool');
const { esnafAuth, adminAuth } = require('../middleware/auth');
const { upload, cloudinary, openai, telefonNormalize, whatsappGonder, mesafeHesapla, esnafSil, fs } = require('../utils/helpers');

router.put('/esnaf-panel/:id/profil', esnafAuth, async function(req, res) {
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
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// ── KAPAK FOTOĞRAFI ────────────────────────────────────────────
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
router.get('/bildirimler', async function(req, res) {
  try {
    var { telefon } = req.query;
    if (!telefon) return res.json({ basari: true, veri: [], okunmamis: 0 });
    var r = await pool.query(
      'SELECT * FROM bildirimler WHERE alici_telefon=$1 ORDER BY okundu ASC, olusturma DESC LIMIT 50',
      [telefon]
    );
    var okunmamis = r.rows.filter(function(b) { return !b.okundu; }).length;
    res.json({ basari: true, veri: r.rows, okunmamis: okunmamis });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Tümünü okundu olarak işaretle
router.put('/bildirimler/oku', async function(req, res) {
  try {
    var { telefon } = req.body;
    if (!telefon) return res.status(400).json({ basari: false });
    await pool.query('UPDATE bildirimler SET okundu=true WHERE alici_telefon=$1 AND okundu=false', [telefon]);
    res.json({ basari: true });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Tekil bildirimi sil
router.delete('/bildirim/:id', async function(req, res) {
  try {
    await pool.query('DELETE FROM bildirimler WHERE id=$1', [req.params.id]);
    res.json({ basari: true });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// İlan bildirimi tercihini güncelle
router.put('/esnaf-panel/:id/ilan-bildirimi', esnafAuth, async function(req, res) {
  try {
    if (!await esnafDogrula(req.params.id, res)) return;
    await pool.query('UPDATE esnaflar SET ilan_bildirimi=$1 WHERE id=$2', [!!req.body.aktif, req.params.id]);
    cacheSil('esnaf_detay:' + req.params.id);
    res.json({ basari: true, mesaj: req.body.aktif ? 'İlan bildirimleri açıldı.' : 'İlan bildirimleri kapatıldı.' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.put('/esnaflar/:id/goruntuleme', async function(req, res) {
  try {
    await pool.query('UPDATE esnaflar SET goruntuleme_sayisi = COALESCE(goruntuleme_sayisi,0) + 1 WHERE id=$1', [req.params.id]);
    res.json({ basari: true });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.get('/esnaf-panel/:id/istatistik', esnafAuth, async function(req, res) {
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
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

async function esnafDogrula(id, res) {
  var r = await pool.query('SELECT id FROM esnaflar WHERE id=$1', [id]);
  if (!r.rows.length) { res.status(404).json({ basari: false, mesaj: 'Esnaf bulunamadi' }); return false; }
  return true;
}

router.post('/esnaf-panel/:id/kampanya', esnafAuth, async function(req, res) {
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
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.delete('/esnaf-panel/:id/kampanya/:kampanya_id', esnafAuth, async function(req, res) {
  try {
    if (!await esnafDogrula(req.params.id, res)) return;
    await pool.query('DELETE FROM kampanyalar WHERE id=$1 AND esnaf_id=$2', [req.params.kampanya_id, req.params.id]);
    cacheSil('esnaf_detay:' + req.params.id);
    res.json({ basari: true, mesaj: 'Kampanya silindi.' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.put('/esnaf-panel/:id/calisma-saatleri', esnafAuth, async function(req, res) {
  try {
    if (!await esnafDogrula(req.params.id, res)) return;
    var saatler = req.body.calisma_saatleri;
    if (!saatler || typeof saatler !== 'object') return res.status(400).json({ basari: false, mesaj: 'Gecersiz veri' });
    await pool.query('UPDATE esnaflar SET calisma_saatleri=$1 WHERE id=$2', [JSON.stringify(saatler), req.params.id]);
    cacheSil('esnaf_detay:' + req.params.id);
    cacheSil('esnaflar:');
    res.json({ basari: true, mesaj: 'Calisma saatleri guncellendi.' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// =============================================================
// RANDEVU SİSTEMİ
// =============================================================

// Randevu ayarları al
router.get('/esnaf-panel/:id/randevu-ayar', esnafAuth, async function(req, res) {
  try {
    if (!await esnafDogrula(req.params.id, res)) return;
    var r = await pool.query('SELECT randevu_modu, slot_suresi, calisma_saatleri, indirimli_saatler FROM esnaflar WHERE id=$1', [req.params.id]);
    res.json({ basari: true, veri: r.rows[0] });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Randevu ayarları güncelle (modu aç/kapat, slot süresi, indirimli saatler)
router.put('/esnaf-panel/:id/randevu-ayar', esnafAuth, async function(req, res) {
  try {
    if (!await esnafDogrula(req.params.id, res)) return;
    var { randevu_modu, slot_suresi, indirimli_saatler } = req.body;
    await pool.query(
      'UPDATE esnaflar SET randevu_modu=$1, slot_suresi=$2, indirimli_saatler=$3 WHERE id=$4',
      [!!randevu_modu, parseInt(slot_suresi) || 30, JSON.stringify(indirimli_saatler || {}), req.params.id]
    );
    cacheSil('esnaf_detay:' + req.params.id);
    res.json({ basari: true, mesaj: 'Randevu ayarlari guncellendi.' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Hizmetleri listele
router.get('/esnaf-panel/:id/hizmetler', esnafAuth, async function(req, res) {
  try {
    if (!await esnafDogrula(req.params.id, res)) return;
    var r = await pool.query('SELECT * FROM hizmetler WHERE esnaf_id=$1 ORDER BY id', [req.params.id]);
    res.json({ basari: true, veri: r.rows });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Hizmet ekle
router.post('/esnaf-panel/:id/hizmet', esnafAuth, async function(req, res) {
  try {
    if (!await esnafDogrula(req.params.id, res)) return;
    var { ad, sure, fiyat, aciklama } = req.body;
    if (!ad) return res.status(400).json({ basari: false, mesaj: 'Hizmet adi gerekli.' });
    var r = await pool.query(
      'INSERT INTO hizmetler (esnaf_id, ad, sure, fiyat, aciklama) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.params.id, ad, parseInt(sure)||30, parseFloat(fiyat)||0, aciklama||null]
    );
    res.json({ basari: true, veri: r.rows[0] });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Hizmet güncelle
router.put('/esnaf-panel/:id/hizmet/:hizmet_id', esnafAuth, async function(req, res) {
  try {
    if (!await esnafDogrula(req.params.id, res)) return;
    var { ad, sure, fiyat, aciklama, aktif } = req.body;
    var r = await pool.query(
      'UPDATE hizmetler SET ad=$1, sure=$2, fiyat=$3, aciklama=$4, aktif=$5 WHERE id=$6 AND esnaf_id=$7 RETURNING *',
      [ad, parseInt(sure)||30, parseFloat(fiyat)||0, aciklama||null, aktif !== false, req.params.hizmet_id, req.params.id]
    );
    res.json({ basari: true, veri: r.rows[0] });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Hizmet sil
router.delete('/esnaf-panel/:id/hizmet/:hizmet_id', esnafAuth, async function(req, res) {
  try {
    if (!await esnafDogrula(req.params.id, res)) return;
    await pool.query('DELETE FROM hizmetler WHERE id=$1 AND esnaf_id=$2', [req.params.hizmet_id, req.params.id]);
    res.json({ basari: true, mesaj: 'Hizmet silindi.' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Müşteri için: esnaf hizmetlerini al (public)
router.get('/esnaf-panel/:id/randevular', esnafAuth, async function(req, res) {
  try {
    if (!await esnafDogrula(req.params.id, res)) return;
    var { tarih } = req.query;
    var query = `SELECT r.*, h.ad as hizmet_adi FROM randevular r LEFT JOIN hizmetler h ON h.id=r.hizmet_id WHERE r.esnaf_id=$1`;
    var params = [req.params.id];
    if (tarih) { query += ' AND r.tarih=$2'; params.push(tarih); }
    query += ' ORDER BY r.tarih DESC, r.saat';
    var r = await pool.query(query, params);
    res.json({ basari: true, veri: r.rows });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Esnaf paneli: randevu durumu güncelle
router.put('/esnaf-panel/:id/randevu/:randevu_id/durum', esnafAuth, async function(req, res) {
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
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// ── HİZMET TEKLİF SİSTEMİ ────────────────────────────────────────────

// İlan oluştur
// İlan fotoğrafı yükle (Cloudinary)

module.exports = router;
