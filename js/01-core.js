// =============================================================
// Yakinda Ne Var - Frontend App
// =============================================================

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/yakinda-ne-var/sw.js');
  navigator.serviceWorker.addEventListener('controllerchange', function() {
    var toast = document.getElementById('guncelleme-toast');
    if (toast) toast.style.display = 'block';
    setTimeout(function() { window.location.reload(); }, 1500);
  });
  navigator.serviceWorker.addEventListener('message', function(event) {
    if (event.data && event.data.tip === 'GUNCELLEME_VAR') {
      var toast = document.getElementById('guncelleme-toast');
      if (toast) toast.style.display = 'block';
      setTimeout(function() { window.location.reload(); }, 1500);
    }
  });
}


// XSS koruması — DOMPurify ile metin temizle
function temizle(str) {
  if (str === null || str === undefined) return '';
  if (typeof DOMPurify !== 'undefined') return DOMPurify.sanitize(String(str), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

var API_URL = 'https://yakinda-ne-var-backend-production.up.railway.app';

// Auth header yardımcısı — token varsa Bearer ekler
function authHeader() {
  var oturum = oturumAl();
  if (oturum && oturum.token) {
    return { 'Authorization': 'Bearer ' + oturum.token };
  }
  return {};
}

// JSON + auth header
function jsonAuthHeader() {
  return Object.assign({ 'Content-Type': 'application/json' }, authHeader());
}

function bildirim(mesaj, tip) {
  tip = tip || 'bilgi';
  var container = document.getElementById('bildirim-toast');
  if (!container) return;
  var el = document.createElement('div');
  el.className = 'bildirim-item ' + tip;
  el.textContent = mesaj;
  container.appendChild(el);
  requestAnimationFrame(function() { el.classList.add('goster'); });
  setTimeout(function() {
    el.classList.remove('goster');
    setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 350);
  }, 3000);
}

var VAPID_KEY = 'BMShtgCFEigjmfHuq6ijOmO2vVBhTkACupg9FXi8k7W88ute3JuwbGnAuuJ4-WzZaBVYK2IIFu_9B5TYDAlFNWI';

function bildirimIzniAl() {
  if (!('Notification' in window) || !window.firebase) return;
  if (Notification.permission === 'denied') return;

  var messaging = firebase.messaging();
  Notification.requestPermission().then(function(izin) {
    if (izin !== 'granted') return;
    return messaging.getToken({ vapidKey: VAPID_KEY });
  }).then(function(token) {
    if (!token) return;
    var oturum = oturumAl();
    fetch(API_URL + '/api/bildirim-token', {
      method: 'POST',
      headers: jsonAuthHeader(),
      body: JSON.stringify({
        token: token,
        kullanici_telefon: oturum ? oturum.telefon : null
      })
    });
    messaging.onMessage(function(payload) {
      if (payload.notification) {
        new Notification(payload.notification.title, {
          body: payload.notification.body,
          icon: '/yakinda-ne-var/icon-192.png'
        });
      }
    });
  }).catch(function() {});
}

var durum = {
  lat: null,
  lng: null,
  kategori: null,
  siralama: 'mesafe',
  arama: '',
  mesafeFiltre: 2,
  panelEsnafId: null,
  oturumTip: null,
  teslimat: 'kurye',
  secilenEsnaf: null,
  sepet: [],
  secilenPuan: 0,
  anaHarita: null,
  detayHarita: null,
  kayitHarita: null,
  kayitLat: null,
  kayitLng: null,
  anaHaritaTamEkran: false,
  anaMarkers: [],
  anaClusterGroup: null,
  kamuMarkersAna: [],
  profilHarita: null,
  profilHaritaMarker: null
};

// =============================================================
// FRONTEND CACHE (localStorage, 5 dakika)
// =============================================================

var FRONTEND_CACHE_TTL = 5 * 60 * 1000;

function fcAl(key) {
  try {
    var e = JSON.parse(localStorage.getItem('fc_' + key) || 'null');
    if (!e) return null;
    if (Date.now() > e.exp) { localStorage.removeItem('fc_' + key); return null; }
    return e.data;
  } catch(err) { return null; }
}

function fcKaydet(key, data) {
  try { localStorage.setItem('fc_' + key, JSON.stringify({ data: data, exp: Date.now() + FRONTEND_CACHE_TTL })); }
  catch(err) {}
}

function fcSil(prefix) {
  Object.keys(localStorage).forEach(function(k) {
    if (k.startsWith('fc_' + prefix)) localStorage.removeItem(k);
  });
}

// =============================================================
// MÜŞTERİ PROFİLİ
// =============================================================

function profilYukle() {
  try { return JSON.parse(localStorage.getItem('musteri_profil') || 'null'); }
  catch(e) { return null; }
}

function profilKaydet(profil) {
  localStorage.setItem('musteri_profil', JSON.stringify(profil));
}

function profilBackendSync(profil) {
  var oturum = oturumAl();
  if (!oturum || oturum.tip !== 'musteri' || !oturum.kullanici_id) return;
  fetch(API_URL + '/api/musteri/profil', {
    method: 'PUT',
    headers: jsonAuthHeader(),
    body: JSON.stringify({
      id: oturum.kullanici_id,
      telefon: oturum.telefon,
      email: profil.email || '',
      adresler: profil.adresler || []
    })
  }).catch(function() {});  // sessizce başarısız ol, localStorage'daki veri yeterli
}

function profilSayfasiGoster() {
  var profil  = profilYukle() || {};
  var oturum  = oturumAl();
  sayfaGoster('profil');

  var ad      = (oturum && oturum.ad) ? oturum.ad : (profil.isim || '');
  var telefon = (oturum && oturum.telefon) ? oturum.telefon : (profil.telefon || '');
  var tip     = oturum ? oturum.tip : '';
  var tipEtiket = { musteri: '👤 Müşteri', esnaf: '🏪 Esnaf', kurye: '🛵 Kurye', admin: '⚙️ Admin' };

  document.getElementById('profil-hosgeldin').textContent = 'Merhaba, ' + (ad || 'Misafir') + '!';
  document.getElementById('profil-tip-rozet').textContent = tipEtiket[tip] || '';

  var musteriEl = document.getElementById('profil-musteri-icerik');
  var kuryeEl   = document.getElementById('profil-kurye-icerik');

  if (tip === 'kurye') {
    musteriEl.style.display = 'none';
    kuryeEl.style.display   = 'block';
    document.getElementById('kurye-profil-ad').value      = ad;
    document.getElementById('kurye-profil-telefon').value = telefon;
    document.getElementById('kurye-profil-ilce').value    = (oturum && oturum.ilce) ? oturum.ilce : '';
    document.getElementById('kurye-profil-arac').value    = (oturum && oturum.arac_tipi) ? oturum.arac_tipi : '';
    var onayEl = document.getElementById('kurye-onay-durumu');
    if (oturum && oturum.onaylandi) {
      onayEl.style.background = '#e8f5e9';
      onayEl.style.color      = '#2e7d32';
      onayEl.textContent      = '✅ Hesabınız onaylı — aktif olarak teslimat yapabilirsiniz.';
      document.getElementById('kurye-bekleyen-wrap').style.display = '';
      document.getElementById('kurye-aktif-wrap').style.display = '';
      kuryeAktifSiparisleriYukle();
      kuryeBekleyenleriYukle();
      kuryeKonumPaylasimiBaslat(telefon);
    } else {
      onayEl.style.background = '#fff8e1';
      onayEl.style.color      = '#f57f17';
      onayEl.textContent      = '⏳ Başvurunuz inceleniyor. Onaylandığında bildirim alacaksınız.';
      document.getElementById('kurye-bekleyen-wrap').style.display = 'none';
      document.getElementById('kurye-aktif-wrap').style.display = 'none';
    }
  } else {
    musteriEl.style.display = 'block';
    kuryeEl.style.display   = 'none';
    document.getElementById('profil-isim').value             = ad;
    document.getElementById('profil-telefon').value          = telefon;
    document.getElementById('profil-email').value            = profil.email || '';
    document.getElementById('profil-kart-ad').value          = profil.kart_ad    || '';
    document.getElementById('profil-kart-son4').value        = profil.kart_son4  || '';
    document.getElementById('profil-kart-tarih').value       = profil.kart_tarih || '';
    document.getElementById('profil-lat').value              = '';
    document.getElementById('profil-lng').value              = '';
    document.getElementById('profil-harita-wrap').style.display = 'none';
    document.getElementById('yeni-adres-input').value        = '';
    document.getElementById('yeni-adres-baslik').value       = '';
    document.getElementById('odeme-icerik').style.display    = 'none';
    document.getElementById('odeme-ok').textContent          = '▼';
    adresListesiGoster();
  }
}

function adresListesiGoster() {
  var profil   = profilYukle() || {};
  var adresler = profil.adresler || [];
  var el = document.getElementById('adres-listesi');
  if (!adresler.length) {
    el.innerHTML = '<div style="color:#aaa;font-size:.8rem;padding:4px 0">Henüz kayıtlı adres yok.</div>';
    return;
  }
  el.innerHTML = adresler.map(function(a, i) {
    var secili = a.secili;
    return '<div onclick="adresDetayGoster(' + i + ')" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;margin-bottom:6px;cursor:pointer;border:2px solid ' + (secili ? '#ff6b35' : '#eee') + ';background:' + (secili ? '#fff8f5' : '#fafafa') + '">' +
      '<div style="width:18px;height:18px;border-radius:50%;border:2px solid ' + (secili ? '#ff6b35' : '#ccc') + ';background:' + (secili ? '#ff6b35' : '#fff') + ';flex-shrink:0"></div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-weight:700;font-size:.82rem;color:#333">' + temizle(a.baslik || 'Adres') + (secili ? ' <span style="color:#ff6b35;font-size:.7rem">● Seçili</span>' : '') + '</div>' +
        '<div style="font-size:.75rem;color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + temizle(a.adres) + '</div>' +
      '</div>' +
      '<span style="color:#bbb;font-size:1rem">›</span>' +
    '</div>';
  }).join('');
}

function adresDetayGoster(index) {
  var profil   = profilYukle() || {};
  var adresler = profil.adresler || [];
  var a = adresler[index];
  if (!a) return;

  var icerik = document.getElementById('adres-modal-icerik');
  icerik.innerHTML =
    '<h3 style="margin:0 30px 14px 0;font-size:1rem">📍 ' + temizle(a.baslik || 'Adres') + '</h3>' +
    '<div style="background:#f9f9f9;border-radius:10px;padding:12px;margin-bottom:14px;font-size:.85rem;line-height:1.8;color:#444">' +
      temizle(a.adres) +
      (a.lat && a.lng ? '<br><span style="color:#aaa;font-size:.75rem">📌 Konum: ' + parseFloat(a.lat).toFixed(5) + ', ' + parseFloat(a.lng).toFixed(5) + '</span>' : '') +
    '</div>' +
    '<div style="display:flex;gap:8px">' +
      (!a.secili
        ? '<button onclick="adresSec(' + index + ')" style="flex:1;background:#ff6b35;color:#fff;border:none;border-radius:10px;padding:10px;font-size:.82rem;font-weight:700;cursor:pointer">✓ Bu Adresi Seç</button>'
        : '<div style="flex:1;background:#fff8f5;color:#ff6b35;border:2px solid #ff6b35;border-radius:10px;padding:10px;font-size:.82rem;font-weight:700;text-align:center">✅ Seçili Adres</div>'
      ) +
      '<button onclick="adresSilModaldan(' + index + ')" style="flex:1;background:#ffebee;color:#c62828;border:none;border-radius:10px;padding:10px;font-size:.82rem;font-weight:700;cursor:pointer">🗑 Sil</button>' +
    '</div>';

  // Haritayı göster (lat/lng varsa)
  var haritaWrap = document.getElementById('adres-detay-harita');
  if (a.lat && a.lng) {
    haritaWrap.style.display = 'block';
    setTimeout(function() {
      var mapEl = document.getElementById('adres-detay-harita-ic');
      if (!durum.adresDetayHarita) {
        durum.adresDetayHarita = L.map('adres-detay-harita-ic', { zoomControl: false, attributionControl: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(durum.adresDetayHarita);
      }
      durum.adresDetayHarita.setView([a.lat, a.lng], 16);
      durum.adresDetayHarita.invalidateSize();
      if (durum.adresDetayMarker) durum.adresDetayMarker.remove();
      durum.adresDetayMarker = L.marker([a.lat, a.lng]).addTo(durum.adresDetayHarita).bindPopup(a.baslik || 'Adres').openPopup();
    }, 150);
  } else {
    haritaWrap.style.display = 'none';
  }

  document.getElementById('adres-modal').style.display = 'block';
}

function adresSec(index) {
  var profil   = profilYukle() || {};
  var adresler = profil.adresler || [];
  adresler.forEach(function(a, i) { a.secili = (i === index); });
  profil.adresler = adresler;
  profilKaydet(profil);
  profilBackendSync(profil);
  document.getElementById('adres-modal').style.display = 'none';
  adresListesiGoster();
}

function adresSilModaldan(index) {
  if (!confirm('Bu adres silinecek. Emin misiniz?')) return;
  var profil   = profilYukle() || {};
  var adresler = profil.adresler || [];
  adresler.splice(index, 1);
  if (adresler.length && !adresler.some(function(a) { return a.secili; })) adresler[0].secili = true;
  profil.adresler = adresler;
  profilKaydet(profil);
  profilBackendSync(profil);
  document.getElementById('adres-modal').style.display = 'none';
  adresListesiGoster();
}

function odemeToggle() {
  var icerik = document.getElementById('odeme-icerik');
  var ok     = document.getElementById('odeme-ok');
  var acik   = icerik.style.display !== 'none';
  icerik.style.display = acik ? 'none' : 'block';
  ok.textContent = acik ? '▼' : '▲';
}

function profilFormuBaslat() {
  document.getElementById('profil-kaydet').addEventListener('click', function() {
    var isim = document.getElementById('profil-isim').value.trim();
    if (!isim) { bildirim('Ad Soyad zorunludur.', 'uyari'); return; }
    var mevcutProfil = profilYukle() || {};

    // Eğer adres alanında yazı varsa ve "+ Ekle" butonuna basılmamışsa otomatik ekle
    var yeniAdres = document.getElementById('yeni-adres-input').value.trim();
    if (yeniAdres) {
      var baslik = document.getElementById('yeni-adres-baslik').value.trim() || 'Adres';
      var lat = document.getElementById('profil-lat').value;
      var lng = document.getElementById('profil-lng').value;
      var adresler = mevcutProfil.adresler || [];
      adresler.push({ baslik: baslik, adres: yeniAdres, lat: lat || null, lng: lng || null, secili: adresler.length === 0 });
      mevcutProfil.adresler = adresler;
    }

    var kaydedilecek = Object.assign(mevcutProfil, {
      isim:       isim,
      telefon:    document.getElementById('profil-telefon').value.trim(),
      email:      document.getElementById('profil-email').value.trim(),
      kart_ad:    document.getElementById('profil-kart-ad').value.trim().toUpperCase(),
      kart_son4:  document.getElementById('profil-kart-son4').value.trim(),
      kart_tarih: document.getElementById('profil-kart-tarih').value.trim()
    });
    profilKaydet(kaydedilecek);
    profilBackendSync(kaydedilecek);
    document.getElementById('profil-hosgeldin').textContent = 'Merhaba, ' + isim + '!';
    bildirim('Profil kaydedildi!', 'basari');
    sayfaGoster('ana');
  });

  document.getElementById('adres-ekle-btn').addEventListener('click', function() {
    var adres  = document.getElementById('yeni-adres-input').value.trim();
    var baslik = document.getElementById('yeni-adres-baslik').value.trim() || 'Adres';
    if (!adres) { bildirim('Adres boş olamaz.', 'uyari'); return; }
    var lat = document.getElementById('profil-lat').value;
    var lng = document.getElementById('profil-lng').value;
    var profil = profilYukle() || {};
    var adresler = profil.adresler || [];
    adresler.push({ baslik: baslik, adres: adres, lat: lat || null, lng: lng || null, secili: adresler.length === 0 });
    profil.adresler = adresler;
    profilKaydet(profil);
    profilBackendSync(profil);
    document.getElementById('yeni-adres-input').value  = '';
    document.getElementById('yeni-adres-baslik').value = '';
    document.getElementById('profil-lat').value        = '';
    document.getElementById('profil-lng').value        = '';
    document.getElementById('profil-harita-wrap').style.display = 'none';
    adresListesiGoster();
  });

  function cikisYapProfil() { cikisYap(); }
  document.getElementById('profil-cikis-btn').addEventListener('click', cikisYapProfil);
  document.getElementById('profil-cikis-alt').addEventListener('click', cikisYapProfil);
  document.getElementById('profil-kurye-cikis').addEventListener('click', cikisYapProfil);

  document.getElementById('profil-konum-al').addEventListener('click', function() {
    var btn = document.getElementById('profil-konum-al');
    if (!navigator.geolocation) { bildirim('Konum desteklenmiyor.', 'uyari'); return; }
    btn.textContent = '📍 Konum aliniyor...';
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition(function(pos) {
      var lat = pos.coords.latitude;
      var lng = pos.coords.longitude;

      // Hidden input'lara yaz
      document.getElementById('profil-lat').value = lat;
      document.getElementById('profil-lng').value = lng;

      // Haritayı göster
      var wrap = document.getElementById('profil-harita-wrap');
      wrap.style.display = 'block';
      setTimeout(function() {
        if (!durum.profilHarita) {
          durum.profilHarita = L.map('profil-harita', { zoomControl: false, attributionControl: false });
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(durum.profilHarita);
          konumButonuEkle(durum.profilHarita, function(latlng) {
            if (durum.profilHaritaMarker) durum.profilHaritaMarker.remove();
            durum.profilHaritaMarker = L.marker(latlng).addTo(durum.profilHarita).bindPopup('Konumunuz').openPopup();
            document.getElementById('profil-lat').value = latlng[0];
            document.getElementById('profil-lng').value = latlng[1];
            durum.lat = latlng[0]; durum.lng = latlng[1];
            reverseGeocode(latlng[0], latlng[1], function(adres) {
              document.getElementById('profil-konum-bilgi').textContent = '📍 ' + adres;
            });
          });
        }
        durum.profilHarita.setView([lat, lng], 16);
        durum.profilHarita.invalidateSize();
        if (durum.profilHaritaMarker) durum.profilHaritaMarker.remove();
        durum.profilHaritaMarker = L.marker([lat, lng]).addTo(durum.profilHarita).bindPopup('Konumunuz').openPopup();
        reverseGeocode(lat, lng, function(adres) {
          document.getElementById('profil-konum-bilgi').textContent = '📍 ' + adres;
        });
      }, 100);

      durum.lat = lat;
      durum.lng = lng;
      btn.textContent = '✅ Konum Alındı';
      btn.disabled = false;
    }, function() {
      bildirim('Konum alınamadı. Lütfen izin verin.', 'uyari');
      btn.textContent = '📍 Konum Al';
      btn.disabled = false;
    });
  });

  document.getElementById('profil-geri').addEventListener('click', function() {
    sayfaGoster('ana');
  });
}

// =============================================================
// SİPARİŞ TAKİBİ
// =============================================================

var siparisTakip = {
  siparisId: null,
  interval: null
};

var durumAdim = ['bekliyor', 'hazirlaniyor', 'yolda', 'teslim edildi'];
var durumIkon  = { 'bekliyor': '⏳', 'hazirlaniyor': '👨‍🍳', 'yolda': '🛵', 'teslim edildi': '✅', 'iptal': '❌' };
var durumRenk  = { 'bekliyor': '#ff9800', 'hazirlaniyor': '#2196f3', 'yolda': '#9c27b0', 'teslim edildi': '#4caf50', 'iptal': '#f44336' };
var aktifDurumlar = ['bekliyor', 'hazirlaniyor', 'yolda'];

function telefon() {
  var oturum = oturumAl();
  var profil = profilYukle();
  return (oturum && oturum.telefon) || (profil && profil.telefon) || null;
}

// ── İLAN VER SAYFASI ─────────────────────────────────────────────

var _ilanFotoUrl = null;
var _ilanSecilenKategori = null;
var _ilanlarimVeri = [];

function ilanVerSayfasiGoster() {
  var oturum = oturumAl();
  if (!oturum) { bildirim('İlan vermek için giriş yapın.', 'uyari'); sayfaGoster('kayit-secim'); return; }
  if (oturum.tip === 'esnaf' || oturum.tip === 'admin') { bildirim('Bu özellik müşteriler için.', 'uyari'); return; }
  // Formu sıfırla
  _ilanFotoUrl = null;
  _ilanSecilenKategori = null;
  var el;
  ['ilan-pg-baslik','ilan-pg-aciklama','ilan-pg-butce-min','ilan-pg-butce-max'].forEach(function(id) {
    el = document.getElementById(id); if (el) el.value = '';
  });
  el = document.getElementById('ilan-foto-onizleme');
  if (el) { el.style.display = 'none'; el.src = ''; }
  el = document.getElementById('ilan-foto-placeholder'); if (el) el.style.display = '';
  el = document.getElementById('ilan-foto-degistir'); if (el) el.style.display = 'none';
  el = document.getElementById('ilan-foto-yukluyor'); if (el) el.style.display = 'none';
  ['yemek','urun','hizmet'].forEach(function(k) {
    el = document.getElementById('kat-btn-' + k);
    if (el) { el.style.borderColor = '#e0e0e0'; el.style.background = '#fff'; el.style.color = '#555'; }
  });
  el = document.getElementById('ilan-ver-gonder-btn');
  if (el) { el.disabled = false; el.textContent = '🚀 İlanı Yayınla'; }
  sayfaGoster('ilan-ver');
}

function ilanFotoSec() {
  document.getElementById('ilan-foto-input').click();
}

function ilanFotoSecildi(input) {
  var file = input.files[0];
  if (!file) return;
  // Anlık önizleme
  var reader = new FileReader();
  reader.onload = function(e) {
    var oniz = document.getElementById('ilan-foto-onizleme');
    var ph   = document.getElementById('ilan-foto-placeholder');
    var deg  = document.getElementById('ilan-foto-degistir');
    oniz.src = e.target.result;
    oniz.style.display = 'block';
    ph.style.display = 'none';
    if (deg) deg.style.display = '';
  };
  reader.readAsDataURL(file);
  // Cloudinary'e yükle
  var yukluyor = document.getElementById('ilan-foto-yukluyor');
  if (yukluyor) yukluyor.style.display = 'flex';
  var fd = new FormData();
  fd.append('foto', file);
  fetch(API_URL + '/api/is-ilani/fotograf', { method: 'POST', body: fd })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (yukluyor) yukluyor.style.display = 'none';
      if (data.basari) { _ilanFotoUrl = data.url; bildirim('Fotoğraf yüklendi.', 'basari'); }
      else { bildirim('Fotoğraf yüklenemedi: ' + data.mesaj, 'hata'); }
    }).catch(function() {
      if (yukluyor) yukluyor.style.display = 'none';
      bildirim('Fotoğraf yüklenemedi.', 'hata');
    });
}

function ilanKategoriSec(kategori) {
  _ilanSecilenKategori = kategori;
  ['yemek','urun','hizmet'].forEach(function(k) {
    var btn = document.getElementById('kat-btn-' + k);
    if (!btn) return;
    var secili = k === kategori;
    btn.style.borderColor = secili ? '#ff6b35' : '#e0e0e0';
    btn.style.background  = secili ? '#fff8f5' : '#fff';
    btn.style.color       = secili ? '#ff6b35' : '#555';
  });
}

function ilanVerGonder() {
  var oturum = oturumAl();
  if (!oturum) { bildirim('Giriş yapmanız gerekiyor.', 'uyari'); return; }
  if (!_ilanSecilenKategori) { bildirim('Kategori seçimi zorunludur.', 'uyari'); return; }
  var baslik = document.getElementById('ilan-pg-baslik').value.trim();
  if (!baslik) { bildirim('Ne aradığınızı yazın.', 'uyari'); return; }
  var btn = document.getElementById('ilan-ver-gonder-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Gönderiliyor...'; }
  fetch(API_URL + '/api/is-ilani', {
    method: 'POST',
    headers: jsonAuthHeader(),
    body: JSON.stringify({
      musteri_telefon: oturum.telefon,
      musteri_ad: oturum.ad,
      baslik: baslik,
      aciklama: document.getElementById('ilan-pg-aciklama').value.trim() || null,
      kategori: _ilanSecilenKategori,
      butce_min: document.getElementById('ilan-pg-butce-min').value || null,
      butce_max: document.getElementById('ilan-pg-butce-max').value || null,
      fotograf_url: _ilanFotoUrl || null
    })
  }).then(function(r) { return r.json(); })
  .then(function(data) {
    if (btn) { btn.disabled = false; btn.textContent = '🚀 İlanı Yayınla'; }
    bildirim(data.mesaj || (data.basari ? 'İlan yayınlandı!' : 'Hata.'), data.basari ? 'basari' : 'hata');
    if (data.basari) {
      sayfaGoster('siparislerim');
      setTimeout(function() { siparislerSekmeSec('ilanlar'); }, 200);
    }
  }).catch(function() {
    if (btn) { btn.disabled = false; btn.textContent = '🚀 İlanı Yayınla'; }
    bildirim('Bağlantı hatası.', 'hata');
  });
}

// ── İŞ İLANLARI ─────────────────────────────────────────────────

var _aktifSiparislerSekme = 'siparisler';

function siparislerSekmeSec(sekme) {
  _aktifSiparislerSekme = sekme;
  var sipBtn = document.getElementById('sekme-btn-siparisler');
  var ilanBtn = document.getElementById('sekme-btn-ilanlar');
  var sipIcerik = document.getElementById('siparislerim-icerik');
  var ilanIcerik = document.getElementById('ilanlarim-icerik');
  if (sekme === 'siparisler') {
    sipBtn.style.background = '#1a1a2e'; sipBtn.style.color = '#fff';
    ilanBtn.style.background = '#f0f0f0'; ilanBtn.style.color = '#555';
    sipIcerik.style.display = ''; ilanIcerik.style.display = 'none';
  } else {
    ilanBtn.style.background = '#1a1a2e'; ilanBtn.style.color = '#fff';
    sipBtn.style.background = '#f0f0f0'; sipBtn.style.color = '#555';
    sipIcerik.style.display = 'none'; ilanIcerik.style.display = '';
    ilanlarimYukle();
  }
}

function ilanTarihFormatla(tarihStr) {
  if (!tarihStr) return '';
  var d = new Date(tarihStr);
  var aylar = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  return d.getDate() + ' ' + aylar[d.getMonth()] + ' ' + d.getFullYear() + ', ' +
    String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

function ilanlarimYukle() {
  var oturum = oturumAl();
  if (!oturum || !oturum.telefon) return;
  var con = document.getElementById('ilanlarim-icerik');
  con.innerHTML = '<div class="yukleniyor"></div>';
  fetch(API_URL + '/api/ilanlarim?telefon=' + encodeURIComponent(oturum.telefon))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var ilanlar = data.basari ? data.veri : [];
      _ilanlarimVeri = ilanlar;
      var html = '<div style="margin-bottom:12px;font-size:.75rem;font-weight:800;color:#1a1a2e;text-transform:uppercase">İlanlarım (' + ilanlar.length + ')</div>';
      if (!ilanlar.length) {
        html += '<div style="text-align:center;padding:40px;color:#aaa"><div style="font-size:2.5rem;margin-bottom:8px">📋</div>Henüz ilan oluşturmadınız.<br><small>Esnaflardan teklif almak için ilan açın!</small></div>';
      } else {
        var katRenk = { yemek: '#e65100', urun: '#1565c0', hizmet: '#2e7d32' };
        var katIkon = { yemek: '🍔', urun: '📦', hizmet: '🔧' };
        html += ilanlar.map(function(ilan) {
          var durumRenk = { acik: '#2e7d32', kapali: '#888', iptal: '#c62828' };
          var renk = durumRenk[ilan.durum] || '#888';
          var yanıtlar = (ilan.teklifler || []).filter(Boolean);

          // Fotoğraf varsa göster (tıklanabilir lightbox)
          var _fotoSrc = ilan.fotograf_url ? ilan.fotograf_url.replace(/'/g, "\\'") : '';
          var fotoHTML = ilan.fotograf_url
            ? '<div style="margin-bottom:10px;border-radius:10px;overflow:hidden;height:120px;cursor:zoom-in" onclick="event.stopPropagation();lightboxAc(\'' + _fotoSrc + '\')">' +
                '<img src="' + ilan.fotograf_url + '" style="width:100%;height:100%;object-fit:cover;pointer-events:none">' +
              '</div>'
            : '';

          var yanıtHTML = '';
          if (yanıtlar.length) {
            yanıtHTML = '<div style="font-size:.72rem;font-weight:800;color:#555;margin-top:10px;margin-bottom:6px;text-transform:uppercase">İlgilenen Esnaflar (' + yanıtlar.length + ')</div>';
            yanıtHTML += yanıtlar.map(function(t) {
              var kabul = t.durum === 'kabul';
              var iletisimHTML = '';
              if (kabul || t.durum === 'bekliyor') {
                var waTel = t.esnaf_telefon ? t.esnaf_telefon.replace(/\D/g,'') : '';
                if (waTel.startsWith('0')) waTel = '90' + waTel.slice(1);
                iletisimHTML = '<div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap">' +
                  (t.durum === 'bekliyor' && ilan.durum === 'acik'
                    ? '<button onclick="teklifKabul(' + t.id + ')" style="background:#e8f5e9;color:#2e7d32;border:none;border-radius:7px;padding:5px 10px;font-size:.7rem;font-weight:700;cursor:pointer">✅ Seç</button>' +
                      '<button onclick="teklifReddet(' + t.id + ')" style="background:#ffebee;color:#c62828;border:none;border-radius:7px;padding:5px 10px;font-size:.7rem;font-weight:700;cursor:pointer">✕ Geç</button>'
                    : '') +
                  (t.esnaf_telefon
                    ? '<a href="tel:' + t.esnaf_telefon + '" style="background:#f5f5f5;color:#1a1a2e;text-decoration:none;border-radius:7px;padding:5px 10px;font-size:.7rem;font-weight:700">📞 Ara</a>' +
                      '<a href="https://wa.me/' + waTel + '" target="_blank" style="background:#e8f5e9;color:#2e7d32;text-decoration:none;border-radius:7px;padding:5px 10px;font-size:.7rem;font-weight:700">💬 WhatsApp</a>'
                    : '') +
                '</div>';
              }
              return '<div style="background:' + (kabul ? '#f0fff4' : '#f9f9f9') + ';border:1px solid ' + (kabul ? '#a5d6a7' : '#eee') + ';border-radius:10px;padding:10px;margin-bottom:6px">' +
                '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
                  '<div>' +
                    '<div style="font-size:.82rem;font-weight:800">' + (t.esnaf_ad || '') + '</div>' +
                    (t.aciklama ? '<div style="font-size:.72rem;color:#666;margin-top:2px">' + t.aciklama.slice(0,80) + '</div>' : '') +
                  '</div>' +
                  '<div style="text-align:right;flex-shrink:0;margin-left:8px">' +
                    (t.fiyat ? '<div style="font-size:.9rem;font-weight:800;color:#ff6b35">₺' + t.fiyat + '</div>' : '') +
                    '<div style="font-size:.65rem;font-weight:700;color:' + (kabul ? '#2e7d32' : '#888') + '">' + (kabul ? '✅ Seçildi' : 'Yanıt verdi') + '</div>' +
                  '</div>' +
                '</div>' +
                iletisimHTML +
              '</div>';
            }).join('');
          } else {
            yanıtHTML = '<div style="font-size:.75rem;color:#aaa;margin-top:8px;padding:8px;background:#fafafa;border-radius:8px;text-align:center">Henüz yanıt gelmedi — esnaflar bildirim aldı</div>';
          }

          var aksiyonHTML = '<div style="display:flex;gap:6px;margin-top:10px;border-top:1px solid #f0f0f0;padding-top:10px">' +
            '<button onclick="ilanDetayGoster(' + ilan.id + ')" style="flex:1;background:#f5f5f5;color:#1a1a2e;border:none;border-radius:8px;padding:8px;font-size:.75rem;font-weight:700;cursor:pointer">📋 Detay</button>' +
            (ilan.durum === 'acik'
              ? '<button onclick="ilanDuzenleGoster(' + ilan.id + ')" style="flex:1;background:#f0f4ff;color:#1565c0;border:none;border-radius:8px;padding:8px;font-size:.75rem;font-weight:700;cursor:pointer">✏️ Düzenle</button>' +
                '<button onclick="ilanKaldir(' + ilan.id + ')" style="flex:1;background:#fff0f0;color:#c62828;border:none;border-radius:8px;padding:8px;font-size:.75rem;font-weight:700;cursor:pointer">⏸ Kaldır</button>'
              : '') +
          '</div>';

          return '<div style="background:#fff;border-radius:14px;padding:14px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,.07);border-top:4px solid ' + (katRenk[ilan.kategori] || renk) + '">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">' +
              '<div style="flex:1">' +
                '<div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">' +
                  '<span style="font-size:.9rem">' + (katIkon[ilan.kategori] || '📋') + '</span>' +
                  '<span style="font-weight:800;font-size:.88rem">' + temizle(ilan.baslik) + '</span>' +
                '</div>' +
                (ilan.butce_min ? '<div style="font-size:.7rem;color:#888">₺' + ilan.butce_min + (ilan.butce_max ? '–' + ilan.butce_max : '+') + '</div>' : '') +
                (ilan.olusturma ? '<div style="font-size:.67rem;color:#bbb;margin-top:2px">🕐 ' + ilanTarihFormatla(ilan.olusturma) + '</div>' : '') +
                (ilan.updated_at ? '<div style="font-size:.67rem;color:#f57c00;margin-top:1px">🔄 Güncellendi: ' + ilanTarihFormatla(ilan.updated_at) + '</div>' : '') +
              '</div>' +
              '<span style="font-size:.66rem;font-weight:700;color:' + renk + ';padding:3px 8px;background:' + renk + '18;border-radius:8px;white-space:nowrap;margin-left:8px">' + ilan.durum + '</span>' +
            '</div>' +
            fotoHTML +
            (ilan.aciklama ? '<div style="font-size:.78rem;color:#555;margin-bottom:8px;line-height:1.4">' + ilan.aciklama.slice(0,120) + (ilan.aciklama.length > 120 ? '…' : '') + '</div>' : '') +
            yanıtHTML +
            aksiyonHTML +
          '</div>';
        }).join('');
      }
      con.innerHTML = html;
    }).catch(function() { con.innerHTML = '<div class="hata">Yüklenemedi.</div>'; });
}


function teklifKabul(teklifId) {
  var oturum = oturumAl();
  fetch(API_URL + '/api/teklif/' + teklifId + '/durum', {
    method: 'PUT',
    headers: jsonAuthHeader(),
    body: JSON.stringify({ durum: 'kabul', musteri_telefon: oturum ? oturum.telefon : '' })
  }).then(function(r) { return r.json(); })
  .then(function(data) { bildirim(data.mesaj, data.basari ? 'basari' : 'hata'); if (data.basari) ilanlarimYukle(); });
}

function teklifReddet(teklifId) {
  fetch(API_URL + '/api/teklif/' + teklifId + '/durum', {
    method: 'PUT',
    headers: jsonAuthHeader(),
    body: JSON.stringify({ durum: 'reddedildi' })
  }).then(function(r) { return r.json(); })
  .then(function(data) { bildirim(data.mesaj, data.basari ? 'bilgi' : 'hata'); if (data.basari) ilanlarimYukle(); });
}

// ── İLAN DETAY / DÜZENLE / KALDIRMA MODALLARı ────────────────────────────

function _ilanModalHazirla() {
  var m = document.getElementById('ilan-islem-modal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'ilan-islem-modal';
    m.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:9998;overflow-y:auto;padding:16px;box-sizing:border-box';
    m.onclick = function(e) { if (e.target === m) ilanModalKapat(); };
    m.innerHTML = '<div style="background:#fff;border-radius:18px;padding:20px;position:relative;max-width:400px;margin:40px auto;">' +
      '<button onclick="ilanModalKapat()" style="position:absolute;top:14px;right:14px;background:#f0f0f0;border:none;border-radius:50%;width:34px;height:34px;font-size:1.1rem;cursor:pointer;z-index:1">✕</button>' +
      '<div id="ilan-islem-modal-icerik"></div>' +
    '</div>';
    document.body.appendChild(m);
  }
  return m;
}

function ilanModalKapat() {
  var m = document.getElementById('ilan-islem-modal');
  if (m) m.style.display = 'none';
}

function ilanDetayGoster(ilanId) {
  var ilan = _ilanlarimVeri.find(function(i) { return i.id === ilanId; });
  if (!ilan) return;
  var m = _ilanModalHazirla();
  var katRenk = { yemek: '#e65100', urun: '#1565c0', hizmet: '#2e7d32' };
  var katIkon = { yemek: '🍔', urun: '📦', hizmet: '🔧' };
  var durumRenk = { acik: '#2e7d32', kapali: '#888', iptal: '#c62828' };
  var renk = durumRenk[ilan.durum] || '#888';
  var tarih = ilan.olusturma ? new Date(ilan.olusturma).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  var yanıtlar = (ilan.teklifler || []).filter(Boolean);
  var fotoSrc = ilan.fotograf_url ? ilan.fotograf_url.replace(/'/g, "\\'") : '';

  var fotoHTML = ilan.fotograf_url
    ? '<img src="' + ilan.fotograf_url + '" onclick="lightboxAc(\'' + fotoSrc + '\')" style="width:100%;border-radius:10px;margin-bottom:12px;cursor:zoom-in;max-height:200px;object-fit:cover">'
    : '';

  var tekliflerHTML = '';
  if (yanıtlar.length) {
    tekliflerHTML = yanıtlar.map(function(t) {
      var kabul = t.durum === 'kabul';
      var waTel = t.esnaf_telefon ? t.esnaf_telefon.replace(/\D/g, '') : '';
      if (waTel.startsWith('0')) waTel = '90' + waTel.slice(1);
      return '<div style="background:' + (kabul ? '#f0fff4' : '#f9f9f9') + ';border:1px solid ' + (kabul ? '#a5d6a7' : '#eee') + ';border-radius:10px;padding:10px;margin-bottom:6px">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
          '<div style="flex:1">' +
            '<div style="font-size:.82rem;font-weight:800">' + (t.esnaf_ad || '') + '</div>' +
            (t.aciklama ? '<div style="font-size:.72rem;color:#666;margin-top:2px">' + t.aciklama + '</div>' : '') +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0;margin-left:8px">' +
            (t.fiyat ? '<div style="font-size:.9rem;font-weight:800;color:#ff6b35">₺' + t.fiyat + '</div>' : '') +
            '<div style="font-size:.65rem;font-weight:700;color:' + (kabul ? '#2e7d32' : '#888') + '">' + (kabul ? '✅ Seçildi' : 'Yanıt verdi') + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap">' +
          (t.durum === 'bekliyor' && ilan.durum === 'acik'
            ? '<button onclick="teklifKabul(' + t.id + ')" style="background:#e8f5e9;color:#2e7d32;border:none;border-radius:7px;padding:5px 10px;font-size:.7rem;font-weight:700;cursor:pointer">✅ Seç</button>' +
              '<button onclick="teklifReddet(' + t.id + ')" style="background:#ffebee;color:#c62828;border:none;border-radius:7px;padding:5px 10px;font-size:.7rem;font-weight:700;cursor:pointer">✕ Geç</button>'
            : '') +
          (t.esnaf_telefon
            ? '<a href="tel:' + t.esnaf_telefon + '" style="background:#f5f5f5;color:#1a1a2e;text-decoration:none;border-radius:7px;padding:5px 10px;font-size:.7rem;font-weight:700">📞 Ara</a>' +
              '<a href="https://wa.me/' + waTel + '" target="_blank" style="background:#e8f5e9;color:#2e7d32;text-decoration:none;border-radius:7px;padding:5px 10px;font-size:.7rem;font-weight:700">💬 WA</a>'
            : '') +
        '</div>' +
      '</div>';
    }).join('');
  } else {
    tekliflerHTML = '<div style="text-align:center;color:#aaa;font-size:.8rem;padding:12px;background:#fafafa;border-radius:8px">Henüz yanıt gelmedi</div>';
  }

  var html =
    '<h3 style="margin:0 0 8px;padding-right:40px;font-size:1rem">' + temizle(ilan.baslik) + '</h3>' +
    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:14px;flex-wrap:wrap">' +
      '<span style="font-size:.8rem;color:' + (katRenk[ilan.kategori] || '#888') + ';font-weight:600">' + (katIkon[ilan.kategori] || '📋') + ' ' + (ilan.kategori || '') + '</span>' +
      '<span style="font-size:.7rem;font-weight:700;color:' + renk + ';padding:2px 8px;background:' + renk + '18;border-radius:8px">' + ilan.durum + '</span>' +
      (tarih ? '<span style="font-size:.7rem;color:#aaa">' + tarih + '</span>' : '') +
    '</div>' +
    fotoHTML +
    (ilan.aciklama ? '<div style="font-size:.84rem;color:#333;margin-bottom:12px;line-height:1.55;white-space:pre-wrap">' + ilan.aciklama + '</div>' : '') +
    (ilan.butce_min ? '<div style="font-size:.78rem;color:#888;margin-bottom:12px;background:#f9f9f9;border-radius:8px;padding:8px">💰 Bütçe: ₺' + ilan.butce_min + (ilan.butce_max ? ' – ₺' + ilan.butce_max : '+') + '</div>' : '') +
    '<div style="font-size:.72rem;font-weight:800;color:#1a1a2e;text-transform:uppercase;margin-bottom:8px">Gelen Teklifler (' + yanıtlar.length + ')</div>' +
    tekliflerHTML +
    (ilan.durum === 'acik'
      ? '<div style="display:flex;gap:8px;margin-top:16px">' +
          '<button onclick="ilanModalKapat();ilanDuzenleGoster(' + ilanId + ')" style="flex:1;background:#1a1a2e;color:#fff;border:none;border-radius:10px;padding:10px;font-size:.82rem;font-weight:700;cursor:pointer">✏️ Düzenle</button>' +
          '<button onclick="ilanKaldir(' + ilanId + ')" style="background:#fff0f0;color:#c62828;border:1px solid #ffcdd2;border-radius:10px;padding:10px 14px;font-size:.82rem;font-weight:700;cursor:pointer">⏸ Kaldır</button>' +
        '</div>'
      : '');

  document.getElementById('ilan-islem-modal-icerik').innerHTML = html;
  m.style.display = 'block';
}

function ilanDuzenleGoster(ilanId) {
  var ilan = _ilanlarimVeri.find(function(i) { return i.id === ilanId; });
  if (!ilan) return;
  var m = _ilanModalHazirla();

  var fotoOnizleme = ilan.fotograf_url
    ? '<div style="position:relative;display:inline-block;margin-bottom:8px">' +
        '<img src="' + ilan.fotograf_url + '" style="width:80px;height:80px;object-fit:cover;border-radius:10px">' +
        '<button onclick="ilanFotoKaldir()" style="position:absolute;top:-6px;right:-6px;background:#c62828;color:#fff;border:none;border-radius:50%;width:20px;height:20px;font-size:.65rem;cursor:pointer;line-height:20px">✕</button>' +
      '</div>'
    : '';

  var html =
    '<h3 style="margin:0 0 16px;padding-right:40px;font-size:1rem">✏️ İlanı Düzenle</h3>' +
    '<div style="margin-bottom:12px">' +
      '<label style="font-size:.75rem;font-weight:700;color:#555;display:block;margin-bottom:5px">Başlık</label>' +
      '<input id="ilan-duzenle-baslik" value="' + (ilan.baslik || '').replace(/"/g, '&quot;') + '" style="width:100%;box-sizing:border-box;border:1.5px solid #e0e0e0;border-radius:10px;padding:10px 12px;font-size:.88rem;outline:none">' +
    '</div>' +
    '<div style="margin-bottom:12px">' +
      '<label style="font-size:.75rem;font-weight:700;color:#555;display:block;margin-bottom:5px">Açıklama</label>' +
      '<textarea id="ilan-duzenle-aciklama" rows="4" style="width:100%;box-sizing:border-box;border:1.5px solid #e0e0e0;border-radius:10px;padding:10px 12px;font-size:.88rem;resize:vertical;outline:none;font-family:inherit">' + (ilan.aciklama || '') + '</textarea>' +
    '</div>' +
    '<div style="margin-bottom:16px">' +
      '<label style="font-size:.75rem;font-weight:700;color:#555;display:block;margin-bottom:5px">Fotoğraf</label>' +
      '<div id="ilan-duzenle-foto-preview">' + fotoOnizleme + '</div>' +
      '<input type="hidden" id="ilan-duzenle-foto-url" value="' + (ilan.fotograf_url || '') + '">' +
      '<input type="file" id="ilan-duzenle-foto-input" accept="image/*" onchange="ilanDuzenleFotoYukle(this)" style="display:none">' +
      '<button onclick="document.getElementById(\'ilan-duzenle-foto-input\').click()" style="background:#f5f5f5;color:#333;border:1px solid #ddd;border-radius:8px;padding:7px 12px;font-size:.78rem;font-weight:600;cursor:pointer">📷 ' + (ilan.fotograf_url ? 'Değiştir' : 'Fotoğraf Ekle') + '</button>' +
    '</div>' +
    '<button id="ilan-duzenle-kaydet-btn" onclick="ilanDuzenleKaydet(' + ilanId + ')" style="width:100%;background:#1a1a2e;color:#fff;border:none;border-radius:12px;padding:13px;font-size:.9rem;font-weight:700;cursor:pointer">Kaydet</button>';

  document.getElementById('ilan-islem-modal-icerik').innerHTML = html;
  m.style.display = 'block';
}

function ilanDuzenleFotoYukle(input) {
  if (!input.files || !input.files[0]) return;
  var formData = new FormData();
  formData.append('foto', input.files[0]);
  bildirim('Fotoğraf yükleniyor...', 'bilgi');
  fetch(API_URL + '/api/is-ilani/fotograf', { method: 'POST', body: formData })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.basari) {
        document.getElementById('ilan-duzenle-foto-url').value = data.url;
        document.getElementById('ilan-duzenle-foto-preview').innerHTML =
          '<div style="position:relative;display:inline-block;margin-bottom:8px">' +
            '<img src="' + data.url + '" style="width:80px;height:80px;object-fit:cover;border-radius:10px">' +
            '<button onclick="ilanFotoKaldir()" style="position:absolute;top:-6px;right:-6px;background:#c62828;color:#fff;border:none;border-radius:50%;width:20px;height:20px;font-size:.65rem;cursor:pointer;line-height:20px">✕</button>' +
          '</div>';
        bildirim('Fotoğraf yüklendi', 'basari');
      } else { bildirim(data.mesaj, 'hata'); }
    }).catch(function() { bildirim('Yükleme hatası', 'hata'); });
}

