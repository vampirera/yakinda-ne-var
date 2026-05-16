'use strict';
const express = require('express');
const router = express.Router();
const { pool, cacheAl, cacheKaydet, cacheSil, CACHE_TTL } = require('../db/pool');
const { esnafAuth, adminAuth } = require('../middleware/auth');
const { upload, cloudinary, openai, telefonNormalize, whatsappGonder, mesafeHesapla, esnafSil, fs } = require('../utils/helpers');

router.post('/gorsel-ara', upload.single('fotograf'), async function(req, res) {
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
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Push bildirim token kaydet
router.post('/bildirim-token', async function(req, res) {
  var { token, kullanici_telefon } = req.body;
  if (!token) return res.status(400).json({ basari: false, mesaj: 'Token zorunlu' });
  try {
    await pool.query(
      'INSERT INTO bildirim_tokenler (token, kullanici_telefon) VALUES ($1,$2) ON CONFLICT (token) DO UPDATE SET kullanici_telefon=$2, olusturma=NOW()',
      [token, kullanici_telefon || null]
    );
    res.json({ basari: true });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

router.get('/ilceler', function(req, res) {
  var cached = cacheAl('ilceler');
  if (cached) return res.json({ basari: true, veri: cached });
  var liste = ['Marmaris','Bodrum','Fethiye','Datca','Milas','Mugla Merkez'];
  cacheKaydet('ilceler', liste, CACHE_TTL.ilceler);
  res.json({ basari: true, veri: liste });
});

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


module.exports = router;
