# Yakinda Ne Var

Türkçe: "Yakında Ne Var?" — Yerel esnafları, müşterileri ve kuryeleri buluşturan hiperlokal bir marketplace uygulaması. Kullanıcılar konumlarına yakın esnafları haritada görüp sipariş verebilir; esnaflar panel üzerinden ürün/kampanya yönetebilir; kuryeler siparişleri alabilir. Marmaris/Muğla bölgesi odaklı.

---

## Teknoloji Stack

### Frontend
- Vanilla JavaScript (framework yok)
- Leaflet.js 1.9.4 + OpenStreetMap (harita)
- Gömülü CSS, mobil-önce responsive tasarım (390×844px telefon çerçevesi)
- localStorage — client-side cache (5 dk TTL) ve oturum yönetimi

### Backend
- Node.js + Express.js 4.18.0
- PostgreSQL (`pg` 8.20.0)
- Cloudinary — görsel yükleme
- OpenAI gpt-4o-mini — görsel arama / ürün kategorizasyonu
- Twilio — WhatsApp bildirimleri
- Backend in-memory cache: esnaflar 2 dk, ilçeler 1 sa, esnaf detay 5 dk

### Hosting & CI/CD
- **Frontend:** GitHub Pages (GitHub Actions ile `main` dalına push'ta otomatik deploy)
- **Backend:** Railway.app (Nixpacks builder, `node server.js`)
- **Veritabanı:** Railway PostgreSQL

---

## Klasör Yapısı

```
yakinda-ne-var/
├── index.html               # Ana uygulama sayfası (gömülü CSS)
├── app.js                   # Frontend uygulama mantığı (~1900 satır)
├── esnaf-detay.html         # Esnaf detay sayfası
├── musteri-anasayfa.html    # Müşteri anasayfa alternatifi
├── uygulama.html            # Basit uygulama başlatıcı
├── leaflet.js / leaflet.css # Harita kütüphanesi
├── images/                  # Leaflet marker ikonları
├── package.json             # Root: start scripti (node backend/server.js)
├── vercel.json              # Vercel SPA yönlendirmesi
├── .github/
│   └── workflows/
│       └── deploy.yml       # GitHub Pages otomatik deploy
└── backend/
    ├── server.js            # Express API (~680 satır, 40+ endpoint)
    ├── package.json         # Backend bağımlılıkları
    ├── railway.json         # Railway deploy konfigürasyonu
    ├── .env                 # Gizli anahtarlar (git'e dahil değil)
    └── uploads/             # Geçici dosya yüklemeleri (git'e dahil değil)
```

---

## Önemli URL'ler

| Kaynak | URL |
|--------|-----|
| Frontend (GitHub Pages) | https://vampirera.github.io/yakinda-ne-var |
| Backend API (Railway) | https://yakinda-ne-var-backend-production.up.railway.app |
| API sağlık kontrolü | `GET /api/ping` |
| GitHub repo | https://github.com/vampirera/yakinda-ne-var |

---

## Veritabanı Tabloları

### `esnaflar` — İşletmeler/Esnaflar
`id, ad, kategori, ilce, adres, telefon, email, vergi_no, lat, lng, puan, yorum_sayisi, acik, onayli, onaylandi, sifre, calisma_saatleri (JSONB), kayit_tarihi`

### `urunler` — Ürünler
`id, esnaf_id (FK), ad, fiyat, aciklama, fotograf_url`

### `yorumlar` — Yorumlar ve Puanlar
`id, esnaf_id (FK), kullanici, puan (1–5), yorum, tarih`

### `siparisler` — Siparişler
`id, esnaf_id, esnaf_adi, musteri_telefon, urunler (JSONB), teslimat_turu, adres, ara_toplam, kurye_ucreti, komisyon, genel_toplam, durum, kurye_id (FK), tarih`

### `kuryeler` — Kuryeler
`id, ad, telefon, arac_tipi, ilce, onaylandi, kayit_tarihi`

### `kullanicilar` — Birleşik Kimlik Doğrulama
`id, ad, telefon (UNIQUE), sifre, tip (musteri/esnaf/kurye), esnaf_id (FK), kurye_id (FK), olusturma`

### `kampanyalar` — Kampanya/Promosyonlar
`id, esnaf_id (FK), baslik, aciklama, indirim_orani, bitis_tarihi, aktif, olusturma_tarihi`

**Not:** Veritabanı boşsa Marmaris'te örnek esnaflarla (Usta Kebapçı, Kardeşler Market, vb.) otomatik dolduruluyor.

---

## Önemli Env Variable'lar

`backend/.env` dosyasında bulunur (git'e dahil değil, Railway'de environment variables olarak da set edilmeli):

```
DATABASE_URL=           # Railway PostgreSQL bağlantı URI'si
OPENAI_API_KEY=         # Görsel arama için (gpt-4o-mini)
TWILIO_ACCOUNT_SID=     # WhatsApp bildirimleri
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=   # whatsapp:+14155238886
ADMIN_TELEFON=          # Admin girişi için telefon numarası
ADMIN_SIFRE=            # Admin şifresi (Railway'de env var olarak set edilir)
CLOUDINARY_CLOUD_NAME=  # Görsel yükleme (opsiyonel)
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
GEMINI_API_KEY=         # Kurulu ama aktif kullanılmıyor
```

---

## Geliştirme Workflow'u

### Lokal Çalıştırma

```bash
# Backend'i başlat
cd backend
npm install
node server.js
# API: http://localhost:3000

# Frontend: index.html'yi tarayıcıda aç veya root dizini serve et
# Backend URL'sini app.js'de localhost:3000'e çevirmek gerekebilir
```

### Deploy

**Frontend (GitHub Pages):**
```bash
git push origin main
# .github/workflows/deploy.yml otomatik tetiklenir
# Root dizin yayınlanır (backend/ hariç)
```

**Backend (Railway):**
- Railway GitHub entegrasyonu varsa `main`'e push yeterli
- Manuel: Railway dashboard → Deploy
- Config: `backend/railway.json` (builder: NIXPACKS, start: `node server.js`)

### Kullanıcı Tipleri
- `musteri` — Müşteri
- `esnaf` — İşletme sahibi
- `kurye` — Kurye
- `admin` — Env variable'lardan kimlik doğrulama (ADMIN_TELEFON / ADMIN_SIFRE)

### Mesafe Hesaplama
Varsayılan merkez: Marmaris (36.8550°N, 28.2753°E), Haversine formülü