function ilanFotoKaldir() {
  document.getElementById('ilan-duzenle-foto-url').value = '';
  document.getElementById('ilan-duzenle-foto-preview').innerHTML = '';
}

function ilanDuzenleKaydet(ilanId) {
  var baslik = document.getElementById('ilan-duzenle-baslik').value.trim();
  var aciklama = document.getElementById('ilan-duzenle-aciklama').value.trim();
  var fotoUrl = document.getElementById('ilan-duzenle-foto-url').value;
  if (!baslik) { bildirim('Başlık zorunlu', 'hata'); return; }
  var oturum = oturumAl();
  var btn = document.getElementById('ilan-duzenle-kaydet-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Kaydediliyor...'; }
  fetch(API_URL + '/api/is-ilani/' + ilanId, {
    method: 'PUT',
    headers: jsonAuthHeader(),
    body: JSON.stringify({ musteri_telefon: oturum ? oturum.telefon : '', baslik: baslik, aciklama: aciklama || null, fotograf_url: fotoUrl || null })
  }).then(function(r) { return r.json(); })
  .then(function(data) {
    bildirim(data.mesaj, data.basari ? 'basari' : 'hata');
    if (data.basari) { ilanModalKapat(); ilanlarimYukle(); }
    else if (btn) { btn.disabled = false; btn.textContent = 'Kaydet'; }
  }).catch(function() {
    bildirim('Bağlantı hatası', 'hata');
    if (btn) { btn.disabled = false; btn.textContent = 'Kaydet'; }
  });
}

