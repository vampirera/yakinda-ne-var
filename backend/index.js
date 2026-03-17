const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let esnaflar = [
  { id: 1, ad: "Usta Kebapci", kategori: "yemek", ilce: "Marmaris", puan: 4.8, acik: true, urunler: [{ id: 1, ad: "Karisik Pizza", fiyat: 180 }, { id: 2, ad: "Adana Kebap", fiyat: 160 }, { id: 3, ad: "Ayran", fiyat: 30 }] },
  { id: 2, ad: "Kardesler Market", kategori: "urun", ilce: "Marmaris", puan: 4.5, acik: true, urunler: [{ id: 1, ad: "Dana Kiyma", fiyat: 420 }, { id: 2, ad: "Ekmek", fiyat: 15 }] },
  { id: 3, ad: "Mehmet Usta", kategori: "hizmet", ilce: "Marmaris", puan: 4.9, acik: true, urunler: [{ id: 1, ad: "Musluk Tamiri", fiyat: 250 }] }
];

let siparisler = [];
let siparis_id = 100;

app.get('/', (req, res) => {
  res.json({ mesaj: 'Yakinda Ne Var API calisiyor!', versiyon: '1.0' });
});

app.get('/api/esnaflar', (req, res) => {
  const { ilce, kategori } = req.query;
  let sonuc = esnaflar;
  if (ilce) sonuc = sonuc.filter(e => e.ilce.toLowerCase() === ilce.toLowerCase());
  if (kategori) sonuc = sonuc.filter(e => e.kategori === kategori);
  res.json({ basari: true, veri: sonuc });
});

app.get('/api/esnaflar/:id', (req, res) => {
  const esnaf = esnaflar.find(e => e.id === parseInt(req.params.id));
  if (!esnaf) return res.status(404).json({ basari: false, mesaj: 'Esnaf bulunamadi' });
  res.json({ basari: true, veri: esnaf });
});

app.post('/api/esnaflar', (req, res) => {
  const { ad, kategori, ilce } = req.body;
  if (!ad || !kategori || !ilce) return res.status(400).json({ basari: false, mesaj: 'Eksik bilgi' });
  const yeni = { id: esnaflar.length + 1, ad, kategori, ilce, puan: 0, acik: true, urunler: [] };
  esnaflar.push(yeni);
  res.json({ basari: true, veri: yeni, mesaj: 'Esnaf eklendi!' });
});

app.post('/api/siparisler', (req, res) => {
  const { esnaf_id, urunler, teslimat_turu, adres } = req.body;
  if (!esnaf_id || !urunler) return res.status(400).json({ basari: false, mesaj: 'Eksik bilgi' });
  const esnaf = esnaflar.find(e => e.id === parseInt(esnaf_id));
  if (!esnaf) return res.status(404).json({ basari: false, mesaj: 'Esnaf bulunamadi' });
  let toplam = 0;
  urunler.forEach(u => { toplam += u.fiyat * u.adet; });
  const kurye = teslimat_turu === 'kurye' ? 15 : 0;
  const komisyon = Math.round(toplam * 0.05);
  const yeni = { id: ++siparis_id, esnaf_adi: esnaf.ad, urunler, teslimat_turu, adres, ara_toplam: toplam, kurye_ucreti: kurye, komisyon, genel_toplam: toplam + kurye + komisyon, durum: 'bekliyor', tarih: new Date().toISOString() };
  siparisler.push(yeni);
  res.json({ basari: true, veri: yeni, mesaj: 'Siparis alindi!' });
});

app.get('/api/siparisler', (req, res) => {
  res.json({ basari: true, veri: siparisler });
});

app.get('/api/ilceler', (req, res) => {
  res.json({ basari: true, veri: ['Marmaris', 'Bodrum', 'Fethiye', 'Datca', 'Milas'] });
});

app.listen(3000, () => {
  console.log('API calisiyor: http://localhost:3000');
  console.log('Esnaflar: http://localhost:3000/api/esnaflar');
});