const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// ÖRNEK VERİ (veritabanı yerine şimdilik)
// ============================================

let esnaflar = [
  {
    id: 1,
    ad: "Usta Kebapçı",
    kategori: "yemek",
    ilce: "Marmaris",
    puan: 4.8,
    yorum_sayisi: 124,
    mesafe: "200m",
    acik: true,
    icon: "🍕",
    urunler: [
      { id: 1, ad: "Karışık Pizza", fiyat: 180, aciklama: "Büyük boy" },
      { id: 2, ad: "Adana Kebap", fiyat: 160, aciklama: "Lavash ile" },
      { id: 3, ad: "Tavuk Şiş", fiyat: 150, aciklama: "Pilav ile" },
      { id: 4, ad: "Ayran", fiyat: 30, aciklama: "Ev yapımı" }
    ]
  },
  {
    id: 2,
    ad: "Kardeşler Market",
    kategori: "urun",
    ilce: "Marmaris",
    puan: 4.5,
    yorum_sayisi: 89,
    mesafe: "350m",
    acik: true,
    icon: "🛒",
    urunler: [
      { id: 1, ad: "Dana Kıyma", fiyat: 420, aciklama: "1 kg" },
      { id: 2, ad: "Ekmek", fiyat: 15, aciklama: "Taze" },
      { id: 3, ad: "Süt", fiyat: 45, aciklama: "1 litre" }
    ]
  },
  {
    id: 3,
    ad: "Mehmet Usta Tesisatçı",
    kategori: "hizmet",
    ilce: "Marmaris",
    puan: 4.9,
    yorum_sayisi: 56,
    mesafe: "500m",
    acik: true,
    icon: "🔧",
    urunler: [
      { id: 1, ad: "Musluk Tamiri", fiyat: 250, aciklama: "Yerinde servis" },
      { id: 2, ad: "Tesisat Kontrolü", fiyat: 150, aciklama: "Genel kontrol" }
    ]
  }
];

let siparisler = [];
let siparis_id = 100;

// ============================================
// ROTALAR (API ENDPOİNTLERİ)
// ============================================

// Ana sayfa
app.get('/', (req, res) => {
  res.json({ mesaj: '📍 Yakında Ne Var? API çalışıyor!', versiyon: '1.0' });
});

// Tüm esnafları getir
app.get('/api/esnaflar', (req, res) => {
  const { ilce, kategori } = req.query;
  let sonuc = esnaflar;

  if (ilce) {
    sonuc = sonuc.filter(e => e.ilce.toLowerCase() === ilce.toLowerCase());
  }
  if (kategori) {
    sonuc = sonuc.filter(e => e.kategori === kategori);
  }

  res.json({ basari: true, veri: sonuc });
});

// Tek esnaf getir
app.get('/api/esnaflar/:id', (req, res) => {
  const esnaf = esnaflar.find(e => e.id === parseInt(req.params.id));
  if (!esnaf) {
    return res.status(404).json({ basari: false, mesaj: 'Esnaf bulunamadı' });
  }
  res.json({ basari: true, veri: esnaf });
});

// Yeni esnaf ekle
app.post('/api/esnaflar', (req, res) => {
  const { ad, kategori, ilce, icon } = req.body;
  if (!ad || !kategori || !ilce) {
    return res.status(400).json({ basari: false, mesaj: 'Ad, kategori ve ilçe zorunlu' });
  }
  const yeniEsnaf = {
    id: esnaflar.length + 1,
    ad, kategori, ilce,
    icon: icon || '🏪',
    puan: 0,
    yorum_sayisi: 0,
    mesafe: 'Yakın',
    acik: true,
    urunler: []
  };
  esnaflar.push(yeniEsnaf);
  res.json({ basari: true, veri: yeniEsnaf, mesaj: 'Esnaf eklendi!' });
});

// Esnafa ürün ekle
app.post('/api/esnaflar/:id/urunler', (req, res) => {
  const esnaf = esnaflar.find(e => e.id === parseInt(req.params.id));
  if (!esnaf) {
    return res.status(404).json({ basari: false, mesaj: 'Esnaf bulunamadı' });
  }
  const { ad, fiyat, aciklama } = req.body;
  if (!ad || !fiyat) {
    return res.status(400).json({ basari: false, mesaj: 'Ürün adı ve fiyat zorunlu' });
  }
  const yeniUrun = {
    id: esnaf.urunler.length + 1,
    ad, fiyat: parseFloat(fiyat), aciklama: aciklama || ''
  };
  esnaf.urunler.push(yeniUrun);
  res.json({ basari: true, veri: yeniUrun, mesaj: 'Ürün eklendi!' });
});

// Sipariş ver
app.post('/api/siparisler', (req, res) => {
  const { esnaf_id, urunler, teslimat_turu, adres } = req.body;
  if (!esnaf_id || !urunler || urunler.length === 0) {
    return res.status(400).json({ basari: false, mesaj: 'Esnaf ve ürünler zorunlu' });
  }

  const esnaf = esnaflar.find(e => e.id === parseInt(esnaf_id));
  if (!esnaf) {
    return res.status(404).json({ basari: false, mesaj: 'Esnaf bulunamadı' });
  }

  // Toplam hesapla
  let toplam = 0;
  urunler.forEach(u => { toplam += u.fiyat * u.adet; });
  const kurye_ucreti = teslimat_turu === 'kurye' ? 15 : 0;
  const komisyon = toplam * 0.05;
  const genel_toplam = toplam + kurye_ucreti + komisyon;

  const yeniSiparis = {
    id: ++siparis_id,
    esnaf_id,
    esnaf_adi: esnaf.ad,
    urunler,
    teslimat_turu: teslimat_turu || 'gel-al',
    adres: adres || '',
    ara_toplam: toplam,
    kurye_ucreti,
    komisyon: Math.round(komisyon),
    genel_toplam: Math.round(genel_toplam),
    durum: 'bekliyor',
    tarih: new Date().toISOString()
  };

  siparisler.push(yeniSiparis);
  res.json({ basari: true, veri: yeniSiparis, mesaj: '🎉 Sipariş alındı!' });
});

// Tüm siparişleri getir
app.get('/api/siparisler', (req, res) => {
  res.json({ basari: true, veri: siparisler });
});

// Sipariş durumu güncelle
app.put('/api/siparisler/:id/durum', (req, res) => {
  const siparis = siparisler.find(s => s.id === parseInt(req.params.id));
  if (!siparis) {
    return res.status(404).json({ basari: false, mesaj: 'Sipariş bulunamadı' });
  }
  siparis.durum = req.body.durum;
  res.json({ basari: true, veri: siparis, mesaj: 'Durum güncellendi' });
});

// İlçe listesi
app.get('/api/ilceler', (req, res) => {
  res.json({
    basari: true,
    veri: ['Marmaris', 'Bodrum', 'Fethiye', 'Datça', 'Milas', 'Muğla Merkez']
  });
});

// ============================================
// SUNUCUYU BAŞLAT
// ============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Yakında Ne Var? API çalışıyor!`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`📍 Esnaflar: http://localhost:${PORT}/api/esnaflar`);
  console.log(`📦 Siparişler: http://localhost:${PORT}/api/siparisler`);
});