function ilanKaldir(ilanId) {
  if (!confirm('İlan yayından kaldırılsın mı?')) return;
  var oturum = oturumAl();
  fetch(API_URL + '/api/is-ilani/' + ilanId + '/kapat', {
    method: 'PUT',
    headers: jsonAuthHeader(),
    body: JSON.stringify({ musteri_telefon: oturum ? oturum.telefon : '' })
  }).then(function(r) { return r.json(); })
  .then(function(data) {
    bildirim(data.mesaj, data.basari ? 'bilgi' : 'hata');
    if (data.basari) { ilanModalKapat(); ilanlarimYukle(); }
  }).catch(function() { bildirim('Bağlantı hatası', 'hata'); });
}

function siparislerimSayfasiAc(siparisId) {
  siparisTakip.siparisId = siparisId;
  sayfaGoster('siparislerim');
  siparislerListele();
  if (siparisTakip.interval) clearInterval(siparisTakip.interval);
  siparisTakip.interval = setInterval(function() {
    if (document.getElementById('sayfa-siparislerim').classList.contains('aktif')) {
      siparisAktifGuncelle();
    } else {
      clearInterval(siparisTakip.interval);
    }
  }, 10000);
}

function siparisGuncelle() {
  siparisAktifGuncelle();
}

function siparisAktifGuncelle() {
  if (!siparisTakip.siparisId) return;
  fetch(API_URL + '/api/siparis-detay/' + siparisTakip.siparisId)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) return;
      var el = document.getElementById('aktif-siparis-kart-' + data.veri.id);
      if (el) {
        el.outerHTML = aktifSiparisKart(data.veri);
      }
    });
}

