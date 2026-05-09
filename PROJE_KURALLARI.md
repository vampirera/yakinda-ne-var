# Yakında Ne Var? — Proje Hafızası

Türkçe yerel pazar ve teslimat uygulaması (Marmaris/Muğla, Türkiye)
Son güncelleme: 2026-05-09

---

## Önemli URL'ler

| | |
|---|---|
| Frontend | https://vampirera.github.io/yakinda-ne-var |
| Backend API | https://yakinda-ne-var-backend-production.up.railway.app |
| GitHub | https://github.com/vampirera/yakinda-ne-var |
| Sağlık kontrolü | GET /api/ping |

Admin girişi: `ADMIN_TELEFON` ve `ADMIN_SIFRE` env variable'larıyla çalışıyor.

---

## Tech Stack

- **Frontend:** Vanilla JS, Leaflet.js 1.9.4 + OpenStreetMap, gömülü CSS, localStorage cache (5 dk TTL)
- **Backend:** Node.js + Express 4.18, ~84 endpoint, in-memory cache (esnaflar 2 dk, ilçeler 1 sa)
- **Veritabanı:** PostgreSQL (Railway)
- **Görseller:** Cloudinary
- **AI:** OpenAI gpt-4o-mini (görsel arama / kategorizasyon)
- **Bildirim:** WhatsApp via Twilio + uygulama içi bildirim sistemi
- **PWA:** manifest.json + service worker (CACHE v6, network-first strateji)
- **CI/CD:** GitHub Actions → GitHub Pages (frontend), Railway auto-deploy (backend)

---

## Veritabanı Tabloları

`esnaflar`, `urunler`, `yorumlar`, `siparisler`, `kuryeler`, `kullanicilar`, `kampanyalar`,
`bildirim_tokenler`, `hizmetler`, `randevular`, `bekleme_listesi`, `bildirimler`,
`is_ilanlari`, `teklifler`, `sorular`

Boş DB'de Marmaris örnek esnafları (Usta Kebapçı, Kardeşler Market vb.) otomatik seed ediliyor.

---

## Tamamlanan Özellikler (güncel)

**Çekirdek**
- Harita üzerinde esnaf keşfi, mesafe hesaplama (Haversine, merkez: Marmaris 36.8550N 28.2753E)
- Müşteri / Esnaf / Kurye kayıt + OTP doğrulama (esnaf/kurye kaydında OTP yok, admin onaylıyor)
- Sipariş sistemi + WhatsApp bildirimleri + gerçek zamanlı kurye konum takibi (polling)
- Favoriler (kullanıcıya özel localStorage anahtarı)

**Esnaf Paneli**
- Ürün / kampanya / çalışma saati yönetimi
- Kapak fotoğrafı yükleme (Cloudinary)
- İstatistik & analitik panel (görüntüleme, sosyal kanıt sayacı)
- Öne çıkan esnaflar (admin tarafından işaretleniyor)
- İlan bildirimi tercihi

**Hizmet Esnafları**
- Hizmet tanımlama ve fiyatlandırma
- Randevu sistemi: slot bazlı, off-peak indirim, bekleme listesi, hatırlatma
- Soru-cevap sistemi (müşteri sorar, esnaf yanıtlar)

**İş İlanları Modülü**
- İlan oluşturma (fotoğraflı), düzenleme, yayından kaldırma
- Teklif verme, teklif kabul/red
- İlan ve teklif bildirimleri, güncelleme tarihi gösterimi

**Admin Paneli**
- Esnaf / kurye onay akışları
- Müşteri / esnaf / kurye listeleme ve silme
- Sipariş görüntüleme

**PWA & UX**
- Uygulama içi bildirim sistemi
- Arama: ilk 5 sonuç + "Tümünü göster" butonu
- Boş durum mesajları (spinner yerine bilgi metni)

---

## Bilinen Mimari Notlar

- `app.js` tek dosya ~4400 satır — yeni özellik eklerken mevcut sayfa fonksiyonlarını bozmamaya dikkat
- `server.js` tek dosya ~1970 satır, 84 endpoint — endpoint eklerken cache invalidation'ı gözden geçir
- Service worker `v6`: HTML/JS her zaman network-first, sadece Leaflet cache-first
- Favoriler ve oturum bilgisi localStorage'da — farklı kullanıcılar aynı cihazı kullanırsa çakışma riski var (telefon bazlı anahtar ile çözüldü)
- Twilio WhatsApp mesajları async — hata kullanıcıya gösteriliyor ama sipariş yine de oluşuyor
- Esnaf/kurye kaydında OTP akışı yok (admin zaten onaylıyor), sadece müşteride OTP var

---

## Geliştirme Kuralları

- Mevcut çalışan koda dokunmadan sadece istenen özelliği ekle.
- Değişiklik yapmadan önce ne yapacağını kısaca açıkla.
- SQL injection'a karşı her zaman parametreli sorgu kullan.
- Env variable'ları asla koda yazma.
- Hata mesajlarında stack trace veya sunucu detayı verme.
- Cache-busting: `app.js?v=` ve SW `CACHE_ADI` versiyonunu değişiklikle birlikte güncelle.

---

## Bu Oturum

**Hedef:**
[→ Bugün ne yapmak istediğini buraya yaz]

**Notlar / Yarım Kalanlar:**
[→ Oturum sonunda buraya bıraktığın yeri yaz — bir sonraki oturumda buradan devam edersin]
