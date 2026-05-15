'use strict';
const { pool } = require('./pool');
const { telefonNormalize, whatsappGonder } = require('../utils/helpers');

async function tablolarOlustur() {
  await pool.query(`CREATE TABLE IF NOT EXISTS esnaflar (id SERIAL PRIMARY KEY, ad VARCHAR(255) NOT NULL, kategori VARCHAR(50) NOT NULL, ilce VARCHAR(100) NOT NULL, adres TEXT, telefon VARCHAR(20), email VARCHAR(255), vergi_no VARCHAR(20), lat DECIMAL(10,6) DEFAULT 36.8550, lng DECIMAL(10,6) DEFAULT 28.2753, puan DECIMAL(3,1) DEFAULT 0, yorum_sayisi INTEGER DEFAULT 0, acik BOOLEAN DEFAULT true, onayli BOOLEAN DEFAULT false, onaylandi BOOLEAN DEFAULT false, kayit_tarihi TIMESTAMP DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS urunler (id SERIAL PRIMARY KEY, esnaf_id INTEGER REFERENCES esnaflar(id), ad VARCHAR(255) NOT NULL, fiyat DECIMAL(10,2) DEFAULT 0, aciklama TEXT, fotograf_url TEXT)`);
  await pool.query(`ALTER TABLE urunler ADD COLUMN IF NOT EXISTS fotograf_url TEXT`);
  await pool.query(`CREATE TABLE IF NOT EXISTS yorumlar (id SERIAL PRIMARY KEY, esnaf_id INTEGER REFERENCES esnaflar(id), kullanici VARCHAR(255), puan INTEGER, yorum TEXT, tarih DATE DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS siparisler (id SERIAL PRIMARY KEY, esnaf_id INTEGER, esnaf_adi VARCHAR(255), musteri_telefon VARCHAR(20), urunler JSONB, teslimat_turu VARCHAR(50), adres TEXT, ara_toplam DECIMAL(10,2), kurye_ucreti DECIMAL(10,2), komisyon DECIMAL(10,2), genel_toplam DECIMAL(10,2), durum VARCHAR(50) DEFAULT 'bekliyor', tarih TIMESTAMP DEFAULT NOW())`);
  await pool.query(`ALTER TABLE siparisler ADD COLUMN IF NOT EXISTS musteri_telefon VARCHAR(20)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS kuryeler (id SERIAL PRIMARY KEY, ad VARCHAR(255) NOT NULL, telefon VARCHAR(20) NOT NULL, arac_tipi VARCHAR(50), ilce VARCHAR(100), onaylandi BOOLEAN DEFAULT false, kayit_tarihi TIMESTAMP DEFAULT NOW())`);
  await pool.query(`ALTER TABLE siparisler ADD COLUMN IF NOT EXISTS kurye_id INTEGER REFERENCES kuryeler(id)`);
  await pool.query(`ALTER TABLE esnaflar ADD COLUMN IF NOT EXISTS calisma_saatleri JSONB`);
  await pool.query(`ALTER TABLE esnaflar ADD COLUMN IF NOT EXISTS sifre VARCHAR(100)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS kullanicilar (id SERIAL PRIMARY KEY, ad VARCHAR(100), telefon VARCHAR(20) UNIQUE NOT NULL, sifre VARCHAR(100) NOT NULL, tip VARCHAR(20) DEFAULT 'musteri', esnaf_id INTEGER REFERENCES esnaflar(id), kurye_id INTEGER REFERENCES kuryeler(id), olusturma TIMESTAMP DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS kampanyalar (id SERIAL PRIMARY KEY, esnaf_id INTEGER REFERENCES esnaflar(id) ON DELETE CASCADE, baslik VARCHAR(255) NOT NULL, aciklama TEXT, indirim_orani INTEGER DEFAULT 0, bitis_tarihi DATE, aktif BOOLEAN DEFAULT true, olusturma_tarihi TIMESTAMP DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS bildirim_tokenler (id SERIAL PRIMARY KEY, token TEXT UNIQUE NOT NULL, kullanici_telefon VARCHAR(20), olusturma TIMESTAMP DEFAULT NOW())`);
  await pool.query(`ALTER TABLE kullanicilar ADD COLUMN IF NOT EXISTS email TEXT`);
  await pool.query(`ALTER TABLE kullanicilar ADD COLUMN IF NOT EXISTS adresler JSONB DEFAULT '[]'`);
  await pool.query(`ALTER TABLE esnaflar ADD COLUMN IF NOT EXISTS goruntuleme_sayisi INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE esnaflar ADD COLUMN IF NOT EXISTS instagram_url TEXT`);
  await pool.query(`ALTER TABLE esnaflar ADD COLUMN IF NOT EXISTS google_maps_url TEXT`);

  // ── RANDEVU SİSTEMİ ────────────────────────────────────────────
  await pool.query(`ALTER TABLE esnaflar ADD COLUMN IF NOT EXISTS randevu_modu BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE esnaflar ADD COLUMN IF NOT EXISTS slot_suresi INTEGER DEFAULT 30`);
  await pool.query(`ALTER TABLE esnaflar ADD COLUMN IF NOT EXISTS indirimli_saatler JSONB DEFAULT '{}'`);
  await pool.query(`ALTER TABLE esnaflar ADD COLUMN IF NOT EXISTS ilan_bildirimi BOOLEAN DEFAULT true`);
  await pool.query(`ALTER TABLE esnaflar ADD COLUMN IF NOT EXISTS one_cikan BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE esnaflar ADD COLUMN IF NOT EXISTS one_cikan_etiket TEXT`);
  await pool.query(`ALTER TABLE esnaflar ADD COLUMN IF NOT EXISTS kapak_foto TEXT`);
  // ── KURYE KONUM TAKİBİ ─────────────────────────────────────────
  await pool.query(`ALTER TABLE kuryeler ADD COLUMN IF NOT EXISTS lat DECIMAL(10,6)`);
  await pool.query(`ALTER TABLE kuryeler ADD COLUMN IF NOT EXISTS lng DECIMAL(10,6)`);
  await pool.query(`ALTER TABLE kuryeler ADD COLUMN IF NOT EXISTS konum_guncelleme TIMESTAMP`);
  await pool.query(`CREATE TABLE IF NOT EXISTS hizmetler (
    id SERIAL PRIMARY KEY,
    esnaf_id INTEGER REFERENCES esnaflar(id) ON DELETE CASCADE,
    ad VARCHAR(255) NOT NULL,
    sure INTEGER DEFAULT 30,
    fiyat DECIMAL(10,2) DEFAULT 0,
    aciklama TEXT,
    aktif BOOLEAN DEFAULT true,
    olusturma TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS randevular (
    id SERIAL PRIMARY KEY,
    esnaf_id INTEGER REFERENCES esnaflar(id) ON DELETE CASCADE,
    musteri_telefon VARCHAR(20),
    musteri_ad VARCHAR(100),
    hizmet_id INTEGER REFERENCES hizmetler(id) ON DELETE SET NULL,
    tarih DATE NOT NULL,
    saat TIME NOT NULL,
    sure INTEGER DEFAULT 30,
    durum VARCHAR(20) DEFAULT 'bekliyor',
    notlar TEXT,
    olusturma TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS bekleme_listesi (
    id SERIAL PRIMARY KEY,
    esnaf_id INTEGER REFERENCES esnaflar(id) ON DELETE CASCADE,
    musteri_telefon VARCHAR(20),
    musteri_ad VARCHAR(100),
    hizmet_id INTEGER REFERENCES hizmetler(id) ON DELETE SET NULL,
    tarih DATE NOT NULL,
    olusturma TIMESTAMP DEFAULT NOW()
  )`);

  // ── UYGULAMA İÇİ BİLDİRİMLER ───────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS bildirimler (
    id SERIAL PRIMARY KEY,
    alici_telefon VARCHAR(20) NOT NULL,
    tip VARCHAR(30) DEFAULT 'bilgi',
    baslik VARCHAR(255) NOT NULL,
    mesaj TEXT,
    link_tip VARCHAR(30),
    link_id INTEGER,
    okundu BOOLEAN DEFAULT false,
    olusturma TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_bildirimler_alici ON bildirimler(alici_telefon, okundu)`);

  // ── HİZMET TEKLİF SİSTEMİ ──────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS is_ilanlari (
    id SERIAL PRIMARY KEY,
    musteri_telefon VARCHAR(20) NOT NULL,
    musteri_ad VARCHAR(100),
    baslik VARCHAR(255) NOT NULL,
    aciklama TEXT,
    kategori VARCHAR(50),
    ilce VARCHAR(100),
    butce_min DECIMAL(10,2),
    butce_max DECIMAL(10,2),
    tarih_tercih DATE,
    fotograf_url TEXT,
    durum VARCHAR(20) DEFAULT 'acik',
    olusturma TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`ALTER TABLE is_ilanlari ADD COLUMN IF NOT EXISTS fotograf_url TEXT`);
  await pool.query(`ALTER TABLE is_ilanlari ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP`);
  await pool.query(`CREATE TABLE IF NOT EXISTS teklifler (
    id SERIAL PRIMARY KEY,
    ilan_id INTEGER REFERENCES is_ilanlari(id) ON DELETE CASCADE,
    esnaf_id INTEGER REFERENCES esnaflar(id) ON DELETE CASCADE,
    fiyat DECIMAL(10,2),
    aciklama TEXT,
    durum VARCHAR(20) DEFAULT 'bekliyor',
    olusturma TIMESTAMP DEFAULT NOW()
  )`);

  // ── MÜŞTERİ SORULARI ───────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS sorular (
    id SERIAL PRIMARY KEY,
    esnaf_id INTEGER REFERENCES esnaflar(id) ON DELETE CASCADE,
    musteri_telefon VARCHAR(20),
    musteri_ad VARCHAR(100),
    soru TEXT NOT NULL,
    cevap TEXT,
    okundu BOOLEAN DEFAULT false,
    cevaplandi BOOLEAN DEFAULT false,
    olusturma TIMESTAMP DEFAULT NOW(),
    cevap_tarihi TIMESTAMP
  )`);

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
    var e4 = await pool.query(`INSERT INTO esnaflar (ad,kategori,ilce,adres,telefon,vergi_no,lat,lng,puan,yorum_sayisi,acik,onayli,onaylandi) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`, ['Berber Murat','hizmet','Marmaris','Merkez Mah. No:8','05009876543','5566778899',36.8535,28.2740,4.7,203,true,true,true]);
    var id4 = e4.rows[0].id;
    await pool.query('INSERT INTO urunler (esnaf_id,ad,fiyat,aciklama) VALUES ($1,$2,$3,$4),($1,$5,$6,$7)', [id4,'Sac Kesimi',150,'Erkek sac','Sakal Tiras',80,'Klasik tiras']);
    var e5 = await pool.query(`INSERT INTO esnaflar (ad,kategori,ilce,adres,telefon,vergi_no,lat,lng,puan,yorum_sayisi,acik,onayli,onaylandi) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`, ['Elektrikci Ali Usta','hizmet','Marmaris','Siteler Mah. No:34','05551112233','9988776655',36.8562,28.2765,4.8,78,true,true,true]);
    var id5 = e5.rows[0].id;
    await pool.query('INSERT INTO urunler (esnaf_id,ad,fiyat,aciklama) VALUES ($1,$2,$3,$4),($1,$5,$6,$7),($1,$8,$9,$10)', [id5,'Priz Montaji',200,'Tek priz','Kablo Cekimi',350,'Metre basi','Sigorta Degisimi',150,'Standart']);
    var e6 = await pool.query(`INSERT INTO esnaflar (ad,kategori,ilce,adres,telefon,vergi_no,lat,lng,puan,yorum_sayisi,acik,onayli,onaylandi) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`, ['Parlak Yildiz Temizlik','hizmet','Marmaris','Cumhuriyet Cad. No:7','05443334455','7766554433',36.8508,28.2731,4.6,112,true,true,true]);
    var id6 = e6.rows[0].id;
    await pool.query('INSERT INTO urunler (esnaf_id,ad,fiyat,aciklama) VALUES ($1,$2,$3,$4),($1,$5,$6,$7),($1,$8,$9,$10)', [id6,'Ev Temizligi',600,'3+1 daire','Ofis Temizligi',400,'50 m2 kadar','Cam Silme',250,'Dis cephe']);
    console.log('Ornek veriler eklendi!');
  }

  // Migration: Hizmet esnafları eksikse ekle (mevcut DB için)
  var eksikCheck = await pool.query("SELECT COUNT(*) FROM esnaflar WHERE ad IN ('Elektrikci Ali Usta','Parlak Yildiz Temizlik')");
  if (parseInt(eksikCheck.rows[0].count) < 2) {
    var aliCheck = await pool.query("SELECT id FROM esnaflar WHERE ad='Elektrikci Ali Usta' LIMIT 1");
    if (aliCheck.rows.length === 0) {
      var ea = await pool.query(`INSERT INTO esnaflar (ad,kategori,ilce,adres,telefon,vergi_no,lat,lng,puan,yorum_sayisi,acik,onayli,onaylandi) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`, ['Elektrikci Ali Usta','hizmet','Marmaris','Siteler Mah. No:34','05551112233','9988776655',36.8562,28.2765,4.8,78,true,true,true]);
      await pool.query('INSERT INTO urunler (esnaf_id,ad,fiyat,aciklama) VALUES ($1,$2,$3,$4),($1,$5,$6,$7),($1,$8,$9,$10)', [ea.rows[0].id,'Priz Montaji',200,'Tek priz','Kablo Cekimi',350,'Metre basi','Sigorta Degisimi',150,'Standart']);
      console.log('Elektrikci Ali Usta eklendi.');
    }
    var temizlikCheck = await pool.query("SELECT id FROM esnaflar WHERE ad='Parlak Yildiz Temizlik' LIMIT 1");
    if (temizlikCheck.rows.length === 0) {
      var eb = await pool.query(`INSERT INTO esnaflar (ad,kategori,ilce,adres,telefon,vergi_no,lat,lng,puan,yorum_sayisi,acik,onayli,onaylandi) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`, ['Parlak Yildiz Temizlik','hizmet','Marmaris','Cumhuriyet Cad. No:7','05443334455','7766554433',36.8508,28.2731,4.6,112,true,true,true]);
      await pool.query('INSERT INTO urunler (esnaf_id,ad,fiyat,aciklama) VALUES ($1,$2,$3,$4),($1,$5,$6,$7),($1,$8,$9,$10)', [eb.rows[0].id,'Ev Temizligi',600,'3+1 daire','Ofis Temizligi',400,'50 m2 kadar','Cam Silme',250,'Dis cephe']);
      console.log('Parlak Yildiz Temizlik eklendi.');
    }
  }
  // Migration: 30 test esnafa tamamla
  var testEsnaflar = [
    ['Pizza Palazzo','yemek','Marmaris','Barbaros Cad. No:22','05321234567','2233445566',36.8541,28.2780,4.6,88,true,true,true],
    ['Sushi Marmaris','yemek','Marmaris','Marina Cad. No:5','05332345678','3344556677',36.8498,28.2701,4.7,65,true,true,true],
    ['Burger House','yemek','Marmaris','Ulusal Egemenlik Bul. No:10','05343456789','4455667788',36.8515,28.2745,4.5,143,true,true,true],
    ['Cafe Deniz','yemek','Marmaris','Sahil Yolu No:3','05354567890','5566778800',36.8490,28.2690,4.8,210,true,true,true],
    ['Lahmacun Evi','yemek','Marmaris','Pazar Mah. No:18','05365678901','6677889911',36.8570,28.2810,4.4,97,true,true,true],
    ['Teknoloji Dukkani','urun','Marmaris','Kooperatif Mah. No:6','05376789012','7788990022',36.8528,28.2755,4.3,44,true,true,true],
    ['Giyim Merkezi','urun','Marmaris','Carsi Mah. No:14','05387890123','8899001133',36.8545,28.2770,4.5,76,true,true,true],
    ['Kasap Cetin','urun','Marmaris','Pazar Cad. No:9','05398901234','9900112244',36.8512,28.2738,4.9,189,true,true,true],
    ['Organik Market','urun','Marmaris','Siteler Mah. No:21','05309012345','0011223355',36.8558,28.2792,4.7,112,true,true,true],
    ['Cicekci Gulsen','urun','Marmaris','Merkez Mah. No:3','05310123456','1122334466',36.8533,28.2748,4.6,58,true,true,true],
    ['Ekspres Nakliyat','hizmet','Marmaris','Sanayi Sitesi No:45','05320234567','2233445577',36.8580,28.2820,4.5,34,true,true,true],
    ['Oto Elektrik Kemal','hizmet','Marmaris','Sanayi Cad. No:12','05330345678','3344556688',36.8595,28.2835,4.8,67,true,true,true],
    ['Boyaci Mustafa','hizmet','Marmaris','Yeni Mah. No:7','05340456789','4455667799',36.8520,28.2760,4.4,29,true,true,true],
    ['Dogalgaz Tesisatci','hizmet','Marmaris','Baris Mah. No:33','05350567890','5566778801',36.8548,28.2785,4.7,51,true,true,true],
    ['PC Tamircisi Hasan','hizmet','Marmaris','Atatürk Cad. No:44','05360678901','6677889912',36.8505,28.2725,4.6,83,true,true,true],
    ['Kuafor Selin','hizmet','Marmaris','Kordon Cad. No:11','05370789012','7788990023',36.8522,28.2742,4.9,156,true,true,true],
    ['Masaj Salonu Zen','hizmet','Marmaris','Marina Bul. No:8','05380890123','8899001134',36.8488,28.2698,4.8,94,true,true,true],
    ['Veteriner Klinik','hizmet','Marmaris','Cumhuriyet Cad. No:26','05390901234','9900112245',36.8560,28.2800,4.7,47,true,true,true],
    ['Eczane Saglik','urun','Marmaris','Merkez Mah. No:1','05300012345','0011223356',36.8538,28.2752,4.9,224,true,true,true],
    ['Firin Ekmek Dunyasi','yemek','Marmaris','Pazar Mah. No:5','05311123456','1122334477',36.8565,28.2808,4.8,178,true,true,true],
    ['Diş Protezcisi','hizmet','Marmaris','Atatürk Bul. No:15','05322234567','2233445588',36.8530,28.2762,4.5,38,true,true,true],
    ['Fotoğrafçı Ali','hizmet','Marmaris','Carsi Mah. No:6','05333345678','3344556699',36.8510,28.2735,4.6,62,true,true,true],
    ['Hukuk Bürosu','hizmet','Marmaris','Cumhuriyet Mah. No:20','05344456789','4455667700',36.8552,28.2790,4.4,19,true,true,true],
    ['Muhasebe Ofisi','hizmet','Marmaris','Iskele Mah. No:3','05355567890','5566778812',36.8495,28.2708,4.5,27,true,true,true],
  ];
  for (var te of testEsnaflar) {
    var teCheck = await pool.query('SELECT id FROM esnaflar WHERE ad=$1 LIMIT 1', [te[0]]);
    if (teCheck.rows.length === 0) {
      await pool.query(`INSERT INTO esnaflar (ad,kategori,ilce,adres,telefon,vergi_no,lat,lng,puan,yorum_sayisi,acik,onayli,onaylandi) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, te);
      console.log('Test esnaf eklendi:', te[0]);
    }
  }
  console.log('Tablolar hazir!');
}

// In-app bildirim oluşturma yardımcısı
async function bildirimOlustur(aliciTelefon, baslik, mesaj, tip, linkTip, linkId) {
  if (!aliciTelefon) return;
  try {
    await pool.query(
      'INSERT INTO bildirimler (alici_telefon, tip, baslik, mesaj, link_tip, link_id) VALUES ($1,$2,$3,$4,$5,$6)',
      [aliciTelefon, tip || 'bilgi', baslik, mesaj || null, linkTip || null, linkId || null]
    );
  } catch(err) { console.log('[Bildirim] Olusturulamadi:', err.message); }
}


async function randevuHatirlatmaCalistir() {
  try {
    // 1 saat sonraki randevuları bul (±10 dk pencere)
    var r = await pool.query(`
      SELECT rn.*, e.ad as esnaf_adi, e.telefon as esnaf_telefon
      FROM randevular rn
      JOIN esnaflar e ON e.id = rn.esnaf_id
      WHERE rn.durum IN ('bekliyor','onaylandi')
        AND rn.hatirlatma_gonderildi IS NOT TRUE
        AND (rn.tarih + rn.saat::time) BETWEEN NOW() + INTERVAL '50 minutes' AND NOW() + INTERVAL '70 minutes'
    `);
    for (var randevu of r.rows) {
      var tarihStr = new Date(randevu.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
      // Müşteriye hatırlatma
      if (randevu.musteri_telefon) {
        await whatsappGonder(randevu.musteri_telefon,
          `⏰ Randevu Hatırlatması!\n\n📅 Tarih: ${tarihStr}\n🕐 Saat: ${randevu.saat}\n🏪 İşletme: ${randevu.esnaf_adi}\n\nRandevunuz 1 saat içinde! Görüşürüz 🙌`
        ).catch(function() {});
      }
      // Esnafa hatırlatma
      if (randevu.esnaf_telefon) {
        await whatsappGonder(randevu.esnaf_telefon,
          `📋 1 Saat Sonra Randevu!\n\n👤 Müşteri: ${randevu.musteri_ad}\n📅 ${tarihStr} - ${randevu.saat}\n💼 Hizmet: ${randevu.hizmet_id ? 'ID:' + randevu.hizmet_id : 'Genel'}`
        ).catch(function() {});
      }
      // Tekrar gönderilmemesi için işaretle
      await pool.query('UPDATE randevular SET hatirlatma_gonderildi=true WHERE id=$1', [randevu.id]);
      console.log('Randevu hatirlatmasi gonderildi: randevu#' + randevu.id);
    }
  } catch (err) {
    console.error('Randevu hatirlatma hatasi:', err.message);
  }
}

// =============================================================
// GLOBAL ERROR HANDLER
// =============================================================
app.use(function(err, req, res, next) {
  console.error('[Global Hata]', err.message);
  res.status(err.status || 500).json({ basari: false, mesaj: 'Sunucu hatasi.' });
});


module.exports = { tablolarOlustur, randevuHatirlatmaCalistir };