function aktifSiparisKart(s) {
  var urunler = Array.isArray(s.urunler) ? s.urunler :
    (typeof s.urunler === 'string' ? JSON.parse(s.urunler || '[]') : []);
  var aktifAdim = durumAdim.indexOf(s.durum);
  var ilerlemeYuzde = aktifAdim >= 0 ? Math.round((aktifAdim / (durumAdim.length - 1)) * 100) : 0;

  var adimlerHtml = '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin:14px 0 6px">' +
    durumAdim.map(function(ad, i) {
      var gecti = i <= aktifAdim;
      var aktif = i === aktifAdim;
      var renk  = gecti ? (durumRenk[ad] || '#4caf50') : '#ccc';
      return '<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1">' +
        '<span style="font-size:' + (aktif ? '1.8rem' : '1.2rem') + ';filter:' + (gecti ? 'none' : 'grayscale(1)') + ';transition:font-size .3s">' + (durumIkon[ad] || '•') + '</span>' +
        '<span style="font-size:.55rem;font-weight:' + (aktif ? '800' : '400') + ';color:' + renk + ';text-align:center;line-height:1.2">' + ad + '</span>' +
      '</div>';
    }).join('<div style="width:2px;height:24px;background:#eee;margin-top:8px;flex-shrink:0"></div>') +
  '</div>';

  var ilerlemeBar = '<div style="background:#f0f0f0;border-radius:10px;height:5px;margin-bottom:14px">' +
    '<div style="background:' + (durumRenk[s.durum] || '#4caf50') + ';height:5px;border-radius:10px;width:' + ilerlemeYuzde + '%;transition:width .6s ease"></div>' +
  '</div>';

  var urunlerHtml = urunler.map(function(u) {
    return '<div style="display:flex;justify-content:space-between;font-size:.82rem;padding:4px 0;border-bottom:1px solid #f8f8f8">' +
      '<span>' + u.ad + ' <span style="color:#bbb">x' + u.adet + '</span></span>' +
      '<span style="font-weight:700;color:#ff6b35">₺' + (u.fiyat * u.adet) + '</span>' +
    '</div>';
  }).join('');

  var kuryeHtml = '';
  if (s.durum === 'yolda' && s.kurye_ad) {
    var konumBilgisi = (s.kurye_lat && s.kurye_lng)
      ? '<button onclick="kuryeTakipHaritaGoster(' + s.id + ',' + s.kurye_lat + ',' + s.kurye_lng + ')" style="margin-top:6px;width:100%;background:#9c27b0;color:#fff;border:none;border-radius:8px;padding:7px;font-size:.75rem;font-weight:700;cursor:pointer">📍 Kuryeyi Haritada Gör</button>'
      : '';
    kuryeHtml = '<div style="background:#f3e8ff;border-radius:10px;padding:10px 12px;margin-bottom:12px">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<span style="font-size:1.6rem">🛵</span>' +
        '<div>' +
          '<div style="font-size:.78rem;color:#7b3fa0;font-weight:700">Kuryeniz yolda!</div>' +
          '<div style="font-size:.82rem;font-weight:800">' + s.kurye_ad + '</div>' +
          (s.kurye_arac ? '<div style="font-size:.72rem;color:#888">' + s.kurye_arac + '</div>' : '') +
          (s.kurye_telefon ? '<a href="tel:' + s.kurye_telefon + '" style="font-size:.75rem;color:#9c27b0;font-weight:700;text-decoration:none">📞 ' + s.kurye_telefon + '</a>' : '') +
        '</div>' +
      '</div>' +
      konumBilgisi +
    '</div>';
  }

  var iptalBtn = '';
  if (s.durum === 'bekliyor') {
    iptalBtn = '<div style="margin-top:10px">' +
      '<button onclick="siparisIptal(' + s.id + ')" style="width:100%;padding:9px;background:#fff;border:1.5px solid #f44336;color:#f44336;border-radius:10px;font-size:.82rem;font-weight:700;cursor:pointer">İptal Et</button>' +
    '</div>';
  }

  var tarih = new Date(s.tarih).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });

  return '<div id="aktif-siparis-kart-' + s.id + '" style="background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 12px rgba(0,0,0,.09);margin-bottom:12px">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">' +
      '<span style="font-weight:800;font-size:.97rem">Sipariş #' + s.id + '</span>' +
      '<span style="background:' + (durumRenk[s.durum] || '#ccc') + ';color:#fff;padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:700">' +
        (durumIkon[s.durum] || '') + ' ' + (s.durum || '') + '</span>' +
    '</div>' +
    '<div style="font-size:.78rem;color:#aaa;margin-bottom:12px">' + (s.esnaf_adi || '') + ' · ' + tarih + '</div>' +
    adimlerHtml +
    ilerlemeBar +
    kuryeHtml +
    '<div style="font-size:.78rem;font-weight:700;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em">Ürünler</div>' +
    urunlerHtml +
    '<div style="display:flex;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:2px solid #f5f5f5">' +
      '<span style="font-size:.83rem;color:#666">' + (s.teslimat_turu === 'kurye' ? '🛵 Kurye ile teslimat' : '🚶 Gel-al') + (s.adres ? ' · ' + temizle(s.adres) : '') + '</span>' +
      '<span style="font-weight:900;font-size:1rem;color:#ff6b35">₺' + (parseFloat(s.genel_toplam) || 0) + '</span>' +
    '</div>' +
    iptalBtn +
  '</div>';
}

