'use strict';
const express = require('express');
const router = express.Router();
const { pool, cacheAl, cacheKaydet, cacheSil } = require('../db/pool');
const { esnafAuth, adminAuth } = require('../middleware/auth');
const { upload, cloudinary, openai, telefonNormalize, whatsappGonder, mesafeHesapla, esnafSil, fs } = require('../utils/helpers');

router.post('/is-ilani/fotograf', upload.single('foto'), async function(req, res) {
  try {
    if (!req.file) return res.status(400).json({ basari: false, mesaj: 'Dosya yok.' });
    var result = await cloudinary.uploader.upload(req.file.path, { folder: 'ilanlar', transformation: [{ width: 800, crop: 'limit' }] });
    fs.unlink(req.file.path, function() {});
    res.json({ basari: true, url: result.secure_url });
  } catch(err) {
    if (req.file) fs.unlink(req.file.path, function() {});
    console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' });
  }
});

// İlan oluştur
router.post('/is-ilani', async function(req, res) {
  try {
    var { musteri_telefon, musteri_ad, baslik, aciklama, kategori, ilce, butce_min, butce_max, fotograf_url } = req.body;
    if (!musteri_telefon || !baslik) return res.status(400).json({ basari: false, mesaj: 'Telefon ve başlık zorunlu.' });
    if (!kategori) return res.status(400).json({ basari: false, mesaj: 'Kategori seçimi zorunludur.' });
    var r = await pool.query(
      'INSERT INTO is_ilanlari (musteri_telefon,musteri_ad,baslik,aciklama,kategori,ilce,butce_min,butce_max,fotograf_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [musteri_telefon, musteri_ad||'Anonim', baslik, aciklama||null, kategori, ilce||null,
       butce_min ? parseFloat(butce_min) : null, butce_max ? parseFloat(butce_max) : null,
       fotograf_url || null]
    );
    // Aynı kategorideki onaylı esnafa uygulama içi bildirim (max 15)
    try {
      var kategoriAd = { yemek: 'Yemek', urun: 'Ürün', hizmet: 'Hizmet' }[kategori] || kategori;
      var esRes = await pool.query(
        'SELECT telefon FROM esnaflar WHERE onaylandi=true AND LOWER(kategori)=LOWER($1) AND ilan_bildirimi=true LIMIT 15',
        [kategori]
      );
      for (var e of esRes.rows) {
        await bildirimOlustur(
          e.telefon,
          '📋 Yeni ' + kategoriAd + ' İlanı',
          baslik + (aciklama ? '\n' + aciklama.slice(0, 100) : '') + (butce_min ? '\n💰 ₺' + butce_min + (butce_max ? '–₺' + butce_max : '+') : ''),
          'ilan', 'ilan', r.rows[0].id
        );
      }
    } catch(notifErr) { console.log('Bildirim hatasi:', notifErr.message); }
    res.json({ basari: true, veri: r.rows[0], mesaj: 'İlan yayınlandı! ' + (kategoriAd || '') + ' kategorisindeki esnaflar bildirim aldı.' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// İlanları listele (esnaf paneli için — kategoriye göre)
router.get('/is-ilanlari', async function(req, res) {
  try {
    var { kategori, ilce } = req.query;
    var where = ["i.durum='acik'"];
    var params = [];
    if (kategori) { params.push(kategori); where.push('LOWER(i.kategori)=LOWER($' + params.length + ')'); }
    if (ilce) { params.push(ilce); where.push('LOWER(i.ilce)=LOWER($' + params.length + ')'); }
    var sql = `SELECT i.*, (SELECT COUNT(*) FROM teklifler t WHERE t.ilan_id=i.id) AS teklif_sayisi
               FROM is_ilanlari i WHERE ${where.join(' AND ')} ORDER BY i.olusturma DESC LIMIT 50`;
    var r = await pool.query(sql, params);
    res.json({ basari: true, veri: r.rows });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Müşterinin ilanları + her ilandaki esnaf yanıtları (telefon dahil)
router.get('/ilanlarim', async function(req, res) {
  try {
    var { telefon } = req.query;
    if (!telefon) return res.json({ basari: true, veri: [] });
    var r = await pool.query(
      `SELECT i.*,
        (SELECT COUNT(*) FROM teklifler t WHERE t.ilan_id=i.id) AS teklif_sayisi,
        (SELECT json_agg(json_build_object(
          'id',t.id,'esnaf_id',t.esnaf_id,'esnaf_ad',e.ad,'esnaf_telefon',e.telefon,
          'fiyat',t.fiyat,'aciklama',t.aciklama,'durum',t.durum,'olusturma',t.olusturma
        ) ORDER BY t.olusturma DESC)
         FROM teklifler t JOIN esnaflar e ON e.id=t.esnaf_id WHERE t.ilan_id=i.id) AS teklifler
       FROM is_ilanlari i WHERE i.musteri_telefon=$1 ORDER BY i.olusturma DESC`,
      [telefon]
    );
    res.json({ basari: true, veri: r.rows });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// İlan düzenle (sadece ilan sahibi müşteri yapabilir)
router.put('/is-ilanlari/:id', async function(req, res) {
  try {
    var { musteri_telefon, baslik, aciklama, fotograf_url } = req.body;
    if (!musteri_telefon) return res.status(400).json({ basari: false, mesaj: 'Telefon zorunlu.' });
    var kontrol = await pool.query('SELECT id FROM is_ilanlari WHERE id=$1 AND musteri_telefon=$2', [req.params.id, musteri_telefon]);
    if (!kontrol.rows.length) return res.status(403).json({ basari: false, mesaj: 'İlan bulunamadı veya yetkiniz yok.' });
    var setClauses = [];
    var params = [];
    if (baslik !== undefined) { params.push(baslik); setClauses.push('baslik=$' + params.length); }
    if (aciklama !== undefined) { params.push(aciklama); setClauses.push('aciklama=$' + params.length); }
    if (fotograf_url !== undefined) { params.push(fotograf_url); setClauses.push('fotograf_url=$' + params.length); }
    if (!setClauses.length) return res.status(400).json({ basari: false, mesaj: 'Güncellenecek alan yok.' });
    setClauses.push('updated_at=NOW()');
    params.push(req.params.id);
    await pool.query('UPDATE is_ilanlari SET ' + setClauses.join(',') + ' WHERE id=$' + params.length, params);
    // Teklif veren esnaflara bildirim gönder
    var ilanInfo = await pool.query('SELECT baslik FROM is_ilanlari WHERE id=$1', [req.params.id]);
    var teklifVerenler = await pool.query(
      'SELECT e.telefon AS esnaf_tel FROM teklifler t JOIN esnaflar e ON e.id=t.esnaf_id WHERE t.ilan_id=$1',
      [req.params.id]
    );
    var ilanBaslik = ilanInfo.rows[0] ? ilanInfo.rows[0].baslik : 'İlan';
    for (var i = 0; i < teklifVerenler.rows.length; i++) {
      var esnafTel = teklifVerenler.rows[i].esnaf_tel;
      bildirimOlustur(esnafTel, '📝 İlan Güncellendi', '"' + ilanBaslik + '" ilanı güncellendi. Teklifiniz hâlâ aktif.', 'bilgi', 'ilan', parseInt(req.params.id));
      whatsappGonder(esnafTel, '📝 İlan Güncellendi\n\n"' + ilanBaslik + '" başlıklı ilan güncellendi.\nTeklifiniz hâlâ aktif, durumu takip edin!').catch(function(){});
    }
    res.json({ basari: true, mesaj: 'İlan güncellendi.' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// İlanı yayından kaldır (pasif yap)
router.put('/is-ilanlari/:id/kaldir', async function(req, res) {
  try {
    var { musteri_telefon } = req.body;
    if (!musteri_telefon) return res.status(400).json({ basari: false, mesaj: 'Telefon zorunlu.' });
    var kontrol = await pool.query('SELECT id, baslik FROM is_ilanlari WHERE id=$1 AND musteri_telefon=$2', [req.params.id, musteri_telefon]);
    if (!kontrol.rows.length) return res.status(403).json({ basari: false, mesaj: 'İlan bulunamadı veya yetkiniz yok.' });
    await pool.query("UPDATE is_ilanlari SET durum='kapali' WHERE id=$1", [req.params.id]);
    // Teklif veren esnaflara bildirim gönder
    var teklifVerenler = await pool.query(
      'SELECT e.telefon AS esnaf_tel FROM teklifler t JOIN esnaflar e ON e.id=t.esnaf_id WHERE t.ilan_id=$1',
      [req.params.id]
    );
    var ilanBaslik = kontrol.rows[0].baslik;
    for (var i = 0; i < teklifVerenler.rows.length; i++) {
      var esnafTel = teklifVerenler.rows[i].esnaf_tel;
      bildirimOlustur(esnafTel, '⏸ İlan Yayından Kaldırıldı', '"' + ilanBaslik + '" ilanı yayından kaldırıldı.', 'bilgi', null, null);
      whatsappGonder(esnafTel, '⏸ İlan Yayından Kaldırıldı\n\n"' + ilanBaslik + '" başlıklı ilana verdiğiniz teklif değerlendirildi, ilan yayından kaldırıldı.').catch(function(){});
    }
    res.json({ basari: true, mesaj: 'İlan yayından kaldırıldı.' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Esnaf ilgi bildir (fiyat opsiyonel)
router.post('/is-ilani/:id/teklif', async function(req, res) {
  try {
    var { esnaf_id, fiyat, aciklama } = req.body;
    if (!esnaf_id) return res.status(400).json({ basari: false, mesaj: 'Esnaf ID zorunlu.' });
    var mevcut = await pool.query('SELECT id FROM teklifler WHERE ilan_id=$1 AND esnaf_id=$2', [req.params.id, esnaf_id]);
    if (mevcut.rows.length) return res.status(400).json({ basari: false, mesaj: 'Bu ilana zaten yanıt verdiniz.' });
    var r = await pool.query(
      'INSERT INTO teklifler (ilan_id,esnaf_id,fiyat,aciklama) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.id, esnaf_id, fiyat ? parseFloat(fiyat) : null, aciklama||null]
    );
    // Müşteriye in-app bildirim
    var ilan = await pool.query('SELECT musteri_telefon, baslik FROM is_ilanlari WHERE id=$1', [req.params.id]);
    var esnaf = await pool.query('SELECT ad, telefon FROM esnaflar WHERE id=$1', [esnaf_id]);
    if (ilan.rows[0] && esnaf.rows[0]) {
      await bildirimOlustur(
        ilan.rows[0].musteri_telefon,
        '🎯 İlanınıza Yanıt Geldi',
        esnaf.rows[0].ad + (aciklama ? ': ' + aciklama.slice(0, 100) : '') + (fiyat ? ' · ₺' + fiyat : ''),
        'teklif', 'ilan', parseInt(req.params.id)
      );
    }
    res.json({ basari: true, veri: r.rows[0], mesaj: 'Yanıtınız müşteriye iletildi!' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Esnaf yanıtını kabul / reddet
router.put('/teklif/:id/durum', async function(req, res) {
  try {
    var { durum } = req.body;
    if (!['kabul', 'reddedildi'].includes(durum)) return res.status(400).json({ basari: false, mesaj: 'Geçersiz durum.' });
    var t = await pool.query(
      `UPDATE teklifler SET durum=$1 WHERE id=$2 RETURNING *,
        (SELECT musteri_telefon FROM is_ilanlari WHERE id=teklifler.ilan_id) as musteri_tel,
        (SELECT musteri_ad FROM is_ilanlari WHERE id=teklifler.ilan_id) as musteri_ad_ilan`,
      [durum, req.params.id]
    );
    if (!t.rows.length) return res.status(404).json({ basari: false, mesaj: 'Teklif bulunamadı.' });
    if (durum === 'kabul') {
      await pool.query('UPDATE is_ilanlari SET durum=$1 WHERE id=$2', ['kapali', t.rows[0].ilan_id]);
      // Esnafa müşteri telefonu ile bildir
      var esnaf = await pool.query('SELECT ad, telefon FROM esnaflar WHERE id=$1', [t.rows[0].esnaf_id]);
      if (esnaf.rows[0] && esnaf.rows[0].telefon) {
        var mTel = t.rows[0].musteri_tel || '';
        var mAd  = t.rows[0].musteri_ad_ilan || 'Müşteri';
        whatsappGonder(esnaf.rows[0].telefon,
          `✅ Yanıtınız Kabul Edildi!\n\n👤 Müşteri: ${mAd}\n📞 Telefon: ${mTel}\n\nDoğrudan iletişime geçebilirsiniz!`
        ).catch(function() {});
      }
    }
    res.json({ basari: true, mesaj: durum === 'kabul' ? 'Kabul edildi. Esnaf bilgilendirildi.' : 'Reddedildi.' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// İlan düzenle (başlık, açıklama, fotoğraf)
router.put('/is-ilani/:id/kapat', async function(req, res) {
  try {
    var { musteri_telefon } = req.body;
    if (!musteri_telefon) return res.status(400).json({ basari: false, mesaj: 'Yetkisiz.' });
    var r = await pool.query(
      "UPDATE is_ilanlari SET durum='iptal' WHERE id=$1 AND musteri_telefon=$2 AND durum='acik' RETURNING id",
      [req.params.id, musteri_telefon]
    );
    if (!r.rows.length) return res.status(404).json({ basari: false, mesaj: 'İlan bulunamadı veya zaten kapalı.' });
    res.json({ basari: true, mesaj: 'İlan yayından kaldırıldı.' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.put('/is-ilani/:id', async function(req, res) {
  try {
    var { musteri_telefon, baslik, aciklama, fotograf_url } = req.body;
    if (!musteri_telefon || !baslik) return res.status(400).json({ basari: false, mesaj: 'Başlık zorunlu.' });
    var r = await pool.query(
      'UPDATE is_ilanlari SET baslik=$1, aciklama=$2, fotograf_url=$3, updated_at=NOW() WHERE id=$4 AND musteri_telefon=$5 RETURNING *',
      [baslik, aciklama || null, fotograf_url || null, req.params.id, musteri_telefon]
    );
    if (!r.rows.length) return res.status(404).json({ basari: false, mesaj: 'İlan bulunamadı veya yetkiniz yok.' });
    res.json({ basari: true, veri: r.rows[0], mesaj: 'İlan güncellendi.' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// ── MÜŞTERİ SORULARI ───────────────────────────────────────────────────────

// Müşteri esnafa soru sorar
router.post('/sorular', async function(req, res) {
  try {
    var { esnaf_id, musteri_telefon, musteri_ad, soru } = req.body;
    if (!esnaf_id || !soru || !soru.trim()) return res.status(400).json({ basari: false, mesaj: 'Esnaf ve soru zorunlu.' });
    var r = await pool.query(
      'INSERT INTO sorular (esnaf_id, musteri_telefon, musteri_ad, soru) VALUES ($1,$2,$3,$4) RETURNING id',
      [esnaf_id, musteri_telefon || null, musteri_ad || null, soru.trim()]
    );
    // Esnafı bilgilendir
    var esnaf = await pool.query('SELECT ad, telefon FROM esnaflar WHERE id=$1', [esnaf_id]);
    if (esnaf.rows[0]) {
      var gonderenAd = musteri_ad || (musteri_telefon || 'Müşteri');
      if (esnaf.rows[0].telefon) {
        whatsappGonder(esnaf.rows[0].telefon,
          `💬 Yeni Soru!\n\n👤 ${gonderenAd}${musteri_telefon ? ' (' + musteri_telefon + ')' : ''}\n\n❓ ${soru.trim()}\n\nYanıtlamak için panelinize girin.`
        ).catch(function() {});
      }
      await bildirimOlustur(
        esnaf.rows[0].telefon,
        '💬 Yeni Soru Geldi',
        gonderenAd + ': ' + soru.trim().slice(0, 100),
        'bilgi', null, null
      );
    }
    res.json({ basari: true, mesaj: 'Sorunuz iletildi.', id: r.rows[0].id });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Esnaf kendi sorularını listeler
router.get('/sorular/:esnafId', async function(req, res) {
  try {
    var r = await pool.query(
      'SELECT * FROM sorular WHERE esnaf_id=$1 ORDER BY olusturma DESC LIMIT 100',
      [req.params.esnafId]
    );
    res.json({ basari: true, veri: r.rows });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Esnaf soruyu cevaplar
router.put('/sorular/:id/cevapla', async function(req, res) {
  try {
    var { cevap, esnaf_id } = req.body;
    if (!cevap || !cevap.trim()) return res.status(400).json({ basari: false, mesaj: 'Cevap boş olamaz.' });
    var r = await pool.query(
      `UPDATE sorular SET cevap=$1, cevaplandi=true, okundu=true, cevap_tarihi=NOW()
       WHERE id=$2 AND esnaf_id=$3 RETURNING *`,
      [cevap.trim(), req.params.id, esnaf_id]
    );
    if (!r.rows.length) return res.status(404).json({ basari: false, mesaj: 'Soru bulunamadı.' });
    var soru = r.rows[0];
    // Müşteriye bildir
    if (soru.musteri_telefon) {
      var esnaf = await pool.query('SELECT ad FROM esnaflar WHERE id=$1', [esnaf_id]);
      var esnafAdi = esnaf.rows[0] ? esnaf.rows[0].ad : 'İşletme';
      whatsappGonder(soru.musteri_telefon,
        `✅ Sorunuz Yanıtlandı!\n\n🏪 ${esnafAdi}\n\n❓ ${soru.soru}\n\n💬 ${cevap.trim()}`
      ).catch(function() {});
      await bildirimOlustur(
        soru.musteri_telefon,
        '✅ Sorunuz Yanıtlandı',
        esnafAdi + ': ' + cevap.trim().slice(0, 100),
        'basari', null, null
      );
    }
    res.json({ basari: true, mesaj: 'Cevap gönderildi.' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Randevu hatırlatma scheduler — her 10 dakikada bir çalışır

module.exports = router;