// Kurye takip haritası modal
var _kuryeTakipHarita = null;
var _kuryeTakipMarker = null;
var _kuryeTakipInterval = null;

function kuryeTakipHaritaGoster(siparisId, lat, lng) {
  var modal = document.getElementById('kurye-takip-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  setTimeout(function() {
    if (!_kuryeTakipHarita) {
      _kuryeTakipHarita = L.map('kurye-takip-harita', { zoomControl: true, attributionControl: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(_kuryeTakipHarita);
    }
    _kuryeTakipHarita.setView([lat, lng], 15);
    _kuryeTakipHarita.invalidateSize();

    if (_kuryeTakipMarker) _kuryeTakipHarita.removeLayer(_kuryeTakipMarker);
    _kuryeTakipMarker = L.marker([lat, lng], {
      icon: L.divIcon({ className: '', html: '<div style="font-size:2rem">🛵</div>', iconAnchor: [16, 16] })
    }).addTo(_kuryeTakipHarita).bindPopup('Kuryeniz burada').openPopup();

    // Her 15 saniyede konumu güncelle
    if (_kuryeTakipInterval) clearInterval(_kuryeTakipInterval);
    _kuryeTakipInterval = setInterval(function() {
      fetch(API_URL + '/api/siparis/' + siparisId + '/kurye-konum')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (!data.basari || !_kuryeTakipHarita) return;
          var v = data.veri;
          var newLatLng = [parseFloat(v.lat), parseFloat(v.lng)];
          if (_kuryeTakipMarker) _kuryeTakipMarker.setLatLng(newLatLng);
          _kuryeTakipHarita.panTo(newLatLng);
        }).catch(function() {});
    }, 15000);
  }, 100);
}

function kuryeTakipKapat() {
  document.getElementById('kurye-takip-modal').style.display = 'none';
  if (_kuryeTakipInterval) { clearInterval(_kuryeTakipInterval); _kuryeTakipInterval = null; }
}

function siparisIptal(id) {
  if (!confirm('Siparişi iptal etmek istediğinize emin misiniz?')) return;
  var tel = telefon();
  fetch(API_URL + '/api/siparis-iptal/' + id, {
    method: 'PUT',
    headers: jsonAuthHeader(),
    body: JSON.stringify({ musteri_telefon: tel })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.basari) {
        siparislerListele();
      } else {
        bildirim(data.mesaj, 'hata');
      }
    })
    .catch(function() { bildirim('Bağlantı hatası.', 'hata'); });
}

function siparisGecmisKart(s) {
  var urunler = Array.isArray(s.urunler) ? s.urunler :
    (typeof s.urunler === 'string' ? JSON.parse(s.urunler || '[]') : []);
  var tarih = new Date(s.tarih).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  var renk = durumRenk[s.durum] || '#aaa';
  var urunOzet = urunler.slice(0, 2).map(function(u) { return u.ad; }).join(', ') + (urunler.length > 2 ? ' +' + (urunler.length - 2) : '');
  return '<div style="background:#fff;border-radius:14px;padding:13px 15px;box-shadow:0 1px 6px rgba(0,0,0,.06);margin-bottom:8px">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">' +
      '<span style="font-weight:800;font-size:.9rem">' + (s.esnaf_adi || 'Esnaf') + '</span>' +
      '<span style="background:' + renk + ';color:#fff;padding:2px 8px;border-radius:12px;font-size:.68rem;font-weight:700">' + (durumIkon[s.durum] || '') + ' ' + (s.durum || '') + '</span>' +
    '</div>' +
    (urunOzet ? '<div style="font-size:.78rem;color:#888;margin-bottom:3px">' + urunOzet + '</div>' : '') +
    '<div style="display:flex;justify-content:space-between;align-items:center">' +
      '<span style="font-size:.73rem;color:#bbb">' + tarih + '</span>' +
      '<span style="font-weight:800;font-size:.9rem;color:#ff6b35">₺' + (parseFloat(s.genel_toplam) || 0) + '</span>' +
    '</div>' +
  '</div>';
}

function siparislerListele() {
  var tel = telefon();
  var icerik = document.getElementById('siparislerim-icerik');
  if (!icerik) return;

  if (!tel) {
    icerik.innerHTML = '<div style="text-align:center;padding:40px;color:#aaa"><div style="font-size:2.5rem;margin-bottom:8px">🛵</div>Siparişlerinizi görmek için giriş yapın.</div>';
    return;
  }

  icerik.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa">Yükleniyor...</div>';

  var telEnc = encodeURIComponent(tel);
  Promise.all([
    fetch(API_URL + '/api/siparislerim?telefon=' + telEnc).then(function(r) { return r.json(); }),
    fetch(API_URL + '/api/randevularim?telefon=' + telEnc).then(function(r) { return r.json(); }).catch(function() { return { basari: false, veri: [] }; })
  ])
    .then(function(results) {
      var sipData = results[0];
      var ranData = results[1];
      if (!sipData.basari) throw new Error(sipData.mesaj);

      var siparisler = sipData.veri;
      var randevular = (ranData.basari ? ranData.veri : []).filter(function(r) { return r.durum !== 'iptal'; });

      var aktif  = siparisler.filter(function(s) { return aktifDurumlar.indexOf(s.durum) !== -1; });
      var gecmis = siparisler.filter(function(s) { return aktifDurumlar.indexOf(s.durum) === -1; });

      if (aktif.length && !siparisTakip.siparisId) {
        siparisTakip.siparisId = aktif[0].id;
      }

      var html = '';

      // Randevular bölümü
      if (randevular.length) {
        html += '<div style="font-size:.75rem;font-weight:800;color:#7b1fa2;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">📅 Randevularım</div>';
        var durumRenk = { bekliyor:'#ff6b35', onaylandi:'#2e7d32', tamamlandi:'#888', iptal:'#c62828' };
        var durumMetin = { bekliyor:'Bekliyor', onaylandi:'Onaylandı', tamamlandi:'Tamamlandı', iptal:'İptal' };
        html += randevular.map(function(r) {
          var tarihStr = new Date(r.tarih).toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' });
          var renk = durumRenk[r.durum] || '#888';
          return '<div style="background:#fff;border-radius:14px;padding:14px;margin-bottom:10px;box-shadow:0 2px 8px rgba(0,0,0,.06);border-left:4px solid ' + renk + '">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
              '<div>' +
                '<div style="font-weight:800;font-size:.9rem">' + (r.esnaf_adi || 'İşletme') + '</div>' +
                '<div style="font-size:.8rem;color:#555;margin-top:3px">📅 ' + tarihStr + ' · ' + (r.saat||'').slice(0,5) + '</div>' +
                (r.hizmet_adi ? '<div style="font-size:.75rem;color:#888;margin-top:2px">💼 ' + r.hizmet_adi + '</div>' : '') +
              '</div>' +
              '<span style="font-size:.72rem;font-weight:700;color:' + renk + ';padding:3px 8px;background:' + renk + '18;border-radius:8px">' + (durumMetin[r.durum] || r.durum) + '</span>' +
            '</div>' +
            (r.durum === 'bekliyor' || r.durum === 'onaylandi'
              ? '<button onclick="musteriRandevuIptal(' + r.id + ')" style="margin-top:10px;width:100%;background:#ffebee;color:#c62828;border:none;border-radius:8px;padding:8px;font-size:.78rem;font-weight:700;cursor:pointer">İptal Et</button>'
              : '') +
          '</div>';
        }).join('');
      }

      if (aktif.length) {
        html += '<div style="font-size:.75rem;font-weight:800;color:#ff6b35;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px' + (randevular.length ? ';margin-top:16px' : '') + '">Aktif Siparişler</div>';
        html += aktif.map(aktifSiparisKart).join('');
        html += '<div style="text-align:center;font-size:.7rem;color:#ccc;margin-bottom:16px">🔄 Her 10 saniyede otomatik güncellenir</div>';
      }

      if (gecmis.length) {
        html += '<div style="font-size:.75rem;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px' + (aktif.length || randevular.length ? ';margin-top:4px' : '') + '">Geçmiş Siparişler</div>';
        html += gecmis.map(siparisGecmisKart).join('');
      }

      if (!siparisler.length && !randevular.length) {
        html = '<div style="text-align:center;padding:40px;color:#aaa"><div style="font-size:2.5rem;margin-bottom:8px">🛵</div>Henüz sipariş veya randevunuz yok.</div>';
      }

      icerik.innerHTML = html;

      // Polling: aktif sipariş varsa 10sn, sadece randevu varsa 30sn
      if (siparisTakip.interval) clearInterval(siparisTakip.interval);
      var pollInterval = aktif.length ? 10000 : 30000;
      siparisTakip.interval = setInterval(function() {
        if (document.getElementById('sayfa-siparislerim').classList.contains('aktif')) {
          if (aktif.length) {
            aktif.forEach(function(s) {
              fetch(API_URL + '/api/siparis-detay/' + s.id)
                .then(function(r) { return r.json(); })
                .then(function(data) {
                  if (!data.basari) return;
                  var el = document.getElementById('aktif-siparis-kart-' + data.veri.id);
                  if (el) el.outerHTML = aktifSiparisKart(data.veri);
                  if (aktifDurumlar.indexOf(data.veri.durum) === -1) siparislerListele();
                });
            });
          } else {
            // Sadece randevu varsa tüm listeyi yenile (durum değişikliği için)
            siparislerListele();
          }
        } else {
          clearInterval(siparisTakip.interval);
        }
      }, pollInterval);
    })
    .catch(function(err) {
      icerik.innerHTML = '<div style="text-align:center;padding:20px;color:#f44336">Siparişler alınamadı: ' + err.message + '</div>';
    });
}

function musteriRandevuIptal(randevuId) {
  if (!confirm('Randevunuz iptal edilecek. Emin misiniz?')) return;
  var tel = oturumAl() && oturumAl().telefon;
  if (!tel) return;
  fetch(API_URL + '/api/randevu/' + randevuId + '/iptal', {
    method: 'PUT',
    headers: jsonAuthHeader(),
    body: JSON.stringify({ musteri_telefon: tel })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.basari) siparislerListele();
      else bildirim(data.mesaj || 'İptal edilemedi.', 'hata');
    })
    .catch(function() { bildirim('Bağlantı hatası.', 'hata'); });
}

