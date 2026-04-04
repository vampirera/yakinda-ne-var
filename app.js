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

var API_URL = 'https://yakinda-ne-var-backend-production.up.railway.app';

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
      headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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
        '<div style="font-weight:700;font-size:.82rem;color:#333">' + (a.baslik || 'Adres') + (secili ? ' <span style="color:#ff6b35;font-size:.7rem">● Seçili</span>' : '') + '</div>' +
        '<div style="font-size:.75rem;color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + a.adres + '</div>' +
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
    '<h3 style="margin:0 30px 14px 0;font-size:1rem">📍 ' + (a.baslik || 'Adres') + '</h3>' +
    '<div style="background:#f9f9f9;border-radius:10px;padding:12px;margin-bottom:14px;font-size:.85rem;line-height:1.8;color:#444">' +
      a.adres +
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
    headers: { 'Content-Type': 'application/json' },
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

function ilanlarimYukle() {
  var oturum = oturumAl();
  if (!oturum || !oturum.telefon) return;
  var con = document.getElementById('ilanlarim-icerik');
  con.innerHTML = '<div class="yukleniyor"></div>';
  fetch(API_URL + '/api/ilanlarim?telefon=' + encodeURIComponent(oturum.telefon))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var ilanlar = data.basari ? data.veri : [];
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

          // Fotoğraf varsa göster
          var fotoHTML = ilan.fotograf_url
            ? '<div style="margin-bottom:10px;border-radius:10px;overflow:hidden;height:120px">' +
                '<img src="' + ilan.fotograf_url + '" style="width:100%;height:100%;object-fit:cover">' +
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

          return '<div style="background:#fff;border-radius:14px;padding:14px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,.07);border-top:4px solid ' + (katRenk[ilan.kategori] || renk) + '">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">' +
              '<div style="flex:1">' +
                '<div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">' +
                  '<span style="font-size:.9rem">' + (katIkon[ilan.kategori] || '📋') + '</span>' +
                  '<span style="font-weight:800;font-size:.88rem">' + ilan.baslik + '</span>' +
                '</div>' +
                (ilan.butce_min ? '<div style="font-size:.7rem;color:#888">₺' + ilan.butce_min + (ilan.butce_max ? '–' + ilan.butce_max : '+') + '</div>' : '') +
              '</div>' +
              '<span style="font-size:.66rem;font-weight:700;color:' + renk + ';padding:3px 8px;background:' + renk + '18;border-radius:8px;white-space:nowrap;margin-left:8px">' + ilan.durum + '</span>' +
            '</div>' +
            fotoHTML +
            yanıtHTML +
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ durum: 'kabul', musteri_telefon: oturum ? oturum.telefon : '' })
  }).then(function(r) { return r.json(); })
  .then(function(data) { bildirim(data.mesaj, data.basari ? 'basari' : 'hata'); if (data.basari) ilanlarimYukle(); });
}

function teklifReddet(teklifId) {
  fetch(API_URL + '/api/teklif/' + teklifId + '/durum', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ durum: 'reddedildi' })
  }).then(function(r) { return r.json(); })
  .then(function(data) { bildirim(data.mesaj, data.basari ? 'bilgi' : 'hata'); if (data.basari) ilanlarimYukle(); });
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
      '<span style="font-size:.83rem;color:#666">' + (s.teslimat_turu === 'kurye' ? '🛵 Kurye ile teslimat' : '🚶 Gel-al') + (s.adres ? ' · ' + s.adres : '') + '</span>' +
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
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ musteri_telefon: tel })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.basari) siparislerListele();
      else bildirim(data.mesaj || 'İptal edilemedi.', 'hata');
    })
    .catch(function() { bildirim('Bağlantı hatası.', 'hata'); });
}

// =============================================================
// FAVORİLER
// =============================================================

function _favoriKey() {
  var oturum = oturumAl();
  return 'favoriler:' + (oturum && oturum.telefon ? oturum.telefon : 'misafir');
}

function favorileriYukle() {
  try { return JSON.parse(localStorage.getItem(_favoriKey()) || '[]'); }
  catch(e) { return []; }
}

function favorileriKaydet(favoriler) {
  localStorage.setItem(_favoriKey(), JSON.stringify(favoriler));
}

function favoriMi(id) {
  return favorileriYukle().indexOf(id) !== -1;
}

function favoriToggle(id, event) {
  event.stopPropagation();
  var favoriler = favorileriYukle();
  var idx = favoriler.indexOf(id);
  if (idx === -1) { favoriler.push(id); }
  else { favoriler.splice(idx, 1); }
  favorileriKaydet(favoriler);

  // Tüm kalp ikonlarını güncelle
  document.querySelectorAll('.kalp-btn[data-id="' + id + '"]').forEach(function(btn) {
    btn.textContent = favoriMi(id) ? '❤️' : '🤍';
  });
}

function favorilerSayfasiGoster() {
  sayfaGoster('favoriler');
  var favoriler = favorileriYukle();
  var listesi = document.getElementById('favori-listesi');
  if (!favoriler.length) {
    listesi.innerHTML = '<div class="yukleniyor">Henuz favori esnaf eklemediniz.</div>';
    return;
  }
  listesi.innerHTML = '<div class="yukleniyor"></div>';
  var params = new URLSearchParams();
  if (durum.lat) { params.append('lat', durum.lat); params.append('lng', durum.lng); }
  fetch(API_URL + '/api/esnaflar?' + params.toString())
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) throw new Error(data.mesaj);
      var favoriEsnaflar = data.veri.filter(function(e) { return favoriler.indexOf(e.id) !== -1; });
      if (!favoriEsnaflar.length) {
        listesi.innerHTML = '<div class="yukleniyor">Favori esnaf bulunamadi.</div>';
        return;
      }
      listesi.innerHTML = esnafKartlariOlustur(favoriEsnaflar);
    })
    .catch(function() {
      listesi.innerHTML = '<div class="hata">Baglanamadi.</div>';
    });
}

// =============================================================
// YARDIMCI
// =============================================================

var katIkon = { yemek: '🍽️', urun: '🛍️', hizmet: '🔧' };

function ikon(kategori) {
  return katIkon[kategori] || '🏪';
}

function lightboxAc(src) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').classList.add('aktif');
}

function lightboxKapat() {
  document.getElementById('lightbox').classList.remove('aktif');
  document.getElementById('lightbox-img').src = '';
}

// =============================================================
// NAVİGASYON
// =============================================================

function sayfaGoster(id) {
  document.querySelectorAll('.sayfa').forEach(function(s) {
    s.classList.remove('aktif');
  });
  document.getElementById('sayfa-' + id).classList.add('aktif');

  if (id === 'detay') {
    setTimeout(function() {
      if (durum.detayHarita) durum.detayHarita.invalidateSize();
    }, 100);
  }
  if (id === 'kayit') {
    setTimeout(kayitHaritaBaslat, 150);
  }
  if (id === 'admin') {
    // admin şifre sorulacak, adminGoster() ayrıca çağrılıyor
  }
}

function navItemleriAl() {
  var oturum = oturumAl();
  var tip = oturum ? oturum.tip : null;
  if (!oturum) return [
    { id: 'ana',          icon: '🏠', label: 'Ana'        },
    { id: 'favoriler',    icon: '❤️', label: 'Favoriler'  },
    { id: 'siparislerim', icon: '🛵', label: 'Siparisim'  },
    { id: 'kayit',        icon: '🔑', label: 'Giris/Kayit'}
  ];
  if (tip === 'musteri') return [
    { id: 'ana',          icon: '🏠', label: 'Ana'        },
    { id: 'favoriler',    icon: '❤️', label: 'Favoriler'  },
    { id: 'siparislerim', icon: '🛵', label: 'Siparisim'  },
    { id: 'profil',       icon: '👤', label: 'Profilim'   }
  ];
  if (tip === 'esnaf') return [
    { id: 'ana',          icon: '🏠', label: 'Ana'        },
    { id: 'siparislerim', icon: '🛵', label: 'Siparisim'  },
    { id: 'panel',        icon: '📦', label: 'Panelim'    },
    { id: 'profil',       icon: '👤', label: 'Profilim'   }
  ];
  if (tip === 'kurye') return [
    { id: 'ana',          icon: '🏠', label: 'Ana'        },
    { id: 'siparislerim', icon: '🛵', label: 'Siparisim'  },
    { id: 'profil',       icon: '🛵', label: 'Profilim'   }
  ];
  if (tip === 'admin') return [
    { id: 'ana',   icon: '🏠', label: 'Ana'   },
    { id: 'panel', icon: '⚙️', label: 'Admin' }
  ];
  return [];
}

function navOlustur(containerId, aktif) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = navItemleriAl().map(function(item) {
    return '<div class="nav-item' + (item.id === aktif ? ' active' : '') +
      '" onclick="navTikla(\'' + item.id + '\')">' +
      '<span class="nav-icon">' + item.icon + '</span>' + item.label + '</div>';
  }).join('');
}

function oturumaGoreNavGuncelle(aktif) {
  ['ana-nav','favoriler-nav','siparislerim-nav','profil-nav','panel-nav'].forEach(function(id) {
    navOlustur(id, aktif || '');
  });
}

function navTikla(id) {
  if (id === 'ana') {
    sayfaGoster('ana');
  } else if (id === 'siparislerim') {
    sayfaGoster('siparislerim');
    siparislerListele();
  } else if (id === 'profil') {
    var _oturum = oturumAl();
    if (_oturum && _oturum.tip === 'esnaf') {
      sayfaGoster('panel');
      panelGoruntule();
      return;
    }
    profilSayfasiGoster();
  } else if (id === 'favoriler') {
    favorilerSayfasiGoster();
  } else if (id === 'kayit') {
    sayfaGoster('kayit-secim');
  } else if (id === 'panel') {
    var oturum = oturumAl();
    if (oturum && oturum.tip === 'admin') {
      adminGoster();
    } else {
      sayfaGoster('panel');
      panelGoruntule();
    }
  }
  oturumaGoreNavGuncelle(id);
}

// =============================================================
// KATEGORİ & SIRALAMA
// =============================================================

function kategorilerOlustur() {
  var cats = [
    { id: null,     icon: '🌟', label: 'Tumu'   },
    { id: 'yemek',  icon: '🍽️', label: 'Yemek'  },
    { id: 'urun',   icon: '🛍️', label: 'Urun'   },
    { id: 'hizmet', icon: '🔧', label: 'Hizmet' }
  ];
  document.getElementById('cats-row').innerHTML = cats.map(function(c) {
    var aktif = durum.kategori === c.id ? ' active' : '';
    return '<div class="cat-btn' + aktif + '" onclick="kategoriSec(\'' + c.id + '\')">' +
      '<div class="icon">' + c.icon + '</div><p>' + c.label + '</p></div>';
  }).join('');
}

function kategoriSec(k) {
  durum.kategori = (k === 'null' || k === '' || k === null) ? null : k;
  kategorilerOlustur();
  esnaflarYukle();
}

function siralamaOlustur() {
  var opts = [
    { id: 'mesafe', label: '📍 Yakin' },
    { id: 'puan',   label: '⭐ Puan'  },
    { id: 'fiyat',  label: '💰 Ucuz'  }
  ];
  document.getElementById('siralama-row').innerHTML = opts.map(function(o) {
    var aktif = durum.siralama === o.id ? ' active' : '';
    return '<button class="siralama-btn' + aktif + '" onclick="siralaSec(\'' + o.id + '\')">' + o.label + '</button>';
  }).join('');
}

function siralaSec(s) {
  durum.siralama = s;
  siralamaOlustur();
  esnaflarYukle();
}

function mesafeButonlariniOlustur() {
  var secenekler = [
    { km: 0.5, label: '500m' },
    { km: 1,   label: '1km'  },
    { km: 2,   label: '2km'  },
    { km: 5,   label: '5km'  },
    { km: null, label: 'Tümü' }
  ];
  document.getElementById('mesafe-filtre-row').innerHTML = secenekler.map(function(o) {
    var aktif = durum.mesafeFiltre === o.km ? ' active' : '';
    return '<button class="mesafe-btn' + aktif + '" onclick="mesafeSec(' + (o.km === null ? 'null' : o.km) + ')">' + o.label + '</button>';
  }).join('');
}

var MESAFE_ZOOM = { 0.5: 15, 1: 14, 2: 13, 5: 12 };

function mesafeSec(km) {
  durum.mesafeFiltre = km;
  mesafeButonlariniOlustur();
  if (durum.anaHarita && durum.lat && durum.lng) {
    var zoom = km ? (MESAFE_ZOOM[km] || 11) : 11;
    durum.anaHarita.setView([durum.lat, durum.lng], zoom);
  }
  esnaflarYukle();
}

// =============================================================
// KONUM
// =============================================================

function reverseGeocode(lat, lng, callback) {
  fetch('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lng + '&format=json&accept-language=tr')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var a = data.address || {};
      var mahalle = a.suburb || a.neighbourhood || a.quarter || '';
      var ilce    = a.district || a.town || a.city_district || a.county || '';
      var sonuc   = [mahalle, ilce].filter(Boolean).join(', ') || (lat.toFixed(4) + ', ' + lng.toFixed(4));
      callback(sonuc);
    })
    .catch(function() {
      callback(lat.toFixed(4) + ', ' + lng.toFixed(4));
    });
}

function varsayilanKonum() {
  durum.lat = 36.8550;
  durum.lng = 28.2753;
  document.getElementById('konum-text').textContent = 'Marmaris';
  esnaflarYukle();
  if (durum.anaHarita) {
    durum.anaHarita.setView([durum.lat, durum.lng], 13);
    L.circleMarker([durum.lat, durum.lng], {
      radius: 10, color: '#1565c0', fillColor: '#1e88e5', fillOpacity: 0.8, weight: 2
    }).addTo(durum.anaHarita).bindPopup('Varsayilan Konum: Marmaris');
  }
}

function konumAl() {
  if (!navigator.geolocation) { varsayilanKonum(); return; }
  navigator.geolocation.getCurrentPosition(function(pos) {
    durum.lat = pos.coords.latitude;
    durum.lng = pos.coords.longitude;
    document.getElementById('konum-text').textContent = 'Konum alindi';
    reverseGeocode(durum.lat, durum.lng, function(adres) {
      document.getElementById('konum-text').textContent = adres;
    });
    esnaflarYukle();
    if (durum.anaHarita) {
      durum.anaHarita.setView([durum.lat, durum.lng], 13);
      L.circleMarker([durum.lat, durum.lng], {
        radius: 10, color: '#1565c0', fillColor: '#1e88e5', fillOpacity: 0.8, weight: 2
      }).addTo(durum.anaHarita).bindPopup('Konumunuz');
      kamuKurumlariniYukle(durum.lat, durum.lng, durum.anaHarita, durum.kamuMarkersAna);
    }
  }, function() {
    varsayilanKonum();
  });
}

// =============================================================
// HARİTALAR
// =============================================================

function konumButonuEkle(harita, callback) {
  var KonumKontrol = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd: function() {
      var btn = L.DomUtil.create('button', '');
      btn.innerHTML = '📍';
      btn.title = 'Konumuma git';
      btn.style.cssText = 'width:40px;height:40px;border-radius:50%;border:none;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.3);font-size:1.1rem;cursor:pointer;margin-bottom:8px';
      L.DomEvent.disableClickPropagation(btn);
      L.DomEvent.on(btn, 'click', function() {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(function(pos) {
          var latlng = [pos.coords.latitude, pos.coords.longitude];
          harita.setView(latlng, 15);
          if (callback) callback(latlng);
        });
      });
      return btn;
    }
  });
  new KonumKontrol().addTo(harita);
}

function anaHaritaBaslat() {
  if (durum.anaHarita) return;
  durum.anaHarita = L.map('ana-harita', { zoomControl: false, attributionControl: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(durum.anaHarita);
  durum.anaHarita.setView([36.8550, 28.2753], 13);
  var konumMarkerAna = null;
  konumButonuEkle(durum.anaHarita, function(latlng) {
    if (konumMarkerAna) durum.anaHarita.removeLayer(konumMarkerAna);
    konumMarkerAna = L.circleMarker(latlng, { radius: 10, color: '#1565c0', fillColor: '#1e88e5', fillOpacity: 0.8, weight: 2 })
      .addTo(durum.anaHarita).bindPopup('Konumunuz');
    durum.lat = latlng[0]; durum.lng = latlng[1];
  });

  // Tam ekran butonu (sağ üst)
  var TamEkranKontrol = L.Control.extend({
    options: { position: 'topright' },
    onAdd: function() {
      var btn = L.DomUtil.create('button', 'harita-tamekran-btn');
      btn.innerHTML = '⛶';
      btn.title = 'Tam ekran';
      L.DomEvent.disableClickPropagation(btn);
      L.DomEvent.on(btn, 'click', function() {
        var el = document.getElementById('ana-harita');
        durum.anaHaritaTamEkran = !durum.anaHaritaTamEkran;
        if (durum.anaHaritaTamEkran) {
          el.style.height = window.innerHeight + 'px';
          btn.innerHTML = '✕';
        } else {
          el.style.height = '200px';
          btn.innerHTML = '⛶';
        }
        durum.anaHarita.invalidateSize();
      });
      return btn;
    }
  });
  durum.anaHarita.addControl(new TamEkranKontrol());
}

var kamuTurleri = {
  hospital:     { ikon: '🏥', renk: '#e53935' },
  school:       { ikon: '🏫', renk: '#fb8c00' },
  police:       { ikon: '🚔', renk: '#1e88e5' },
  courthouse:   { ikon: '⚖️', renk: '#6d4c41' },
  fire_station: { ikon: '🚒', renk: '#f4511e' },
  post_office:  { ikon: '📮', renk: '#fdd835' },
  townhall:     { ikon: '🏛️', renk: '#5e35b1' }
};

function kamuKurumlariniYukle(lat, lng, harita, markerListesi) {
  // Mevcut kamu markerlarını temizle
  markerListesi.forEach(function(m) { harita.removeLayer(m); });
  markerListesi.length = 0;

  var amenityListesi = Object.keys(kamuTurleri).map(function(tip) {
    return 'node["amenity"="' + tip + '"](around:5000,' + lat + ',' + lng + ');' +
           'way["amenity"="' + tip + '"](around:5000,' + lat + ',' + lng + ');';
  }).join('');

  var sorgu = '[out:json][timeout:20];(' + amenityListesi + ');out center;';

  fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(sorgu)
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      data.elements.forEach(function(el) {
        var elLat = el.lat || (el.center && el.center.lat);
        var elLng = el.lon || (el.center && el.center.lon);
        if (!elLat || !elLng) return;

        var tip    = el.tags && el.tags.amenity;
        var bilgi  = kamuTurleri[tip];
        if (!bilgi) return;

        var isim = (el.tags && (el.tags.name || el.tags['name:tr'])) || bilgi.ikon;
        var dest = elLat + ',' + elLng;
        var origin = (durum.lat && durum.lng) ? '&origin=' + durum.lat + ',' + durum.lng : '';
        var mapsBase = 'https://www.google.com/maps/dir/?api=1&destination=' + dest + origin + '&travelmode=';
        var btnStyle = 'display:inline-block;padding:5px 8px;border-radius:7px;font-size:.75rem;font-weight:700;cursor:pointer;border:none;margin:2px;';
        var popupHtml =
          '<div style="min-width:180px">' +
            '<b style="font-size:.9rem">' + isim + '</b><br>' +
            '<span style="color:#888;font-size:.75rem">' + bilgi.ikon + ' ' + tip + '</span>' +
            '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px">' +
              '<a href="' + mapsBase + 'driving" target="_blank" style="' + btnStyle + 'background:#e3f2fd;color:#1565c0;text-decoration:none">🚗 Araçla</a>' +
              '<a href="' + mapsBase + 'walking" target="_blank" style="' + btnStyle + 'background:#e8f5e9;color:#2e7d32;text-decoration:none">🚶 Yaya</a>' +
              '<a href="' + mapsBase + 'transit" target="_blank" style="' + btnStyle + 'background:#f3e5f5;color:#6a1b9a;text-decoration:none">🚌 Toplu</a>' +
            '</div>' +
          '</div>';
        var marker = L.marker([elLat, elLng], {
          icon: L.divIcon({
            html: '<div style="font-size:1.2rem;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))">' + bilgi.ikon + '</div>',
            className: '',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          })
        }).addTo(harita).bindPopup(popupHtml, { maxWidth: 220 });

        markerListesi.push(marker);
      });
    })
    .catch(function() {}); // Sessizce hata yut
}

function kayitHaritaBaslat() {
  if (durum.kayitHarita) { durum.kayitHarita.invalidateSize(); return; }
  durum.kayitHarita = L.map('kayit-harita', { attributionControl: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(durum.kayitHarita);
  var baslat = durum.lat ? [durum.lat, durum.lng] : [36.8550, 28.2753];
  durum.kayitHarita.setView(baslat, 14);
  var marker = null;
  durum.kayitHarita.on('click', function(e) {
    if (marker) durum.kayitHarita.removeLayer(marker);
    marker = L.marker(e.latlng).addTo(durum.kayitHarita);
    durum.kayitLat = e.latlng.lat;
    durum.kayitLng = e.latlng.lng;
    document.getElementById('k-lat').value = durum.kayitLat;
    document.getElementById('k-lng').value = durum.kayitLng;
    reverseGeocode(durum.kayitLat, durum.kayitLng, function(adres) {
      document.getElementById('kayit-konum-text').textContent = adres;
    });
  });
  konumButonuEkle(durum.kayitHarita, function(latlng) {
    if (marker) durum.kayitHarita.removeLayer(marker);
    marker = L.marker(latlng).addTo(durum.kayitHarita);
    durum.kayitLat = latlng[0]; durum.kayitLng = latlng[1];
    document.getElementById('k-lat').value = durum.kayitLat;
    document.getElementById('k-lng').value = durum.kayitLng;
    reverseGeocode(latlng[0], latlng[1], function(adres) {
      document.getElementById('kayit-konum-text').textContent = adres;
    });
  });
}

function markerlariTemizle(liste) {
  liste.forEach(function(m) { m.remove(); });
  liste.length = 0;
}

var _kategoriRenk = { yemek: '#ff6b35', urun: '#1565c0', hizmet: '#6a1b9a', saglik: '#c62828', egitim: '#2e7d32' };
var _kategoriIkon = { yemek: '🍽️', urun: '🛍️', hizmet: '🔧', saglik: '🏥', egitim: '🎓' };

function _esnafIkon(kategori, acik) {
  var renk = _kategoriRenk[kategori] || '#555';
  var ikon = _kategoriIkon[kategori] || '🏪';
  var opasite = (acik === false) ? '0.5' : '1';
  return L.divIcon({
    className: '',
    html: '<div style="width:32px;height:32px;background:' + renk + ';border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);opacity:' + opasite + ';display:flex;align-items:center;justify-content:center">' +
            '<span style="transform:rotate(45deg);font-size:14px;line-height:1">' + ikon + '</span>' +
          '</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
}

function haritaMarkerlariGuncelle(esnaflar) {
  markerlariTemizle(durum.anaMarkers);
  if (durum.anaClusterGroup) {
    durum.anaHarita.removeLayer(durum.anaClusterGroup);
  }
  if (!durum.anaHarita) return;

  var useCluster = typeof L.markerClusterGroup === 'function';
  var group = useCluster
    ? L.markerClusterGroup({ maxClusterRadius: 50, showCoverageOnHover: false, zoomToBoundsOnClick: true })
    : null;

  esnaflar.forEach(function(e) {
    if (!e.lat || !e.lng) return;
    var lat = parseFloat(e.lat), lng = parseFloat(e.lng);
    var fiyatStr = (e.urunler && e.urunler.length)
      ? '₺' + Math.min.apply(null, e.urunler.map(function(u) { return u.fiyat || 0; })) + '\'den başlayan'
      : '';
    var popup = '<div style="min-width:140px">' +
      '<b style="font-size:.9rem">' + e.ad + '</b>' +
      (e.mesafe_text ? '<br><span style="color:#888;font-size:.75rem">📍 ' + e.mesafe_text + '</span>' : '') +
      (fiyatStr ? '<br><span style="color:#ff6b35;font-size:.75rem">' + fiyatStr + '</span>' : '') +
      '<br><button onclick="esnafDetay(' + e.id + ')" style="margin-top:6px;background:#ff6b35;color:#fff;border:none;border-radius:6px;padding:5px 10px;font-size:.75rem;cursor:pointer;width:100%">Detayı Gör</button>' +
      '</div>';
    var m = L.marker([lat, lng], { icon: _esnafIkon(e.kategori, e.acik) }).bindPopup(popup);
    if (useCluster) {
      group.addLayer(m);
    } else {
      m.addTo(durum.anaHarita);
      durum.anaMarkers.push(m);
    }
  });

  if (useCluster) {
    durum.anaHarita.addLayer(group);
    durum.anaClusterGroup = group;
  }
}

// =============================================================
// ESNAF LİSTESİ
// =============================================================

// =============================================================
// ÇALIŞMA SAATLERİ
// =============================================================

var GUNLER = ['pazar','pazartesi','sali','carsamba','persembe','cuma','cumartesi'];
var GUN_ETIKET = { pazartesi:'Pzt', sali:'Sal', carsamba:'Car', persembe:'Per', cuma:'Cum', cumartesi:'Cmt', pazar:'Paz' };

function simdiAcikMi(calisma_saatleri) {
  if (!calisma_saatleri) return { acik: null, sonrakiAcilis: null };
  var simdi = new Date();
  var gun = GUNLER[simdi.getDay()];
  var saat = simdi.getHours() * 60 + simdi.getMinutes();

  function dakikaYap(str) {
    if (!str) return null;
    var p = str.split(':');
    return parseInt(p[0]) * 60 + parseInt(p[1]);
  }

  var bugun = calisma_saatleri[gun];
  if (!bugun || bugun.kapali) {
    // Yarından itibaren ilk açık günü bul
    for (var i = 1; i <= 7; i++) {
      var g = GUNLER[(simdi.getDay() + i) % 7];
      var s = calisma_saatleri[g];
      if (s && !s.kapali && s.acilis) return { acik: false, sonrakiAcilis: GUN_ETIKET[g] + ' ' + s.acilis };
    }
    return { acik: false, sonrakiAcilis: null };
  }

  var acilis = dakikaYap(bugun.acilis);
  var kapanis = dakikaYap(bugun.kapanis);
  if (acilis === null || kapanis === null) return { acik: null, sonrakiAcilis: null };

  if (saat >= acilis && saat < kapanis) return { acik: true, sonrakiAcilis: null };

  // Kapalı — yarın veya bugün açılış saati
  if (saat < acilis) return { acik: false, sonrakiAcilis: bugun.acilis };
  for (var j = 1; j <= 7; j++) {
    var gg = GUNLER[(simdi.getDay() + j) % 7];
    var ss = calisma_saatleri[gg];
    if (ss && !ss.kapali && ss.acilis) return { acik: false, sonrakiAcilis: GUN_ETIKET[gg] + ' ' + ss.acilis };
  }
  return { acik: false, sonrakiAcilis: null };
}

function acikDurumHtml(e) {
  var cs = simdiAcikMi(e.calisma_saatleri);
  if (cs.acik === null) {
    return '<span class="tag ' + (e.acik ? 'open' : '') + '">' + (e.acik ? '🟢 Acik' : '🔴 Kapali') + '</span>';
  }
  if (cs.acik) return '<span class="tag open">🟢 Acik</span>';
  return '<span class="tag">' + '🔴 Kapali' + (cs.sonrakiAcilis ? ' · Acilis: ' + cs.sonrakiAcilis : '') + '</span>';
}

function acikDurumText(e) {
  var cs = simdiAcikMi(e.calisma_saatleri);
  if (cs.acik === null) return e.acik ? '🟢 Acik' : '🔴 Kapali';
  if (cs.acik) return '🟢 Acik';
  return '🔴 Kapali' + (cs.sonrakiAcilis ? ' · Acilis: ' + cs.sonrakiAcilis : '');
}

function mesafeFiltrele(liste) {
  if (!durum.lat || !durum.lng || !durum.mesafeFiltre) return liste;
  return liste.filter(function(e) { return (e.mesafe_km || 0) <= durum.mesafeFiltre; });
}

function esnaflarYukle() {
  var listesi = document.getElementById('esnaf-listesi');

  var cacheKey = 'esnaflar:' + (durum.kategori||'') + ':' + (durum.siralama||'') + ':' + (durum.arama||'');
  var cached = fcAl(cacheKey);
  if (cached) {
    // Konum varsa mesafeyi client'ta hesapla
    if (durum.lat && durum.lng) {
      cached = cached.map(function(e) {
        var lat2 = parseFloat(e.lat), lng2 = parseFloat(e.lng);
        var dLat = (lat2 - durum.lat) * Math.PI / 180;
        var dLng = (lng2 - durum.lng) * Math.PI / 180;
        var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(durum.lat*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
        var km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        e.mesafe_km = Math.round(km*10)/10;
        e.mesafe_text = km < 1 ? Math.round(km*1000)+'m' : km.toFixed(1)+'km';
        return e;
      });
      if (durum.siralama === 'mesafe') cached.sort(function(a,b){return a.mesafe_km-b.mesafe_km;});
    }
    var filtrelenmis = mesafeFiltrele(cached);
    esnaflarGoster(filtrelenmis);
    haritaMarkerlariGuncelle(filtrelenmis);
    return;
  }

  listesi.innerHTML = '<div class="yukleniyor"></div>';

  var params = new URLSearchParams();
  if (durum.lat)      { params.append('lat', durum.lat); params.append('lng', durum.lng); }
  if (durum.kategori) { params.append('kategori', durum.kategori); }
  if (durum.siralama) { params.append('siralama', durum.siralama); }
  if (durum.arama)    { params.append('arama', durum.arama); }

  fetch(API_URL + '/api/esnaflar?' + params.toString())
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) throw new Error(data.mesaj);
      fcKaydet(cacheKey, data.veri);
      var filtrelenmis = mesafeFiltrele(data.veri);
      esnaflarGoster(filtrelenmis);
      haritaMarkerlariGuncelle(filtrelenmis);
    })
    .catch(function(err) {
      listesi.innerHTML = '<div class="hata">Baglanamadi: ' + err.message + '</div>';
    });
}

function esnafKartlariOlustur(liste) {
  return liste.map(function(e) {
    var fiyatlar = (e.urunler || []).map(function(u) { return parseFloat(u.fiyat) || 0; });
    var minFiyat = fiyatlar.length ? Math.min.apply(null, fiyatlar) : null;
    var urunAdi  = (e.urunler || []).slice(0, 2).map(function(u) { return u.ad; }).join(', ');
    var kalp     = favoriMi(e.id) ? '❤️' : '🤍';
    var kampanyaVar = (e.kampanyalar || []).length > 0;
    return '<div class="esnaf-card" onclick="esnafDetay(' + e.id + ')">' +
      '<div class="esnaf-card-top">' +
        '<div class="esnaf-img">' + ikon(e.kategori) + (kampanyaVar ? '<div class="kart-kampanya-rozet">🏷️</div>' : '') + '</div>' +
        '<div class="esnaf-info">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
            '<h4>' + e.ad + (e.onayli ? ' <span class="onay-rozet">✓ Onaylı</span>' : '') + '</h4>' +
            '<button class="kalp-btn" data-id="' + e.id + '" onclick="favoriToggle(' + e.id + ',event)" ' +
              'style="background:none;border:none;font-size:1.2rem;cursor:pointer;padding:0 4px;line-height:1">' +
              kalp + '</button>' +
          '</div>' +
          '<div class="esnaf-meta">' +
            '<span>⭐ ' + (e.puan || 0) + '</span>' +
            '<span>(' + (e.yorum_sayisi || 0) + ' yorum)</span>' +
            (e.mesafe_text ? '<span>📍 ' + e.mesafe_text + '</span>' : '') +
            '<span>' + e.ilce + '</span>' +
          '</div>' +
          '<div class="esnaf-tags">' +
            acikDurumHtml(e) +
            '<span class="tag">' + (e.kategori || '') + '</span>' +
            (parseInt(e.ay_siparis_sayisi) > 0
              ? '<span class="tag" style="background:#fff3e0;color:#e65100;font-weight:700">🔥 Bu ay ' + e.ay_siparis_sayisi + ' sipariş</span>'
              : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      (urunAdi ? '<div class="esnaf-fiyat-bar"><span>' + urunAdi + '</span>' +
        (minFiyat !== null ? '<span class="min-fiyat">₺' + minFiyat + '\'den</span>' : '') +
      '</div>' : '') +
    '</div>';
  }).join('');
}

function oneCikanlariYukle() {
  fetch(API_URL + '/api/one-cikanlar')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var wrap = document.getElementById('one-cikanlar-wrap');
      if (!wrap) return;
      if (!data.basari || !data.veri || !data.veri.length) { wrap.style.display = 'none'; return; }
      var html = '<div style="font-size:.75rem;font-weight:800;color:#6a1b9a;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">⭐ Bu Hafta Öne Çıkanlar</div>' +
        '<div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;scrollbar-width:none">' +
        data.veri.map(function(e) {
          var fotoStyle = e.kapak_foto
            ? 'background:url(' + e.kapak_foto + ') center/cover no-repeat;'
            : 'background:linear-gradient(135deg,#6a1b9a,#ab47bc);';
          return '<div onclick="esnafDetay(' + e.id + ')" style="min-width:130px;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.12);cursor:pointer;flex-shrink:0">' +
            '<div style="height:80px;' + fotoStyle + 'position:relative">' +
              (e.one_cikan_etiket ? '<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.7));padding:4px 6px;font-size:.6rem;color:#fff;font-weight:700">' + e.one_cikan_etiket + '</div>' : '') +
            '</div>' +
            '<div style="padding:7px 8px;background:#fff">' +
              '<div style="font-size:.78rem;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + e.ad + '</div>' +
              '<div style="font-size:.68rem;color:#888">' + e.kategori + '</div>' +
              '<div style="font-size:.68rem;color:#ff6b35;font-weight:700">⭐ ' + (parseFloat(e.puan)||0).toFixed(1) + '</div>' +
            '</div>' +
          '</div>';
        }).join('') +
        '</div>';
      wrap.innerHTML = html;
      wrap.style.display = '';
    }).catch(function() {
      var wrap = document.getElementById('one-cikanlar-wrap');
      if (wrap) wrap.style.display = 'none';
    });
}

function esnaflarGoster(liste) {
  var listesi = document.getElementById('esnaf-listesi');
  if (!liste || !liste.length) {
    listesi.innerHTML = '<div class="yukleniyor">Esnaf bulunamadi.</div>';
    return;
  }
  listesi.innerHTML = esnafKartlariOlustur(liste);
}

// =============================================================
// ARAMA
// =============================================================

function aramaBaslat() {
  var input = document.getElementById('arama');
  if (!input) return;
  var t;
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      clearTimeout(t);
      durum.arama = input.value.trim();
      esnaflarYukle();
    }
  });
  input.addEventListener('input', function() {
    clearTimeout(t);
    t = setTimeout(function() {
      durum.arama = input.value.trim();
      esnaflarYukle();
    }, 400);
  });
}

function gorselAramaBaslat() {
  var btn   = document.getElementById('gorsel-ara-btn');
  var input = document.getElementById('fotograf-input');
  if (!btn || !input) return;
  btn.addEventListener('click', function() { input.click(); });
  input.addEventListener('change', function() {
    if (!input.files[0]) return;
    var fd = new FormData();
    fd.append('fotograf', input.files[0]);
    var listesi = document.getElementById('esnaf-listesi');
    listesi.innerHTML = '<div class="yukleniyor">Gorsel analiz ediliyor...</div>';
    fetch(API_URL + '/api/gorsel-ara', { method: 'POST', body: fd })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.basari) throw new Error(data.mesaj);
        esnaflarGoster(data.veri);
        if (data.anahtar_kelimeler && data.anahtar_kelimeler.length) {
          document.getElementById('arama').value = data.anahtar_kelimeler[0];
          durum.arama = data.anahtar_kelimeler[0];
        }
      })
      .catch(function(err) {
        listesi.innerHTML = '<div class="hata">Gorsel arama basarisiz: ' + err.message + '</div>';
      });
    input.value = '';
  });
}

// =============================================================
// ESNAF DETAY
// =============================================================

function esnafDetay(id) {
  sayfaGoster('detay');
  fetch(API_URL + '/api/esnaflar/' + id + '/goruntuleme', { method: 'PUT' }).catch(function(){});
  durum.sepet = [];
  durum.secilenEsnaf = null;
  document.getElementById('detay-adi').textContent = '';
  document.getElementById('tab-menu').innerHTML = '<div class="yukleniyor"></div>';
  sepetGuncelle();

  var params = durum.lat ? '?lat=' + durum.lat + '&lng=' + durum.lng : '';
  fetch(API_URL + '/api/esnaflar/' + id + params)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) throw new Error(data.mesaj);
      durum.secilenEsnaf = data.veri;
      detayDoldur(data.veri);
    })
    .catch(function(err) {
      document.getElementById('detay-adi').textContent = 'Hata: ' + err.message;
    });
}

function kampanyaBannerOlustur(kampanyalar) {
  var aktif = (kampanyalar || []).filter(function(k) {
    if (!k.bitis_tarihi) return true;
    return new Date(k.bitis_tarihi) >= new Date(new Date().toDateString());
  });
  var el = document.getElementById('kampanya-banner');
  if (!aktif.length) { el.style.display = 'none'; return; }
  var k = aktif[0];
  var bugun = k.bitis_tarihi && new Date(k.bitis_tarihi).toDateString() === new Date().toDateString();
  var sonGun = bugun ? ' · Bugün son gün!' : (k.bitis_tarihi ? ' · ' + new Date(k.bitis_tarihi).toLocaleDateString('tr-TR') + ' son' : '');
  el.style.display = 'block';
  el.textContent = '🏷️ ' + (k.indirim_orani ? '%' + k.indirim_orani + ' İndirim — ' : '') + k.baslik + sonGun;
}

function detayDoldur(e) {
  kampanyaBannerOlustur(e.kampanyalar);
  document.getElementById('hero-icon').textContent = ikon(e.kategori);
  document.getElementById('detay-adi').textContent = e.ad;
  document.getElementById('detay-puan').textContent = '⭐ ' + (e.puan || 0);
  document.getElementById('detay-mesafe').textContent = e.mesafe_text ? '📍 ' + e.mesafe_text : '📍 ' + e.ilce;
  document.getElementById('detay-yorum-sayi').textContent = '(' + (e.yorum_sayisi || 0) + ' yorum)';
  document.getElementById('detay-durum').textContent = acikDurumText(e);

  document.getElementById('ulasim-bar').innerHTML =
    '<div class="ulasim-btn active"><div class="u-icon">🚶</div><div class="u-sure">~10dk</div><div class="u-label">Yuruyus</div></div>' +
    '<div class="ulasim-btn"><div class="u-icon">🚗</div><div class="u-sure">~3dk</div><div class="u-label">Arac</div></div>' +
    '<button class="yol-btn" onclick="yolTarifi()">🗺 Yol Tarifi</button>';

  // Sosyal kanıt bar
  var kanit = [];
  if (parseInt(e.ay_siparis_sayisi) > 0) kanit.push('<span style="font-size:.75rem;color:#e65100;font-weight:700">🔥 Bu ay ' + e.ay_siparis_sayisi + ' sipariş</span>');
  if (parseInt(e.goruntuleme_sayisi) > 0) kanit.push('<span style="font-size:.75rem;color:#888">👁 ' + e.goruntuleme_sayisi + ' görüntüleme</span>');
  if (parseInt(e.yorum_sayisi) > 0)       kanit.push('<span style="font-size:.75rem;color:#888">💬 ' + e.yorum_sayisi + ' yorum</span>');
  var kanitEl = document.getElementById('detay-sosyal-kanit');
  if (kanitEl) {
    if (kanit.length) { kanitEl.innerHTML = kanit.join('<span style="color:#eee">·</span>'); kanitEl.style.display = 'flex'; }
    else              { kanitEl.style.display = 'none'; }
  }

  var sosyal = [];
  if (e.instagram_url) {
    sosyal.push('<a href="' + e.instagram_url + '" target="_blank" rel="noopener" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,#833ab4,#e1306c,#f77737);color:#fff;border-radius:10px;padding:9px 8px;font-size:.78rem;font-weight:700;text-decoration:none">📸 Instagram</a>');
  }
  if (e.google_maps_url) {
    sosyal.push('<a href="' + e.google_maps_url + '" target="_blank" rel="noopener" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;background:#fff;border:1.5px solid #4285f4;color:#4285f4;border-radius:10px;padding:9px 8px;font-size:.78rem;font-weight:700;text-decoration:none">⭐ Google Yorumları</a>');
  }
  var sosyalEl = document.getElementById('detay-sosyal');
  if (sosyalEl) sosyalEl.innerHTML = sosyal.join('');

  // Detay haritası
  setTimeout(function() {
    if (!durum.detayHarita) {
      durum.detayHarita = L.map('detay-harita', { zoomControl: false, attributionControl: false, dragging: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(durum.detayHarita);
    }
    if (e.lat && e.lng) {
      var lat = parseFloat(e.lat), lng = parseFloat(e.lng);
      durum.detayHarita.setView([lat, lng], 15);
      durum.detayHarita.eachLayer(function(l) { if (l instanceof L.Marker) l.remove(); });
      L.marker([lat, lng]).addTo(durum.detayHarita).bindPopup(e.ad).openPopup();
    }
    durum.detayHarita.invalidateSize();
  }, 100);

  // Hizmet/ürün esnafı buton ayrımı
  var isHizmet = e.kategori === 'hizmet';
  document.getElementById('btn-kurye').style.display = isHizmet ? 'none' : '';
  document.getElementById('btn-gelal').style.display = isHizmet ? 'none' : '';
  document.getElementById('btn-randevu').style.display = isHizmet ? '' : 'none';
  document.getElementById('btn-soru-sor').style.display = isHizmet ? '' : 'none';

  // Tablar
  var tablar = ['Menu', 'Yorumlar', 'Yorum Yaz'];
  if (e.randevu_modu || isHizmet) tablar.push('📅 Randevu');
  document.getElementById('detay-tabs').innerHTML = tablar.map(function(t, i) {
    return '<div class="detay-tab' + (i === 0 ? ' active' : '') + '" onclick="tabSec(this,' + i + ')">' + t + '</div>';
  }).join('');

  menuGoster(e.urunler || []);
  yorumlarGoster(e.yorumlar || []);
  puanSeciciOlustur();

  document.getElementById('tab-menu').style.display = '';
  document.getElementById('tab-yorumlar').style.display = 'none';
  document.getElementById('tab-yorum-ekle').style.display = 'none';
  document.getElementById('tab-randevu').style.display = 'none';

  // Randevu modu aktifse veya hizmet esnafıysa randevu formunu hazırla
  if (e.randevu_modu || isHizmet) {
    var bugun = new Date().toISOString().split('T')[0];
    document.getElementById('det-randevu-tarih').min = bugun;
    document.getElementById('det-randevu-tarih').value = bugun;
    document.getElementById('det-slot-bolum').style.display = 'none';
    document.getElementById('det-randevu-form').style.display = 'none';
    detHizmetleriYukle(e.id);
    detSlotlarYukle();
  }
}

function tabSec(el, idx) {
  document.querySelectorAll('.detay-tab').forEach(function(t) { t.classList.remove('active'); });
  el.classList.add('active');
  document.getElementById('tab-menu').style.display = idx === 0 ? '' : 'none';
  document.getElementById('tab-yorumlar').style.display = idx === 1 ? '' : 'none';
  document.getElementById('tab-yorum-ekle').style.display = idx === 2 ? '' : 'none';
  document.getElementById('tab-randevu').style.display = idx === 3 ? '' : 'none';
}

// =============================================================
// RANDEVU — MÜŞTERİ DETAY SAYFASI
// =============================================================

var _detSecilenSlot = null;

function detHizmetleriYukle(esnafId) {
  fetch(API_URL + '/api/esnaf/' + esnafId + '/hizmetler')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var select = document.getElementById('det-randevu-hizmet');
      if (!select) return;
      select.innerHTML = '<option value="">-- Hizmet seçin (opsiyonel) --</option>';
      (data.veri || []).forEach(function(h) {
        var opt = document.createElement('option');
        opt.value = h.id;
        opt.textContent = h.ad + ' · ' + h.sure + ' dk' + (parseFloat(h.fiyat) > 0 ? ' · ₺' + h.fiyat : '');
        select.appendChild(opt);
      });
    }).catch(function() {});
}

function detSlotlarYukle() {
  var e = durum.secilenEsnaf;
  if (!e) return;
  var tarih = document.getElementById('det-randevu-tarih').value;
  var hizmetId = document.getElementById('det-randevu-hizmet').value;
  if (!tarih) return;

  _detSecilenSlot = null;
  document.getElementById('det-randevu-form').style.display = 'none';

  var url = API_URL + '/api/esnaf/' + e.id + '/musait-slotlar?tarih=' + tarih;
  if (hizmetId) url += '&hizmet_id=' + hizmetId;

  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var bolum = document.getElementById('det-slot-bolum');
      var grid = document.getElementById('det-slot-grid');
      bolum.style.display = '';
      if (!data.basari || !data.veri || !data.veri.length) {
        grid.innerHTML = '<div style="grid-column:1/-1;color:#aaa;text-align:center;padding:10px;font-size:.82rem">Bu tarih için müsait slot yok.</div>';
        return;
      }
      grid.innerHTML = data.veri.map(function(s) {
        var style = s.musait
          ? 'background:#fff;border:1.5px solid #e0e0e0;border-radius:10px;padding:8px 6px;font-size:.82rem;font-weight:700;cursor:pointer;text-align:center;position:relative'
          : 'background:#f5f5f5;border:1.5px solid #eee;border-radius:10px;padding:8px 6px;font-size:.82rem;color:#ccc;text-decoration:line-through;text-align:center;position:relative';
        var indirimBadge = (s.musait && s.indirim) ? '<div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:#ff6b35;color:#fff;font-size:.6rem;font-weight:800;border-radius:4px;padding:1px 5px;white-space:nowrap">%' + s.indirim + ' İndirim</div>' : '';
        return '<button style="' + style + '" ' +
          (s.musait ? 'onclick="detSlotSec(this,\'' + s.saat + '\')"' : 'disabled') + '>' +
          indirimBadge + s.saat + '</button>';
      }).join('');
    }).catch(function() {
      document.getElementById('det-slot-bolum').style.display = '';
      document.getElementById('det-slot-grid').innerHTML = '<div style="color:#e53935;font-size:.8rem">Bağlantı hatası.</div>';
    });
}

function detSlotSec(btn, saat) {
  document.querySelectorAll('#det-slot-grid button').forEach(function(b) {
    b.style.background = '#fff'; b.style.color = '#222'; b.style.borderColor = '#e0e0e0';
  });
  btn.style.background = '#ff6b35'; btn.style.color = '#fff'; btn.style.borderColor = '#ff6b35';
  _detSecilenSlot = saat;
  // Oturum varsa telefon/adı prefill
  var oturum = oturumAl();
  if (oturum) {
    if (oturum.ad) document.getElementById('det-randevu-ad').value = oturum.ad;
    if (oturum.telefon) document.getElementById('det-randevu-tel').value = oturum.telefon;
  }
  document.getElementById('det-randevu-form').style.display = '';
}

function detRandevuOlustur() {
  var e = durum.secilenEsnaf;
  if (!e) return;
  var ad = document.getElementById('det-randevu-ad').value.trim();
  var tel = document.getElementById('det-randevu-tel').value.trim();
  var not = document.getElementById('det-randevu-not').value.trim();
  var tarih = document.getElementById('det-randevu-tarih').value;
  var hizmetId = document.getElementById('det-randevu-hizmet').value || null;

  if (!ad || !tel) { bildirim('Ad ve telefon zorunlu.', 'uyari'); return; }
  if (!_detSecilenSlot) { bildirim('Lütfen bir saat seçin.', 'uyari'); return; }

  fetch(API_URL + '/api/randevu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      esnaf_id: e.id,
      musteri_ad: ad,
      musteri_telefon: tel,
      hizmet_id: hizmetId ? parseInt(hizmetId) : null,
      tarih: tarih,
      saat: _detSecilenSlot,
      notlar: not || null
    })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.bekleme) {
        bildirim('Bu saat dolmuş. Bekleme listesine eklendiniz! Slot açıldığında WhatsApp ile bildirim alacaksınız.', 'uyari');
      } else if (data.basari) {
        bildirim('Randevunuz oluşturuldu! ' + tarih + ' · ' + _detSecilenSlot + ' — WhatsApp onayı gönderildi.', 'basari');
        document.getElementById('det-randevu-ad').value = '';
        document.getElementById('det-randevu-tel').value = '';
        document.getElementById('det-randevu-not').value = '';
        _detSecilenSlot = null;
        document.getElementById('det-randevu-form').style.display = 'none';
        // Anında slot grid'ini güncelle (başka müşteri aynı saati seçemesin)
        detSlotlarYukle();
      } else {
        bildirim('Hata: ' + (data.mesaj || 'Bilinmeyen hata.'), 'hata');
      }
    })
    .catch(function() { bildirim('Bağlantı hatası.', 'hata'); });
}

function menuGoster(urunler) {
  var con = document.getElementById('tab-menu');
  if (!urunler.length) { con.innerHTML = '<div class="yukleniyor">Urun bulunamadi.</div>'; return; }
  con.innerHTML = urunler.map(function(u) {
    var fiyat = parseFloat(u.fiyat) || 0;
    return '<div class="menu-item">' +
      (u.fotograf_url ? '<img src="' + u.fotograf_url + '" loading="lazy" onclick="event.stopPropagation();lightboxAc(\'' + u.fotograf_url + '\')" style="width:50px;height:50px;object-fit:cover;border-radius:8px;margin-right:10px;cursor:zoom-in">' : '') +
      '<div class="menu-item-info">' +
        '<h5>' + u.ad + '</h5>' +
        '<p>' + (u.aciklama || '') + '</p>' +
        '<button class="add-btn" onclick="sepeteEkle(' + u.id + ',\'' + u.ad.replace(/'/g, "\\'") + '\',' + fiyat + ')">+</button>' +
      '</div>' +
      '<span class="menu-price">₺' + fiyat + '</span>' +
    '</div>';
  }).join('');
}

function yorumlarGoster(yorumlar) {
  var con = document.getElementById('tab-yorumlar');
  if (!yorumlar.length) { con.innerHTML = '<div class="yukleniyor">Henuz yorum yok.</div>'; return; }
  con.innerHTML = yorumlar.map(function(y) {
    return '<div class="yorum-card">' +
      '<div class="yorum-header">' +
        '<span class="yorum-kullanici">' + (y.kullanici || 'Anonim') + '</span>' +
        '<span class="yorum-tarih">' + (y.tarih ? new Date(y.tarih).toLocaleDateString('tr-TR') : '') + '</span>' +
      '</div>' +
      '<div class="yorum-puan">' + '⭐'.repeat(parseInt(y.puan) || 0) + '</div>' +
      '<div class="yorum-text">' + (y.yorum || '') + '</div>' +
    '</div>';
  }).join('');
}

function puanSeciciOlustur() {
  durum.secilenPuan = 0;
  document.getElementById('puan-secici').innerHTML = [1,2,3,4,5].map(function(p) {
    return '<span class="puan-yildiz" onclick="puanSec(' + p + ')">⭐</span>';
  }).join('');
}

function puanSec(p) {
  durum.secilenPuan = p;
  document.querySelectorAll('.puan-yildiz').forEach(function(el, i) {
    el.classList.toggle('aktif', i < p);
  });
}

function yolTarifi() {
  if (!durum.secilenEsnaf) return;
  window.open('https://www.google.com/maps/dir/?api=1&destination=' +
    durum.secilenEsnaf.lat + ',' + durum.secilenEsnaf.lng, '_blank');
}

// =============================================================
// SEPET & SİPARİŞ
// =============================================================

function sepeteEkle(id, ad, fiyat) {
  var m = durum.sepet.find(function(s) { return s.id === id; });
  if (m) { m.adet++; } else { durum.sepet.push({ id: id, ad: ad, fiyat: fiyat, adet: 1 }); }
  sepetGuncelle();
}

function sepetGuncelle() {
  var adet   = durum.sepet.reduce(function(t, s) { return t + s.adet; }, 0);
  var toplam = durum.sepet.reduce(function(t, s) { return t + s.fiyat * s.adet; }, 0);
  document.getElementById('sepet-adet').textContent = adet + ' urun';
  document.getElementById('sepet-toplam').textContent = '₺' + toplam;
  document.getElementById('sepet-btn').classList.toggle('gizli', adet === 0);
}

function siparisVer() {
  if (!durum.sepet.length || !durum.secilenEsnaf) return;
  var profil = profilYukle();
  if (!profil || !profil.telefon) {
    bildirim('Sipariş vermek için önce profilinize telefon numarası ekleyin.', 'uyari');
    profilSayfasiGoster();
    return;
  }
  var adres = '';
  if (durum.teslimat === 'kurye') {
    if (profil.lat && profil.lng) {
      adres = profil.lat.toFixed(5) + ',' + profil.lng.toFixed(5);
    } else if (profil.adres1 && profil.adres1 !== 'Konum alindi ✓') {
      adres = profil.adres1;
    } else if (durum.lat && durum.lng) {
      adres = durum.lat.toFixed(5) + ',' + durum.lng.toFixed(5);
    } else {
      adres = prompt('Teslimat adresinizi girin:') || '';
    }
  }
  fetch(API_URL + '/api/siparisler', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      esnaf_id: durum.secilenEsnaf.id,
      urunler: durum.sepet,
      teslimat_turu: durum.teslimat,
      adres: adres,
      musteri_telefon: profil.telefon || null
    })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.basari) {
        if (data.whatsapp_url) window.open(data.whatsapp_url, '_blank');
        fcSil('esnaflar:');
        durum.sepet = [];
        sepetGuncelle();
        siparislerimSayfasiAc(data.veri.id);
      } else { bildirim('Hata: ' + data.mesaj, 'hata'); }
    })
    .catch(function() { bildirim('Sipariş gönderilemedi.', 'hata'); });
}

// =============================================================
// SORU SOR

function soruModalAc() {
  var modal = document.getElementById('modal-soru');
  modal.style.display = 'flex';
  var profil = profilYukle();
  if (profil) {
    if (profil.ad)  document.getElementById('soru-ad').value = profil.ad;
    if (profil.telefon) document.getElementById('soru-telefon').value = profil.telefon;
  }
  document.getElementById('soru-metin').value = '';
}

function soruModalKapat() {
  document.getElementById('modal-soru').style.display = 'none';
}

function soruGonder() {
  if (!durum.secilenEsnaf) return;
  var soru = document.getElementById('soru-metin').value.trim();
  if (!soru) { bildirim('Lütfen sorunuzu yazın.', 'uyari'); return; }
  var ad  = document.getElementById('soru-ad').value.trim();
  var tel = document.getElementById('soru-telefon').value.trim();
  fetch(API_URL + '/api/sorular', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ esnaf_id: durum.secilenEsnaf.id, musteri_ad: ad || null, musteri_telefon: tel || null, soru: soru })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) { bildirim(data.mesaj || 'Gönderilemedi.', 'hata'); return; }
      soruModalKapat();
      bildirim('Sorunuz iletildi! Esnaf kısa sürede yanıtlayacak.', 'basari');
    })
    .catch(function() { bildirim('Bağlantı hatası.', 'hata'); });
}

// =============================================================
// YORUM GÖNDER
// =============================================================

function yorumGonder() {
  if (!durum.secilenEsnaf) return;
  var kullanici = document.getElementById('yorum-kullanici').value.trim();
  var yorum     = document.getElementById('yorum-metin').value.trim();
  if (!kullanici || !yorum || !durum.secilenPuan) {
    bildirim('Lütfen tüm alanları doldurun ve puan verin.', 'uyari'); return;
  }
  fetch(API_URL + '/api/esnaflar/' + durum.secilenEsnaf.id + '/yorumlar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kullanici: kullanici, puan: durum.secilenPuan, yorum: yorum })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.basari) {
        bildirim('Yorumunuz eklendi!', 'basari');
        document.getElementById('yorum-kullanici').value = '';
        document.getElementById('yorum-metin').value = '';
        fcSil('esnaflar:');
        esnafDetay(durum.secilenEsnaf.id);
      } else { bildirim('Hata: ' + data.mesaj, 'hata'); }
    })
    .catch(function() { bildirim('Yorum gönderilemedi.', 'hata'); });
}

// =============================================================
// ESNAF KAYIT
// =============================================================

function kayitFormuBaslat() {
  // Vergi levhası dosya adı
  var vergiDosya = document.getElementById('k-vergi-dosya');
  if (vergiDosya) {
    vergiDosya.addEventListener('change', function() {
      if (vergiDosya.files[0])
        document.getElementById('vergi-text').textContent = vergiDosya.files[0].name;
    });
  }

  // Ürün satırı ekle
  var urunEkleBtn = document.getElementById('urun-satir-ekle');
  if (urunEkleBtn) {
    urunEkleBtn.addEventListener('click', function() {
      var satir = document.createElement('div');
      satir.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center;flex-wrap:wrap';
      satir.innerHTML =
        '<input type="text" name="urun_adlari" placeholder="Urun adi" style="flex:2;min-width:120px;background:#fff;border:2px solid #eee;border-radius:10px;padding:9px;font-size:.82rem;outline:none;font-family:inherit">' +
        '<input type="number" name="urun_fiyatlari" placeholder="Fiyat" style="flex:1;min-width:70px;background:#fff;border:2px solid #eee;border-radius:10px;padding:9px;font-size:.82rem;outline:none;font-family:inherit">' +
        '<label style="cursor:pointer;background:#f5f5f5;border:2px solid #eee;border-radius:10px;padding:8px;font-size:1.1rem;flex-shrink:0">📸<input type="file" name="urun_fotograflari" accept="image/*" style="display:none"></label>';
      document.getElementById('urun-girisleri').appendChild(satir);
    });
  }

  // Konum al
  var konumAlBtn = document.getElementById('konum-al-kayit');
  if (konumAlBtn) {
    konumAlBtn.addEventListener('click', function() {
      if (!navigator.geolocation) { bildirim('Konum desteklenmiyor.', 'uyari'); return; }
      navigator.geolocation.getCurrentPosition(function(pos) {
        durum.kayitLat = pos.coords.latitude;
        durum.kayitLng = pos.coords.longitude;
        document.getElementById('k-lat').value = durum.kayitLat;
        document.getElementById('k-lng').value = durum.kayitLng;
        document.getElementById('kayit-konum-text').textContent =
          durum.kayitLat.toFixed(4) + ', ' + durum.kayitLng.toFixed(4);
        if (durum.kayitHarita) durum.kayitHarita.setView([durum.kayitLat, durum.kayitLng], 15);
      });
    });
  }

  // Kayıt gönder
  var kayitGonderBtn = document.getElementById('kayit-gonder');
  if (kayitGonderBtn) {
    kayitGonderBtn.addEventListener('click', function() {
      var ad       = document.getElementById('k-ad').value.trim();
      var kategori = document.getElementById('k-kategori').value;
      var ilce     = document.getElementById('k-ilce').value;
      var adres    = document.getElementById('k-adres').value.trim();
      var telefon  = document.getElementById('k-telefon').value.trim();
      var email    = document.getElementById('k-email').value.trim();
      var vergiNo  = document.getElementById('k-vergi').value.trim();
      var lat      = document.getElementById('k-lat').value;
      var lng      = document.getElementById('k-lng').value;
      var sifre    = document.getElementById('k-sifre').value.trim();
      var mesajEl  = document.getElementById('esnaf-kayit-mesaj');

      if (!ad || !kategori || !ilce || !telefon || !vergiNo) {
        mesajEl.style.color = '#e53935'; mesajEl.textContent = 'Lütfen zorunlu alanları doldurun (*).'; return;
      }
      if (sifre && sifre.length < 6) {
        mesajEl.style.color = '#e53935'; mesajEl.textContent = 'Şifre en az 6 karakter olmalı.'; return;
      }

      var fd = new FormData();
      fd.append('ad', ad); fd.append('kategori', kategori); fd.append('ilce', ilce);
      fd.append('adres', adres); fd.append('telefon', telefon); fd.append('email', email);
      fd.append('vergi_no', vergiNo);
      if (sifre) fd.append('sifre', sifre);
      if (lat) fd.append('lat', lat);
      if (lng) fd.append('lng', lng);
      if (vergiDosya && vergiDosya.files[0]) fd.append('vergi_levhasi', vergiDosya.files[0]);
      document.querySelectorAll('[name="urun_adlari"]').forEach(function(inp) {
        if (inp.value.trim()) fd.append('urun_adlari', inp.value.trim());
      });
      document.querySelectorAll('[name="urun_fiyatlari"]').forEach(function(inp) {
        fd.append('urun_fiyatlari', inp.value || '0');
      });
      document.querySelectorAll('[name="urun_fotograflari"]').forEach(function(inp) {
        if (inp.files[0]) fd.append('urun_fotograflari', inp.files[0]);
      });

      kayitGonderBtn.disabled = true; kayitGonderBtn.textContent = 'Gönderiliyor...'; mesajEl.textContent = '';

      fetch(API_URL + '/api/esnaf-kayit', { method: 'POST', body: fd })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          kayitGonderBtn.disabled = false; kayitGonderBtn.textContent = 'Kayıt Ol';
          if (data.basari) {
            var onayHtml = '<div style="text-align:center;padding:20px 10px">' +
              '<div style="font-size:3rem;margin-bottom:12px">✅</div>' +
              '<h3 style="font-weight:800;font-size:1.1rem;margin-bottom:8px;color:#2e7d32">Başvurunuz Alındı!</h3>' +
              '<p style="font-size:.85rem;color:#555;margin-bottom:6px">Kayıt No: <b>#' + data.kayit_id + '</b></p>' +
              '<p style="font-size:.82rem;color:#888;margin-bottom:20px">İşletmeniz incelendikten sonra onaylanacak. Admin size ulaşacak.</p>' +
              '<button onclick="sayfaGoster(\'kayit-secim\')" style="width:100%;background:#1a1a2e;color:#fff;border:none;border-radius:14px;padding:13px;font-weight:700;font-size:.9rem;cursor:pointer">Giriş Yap</button>' +
            '</div>';
            var icerikEl = document.getElementById('kayit-form-wrap');
            if (icerikEl) icerikEl.innerHTML = onayHtml;
            else sayfaGoster('ana');
          } else {
            mesajEl.style.color = '#e53935'; mesajEl.textContent = 'Hata: ' + data.mesaj;
          }
        })
        .catch(function() {
          kayitGonderBtn.disabled = false; kayitGonderBtn.textContent = 'Kayıt Ol';
          mesajEl.style.color = '#e53935'; mesajEl.textContent = 'Bağlantı hatası.';
        });
    });
  }
}

// =============================================================
// ADMİN PANELİ
// =============================================================

// =============================================================
// KURYE KAYIT
// =============================================================

function kuryeKayitGonder() {
  var ad      = document.getElementById('kur-ad').value.trim();
  var telefon = document.getElementById('kur-telefon').value.trim();
  var arac    = document.getElementById('kur-arac').value;
  var ilce    = document.getElementById('kur-ilce').value;
  var sifre   = document.getElementById('kur-sifre') ? document.getElementById('kur-sifre').value.trim() : '';
  var mesaj   = document.getElementById('kurye-kayit-mesaj');
  var btn     = document.getElementById('kurye-kayit-gonder');

  if (!ad || !telefon || !arac || !ilce) {
    mesaj.style.color = '#e53935'; mesaj.textContent = 'Lütfen tüm alanları doldurun.'; return;
  }

  btn.disabled = true; btn.textContent = 'Gönderiliyor...'; mesaj.textContent = '';

  fetch(API_URL + '/api/kurye-kayit', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ad: ad, telefon: telefon, arac_tipi: arac, ilce: ilce, sifre: sifre })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      btn.disabled = false; btn.textContent = 'Başvur';
      if (data.basari) {
        mesaj.style.color = '#2e7d32'; mesaj.textContent = '✅ Başvurunuz alındı! Onaylandığında size ulaşacağız.';
        ['kur-ad','kur-telefon','kur-arac','kur-ilce','kur-sifre'].forEach(function(id) {
          var el = document.getElementById(id); if (el) el.value = '';
        });
      } else {
        mesaj.style.color = '#e53935'; mesaj.textContent = 'Hata: ' + data.mesaj;
      }
    })
    .catch(function() {
      btn.disabled = false; btn.textContent = 'Başvur';
      mesaj.style.color = '#e53935'; mesaj.textContent = 'Bağlantı hatası.';
    });
}

var _musConfirmation = null;
var _musRecaptcha = null;

function telefonIntlFormat(t) {
  var d = t.replace(/\D/g, '');
  if (d.startsWith('90') && d.length === 12) return '+' + d;
  if (d.startsWith('0')  && d.length === 11) return '+90' + d.slice(1);
  if (d.length === 10) return '+90' + d;
  return '+' + d;
}

function musteriKayitGonder() {
  var ad      = document.getElementById('mus-ad').value.trim();
  var telefon = document.getElementById('mus-telefon').value.trim();
  var sifre   = document.getElementById('mus-sifre').value.trim();
  var mesaj   = document.getElementById('musteri-kayit-mesaj');
  var btn     = document.getElementById('musteri-kayit-gonder');

  if (!ad || !telefon || !sifre) {
    mesaj.style.color = '#e53935'; mesaj.textContent = 'Lütfen tüm alanları doldurun.'; return;
  }
  if (sifre.length < 4) {
    mesaj.style.color = '#e53935'; mesaj.textContent = 'Şifre en az 4 karakter olmalı.'; return;
  }

  // SMS doğrulaması geçici olarak devre dışı — direkt kayıt
  btn.disabled = true; btn.textContent = 'Kaydediliyor...'; mesaj.textContent = '';

  fetch(API_URL + '/api/kayit', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ad: ad, telefon: telefon, sifre: sifre })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      btn.disabled = false; btn.textContent = 'Kayıt Ol';
      if (data.basari) {
        var v = { kullanici_id: data.kullanici_id, ad: ad, telefon: telefon, tip: 'musteri', sifre: sifre };
        oturumKaydet(v); oturumaGoreNavGuncelle();
        mesaj.style.color = '#2e7d32'; mesaj.textContent = '✅ Kayıt başarılı! Hoş geldiniz.';
        setTimeout(function() { sayfaGoster('ana'); }, 1000);
      } else {
        mesaj.style.color = '#e53935'; mesaj.textContent = 'Hata: ' + data.mesaj;
      }
    })
    .catch(function() {
      btn.disabled = false; btn.textContent = 'Kayıt Ol';
      mesaj.style.color = '#e53935'; mesaj.textContent = 'Bağlantı hatası.';
    });
}

var adminAktifSekme = 'ozet';

function adminGoster(sekme) {
  var oturum = oturumAl(); var key = (oturum && oturum.sifre) ? oturum.sifre : prompt('Admin sifresi:');
  if (!key) return;
  sayfaGoster('admin');
  if (sekme) adminAktifSekme = sekme;
  adminSekmeGuncelle(adminAktifSekme);
  adminVerileriYukle(key, adminAktifSekme);
}

function adminSekmeGuncelle(aktif) {
  document.querySelectorAll('.admin-sekme').forEach(function(btn) {
    var isAktif = btn.dataset.sekme === aktif;
    btn.style.background = isAktif ? '#1a1a2e' : '#f0f0f0';
    btn.style.color = isAktif ? '#fff' : '#444';
  });
}

function _adminOzetKart(ikon, baslik, ana, alt, renk) {
  return '<div style="background:#fff;border-radius:12px;padding:14px;box-shadow:0 2px 8px rgba(0,0,0,.06);border-left:4px solid ' + renk + '">' +
    '<div style="font-size:1.4rem;margin-bottom:4px">' + ikon + '</div>' +
    '<div style="font-size:.72rem;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.04em">' + baslik + '</div>' +
    '<div style="font-size:1.1rem;font-weight:800;color:#1a1a2e;margin-top:2px">' + ana + '</div>' +
    (alt ? '<div style="font-size:.72rem;color:#aaa;margin-top:2px">' + alt + '</div>' : '') +
  '</div>';
}

function adminVerileriYukle(key, sekme) {
  var icerik = document.getElementById('admin-icerik');
  icerik.innerHTML = '<div class="yukleniyor"></div>';

  if (sekme === 'ozet') {
    fetch(API_URL + '/api/admin/ozet?key=' + key).then(function(r) { return r.json(); })
    .then(function(result) {
      if (!result.basari) { icerik.innerHTML = '<div class="hata">Yetkisiz erişim.</div>'; return; }
      var v = result.veri;
      icerik.innerHTML =
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">' +
          _adminOzetKart('🏪', 'Esnaf', v.esnaf_aktif + ' aktif', v.esnaf_bekleyen + ' bekliyor', '#1a1a2e') +
          _adminOzetKart('🛵', 'Kurye', v.kurye_aktif + ' aktif', v.kurye_bekleyen + ' bekliyor', '#6a1b9a') +
          _adminOzetKart('👤', 'Müşteri', v.musteri + ' kayıtlı', '', '#1565c0') +
          _adminOzetKart('📦', 'Bugün Sipariş', v.siparis_bugun + ' sipariş', 'Bu ay: ' + v.siparis_ay, '#e65100') +
          _adminOzetKart('💰', 'Bu Ay Ciro', '₺' + Math.round(v.ciro_ay), 'Toplam: ₺' + Math.round(v.ciro_toplam), '#2e7d32') +
        '</div>' +
        (v.esnaf_bekleyen > 0
          ? '<div style="background:#fff3e0;border-radius:10px;padding:12px;text-align:center"><span style="font-weight:700;color:#e65100">⚠️ ' + v.esnaf_bekleyen + ' esnaf onay bekliyor!</span><button onclick="adminVerileriYukle(oturumAl().sifre,\'esnaflar\')" style="display:block;margin:8px auto 0;background:#e65100;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:.8rem;font-weight:700;cursor:pointer">Esnafları Gör</button></div>'
          : '');
    }).catch(function() { icerik.innerHTML = '<div class="hata">Bağlanamadı.</div>'; });

  } else if (sekme === 'esnaflar') {
    Promise.all([
      fetch(API_URL + '/api/admin/bekleyenler?key=' + key).then(function(r) { return r.json(); }),
      fetch(API_URL + '/api/admin/aktifler?key='    + key).then(function(r) { return r.json(); })
    ]).then(function(results) {
      if (!results[0].basari) { icerik.innerHTML = '<div class="hata">Yetkisiz erisim.</div>'; return; }
      adminEsnaflarGoster(results[0].veri, results[1].veri || [], key);
    }).catch(function() { icerik.innerHTML = '<div class="hata">Baglanamadi.</div>'; });

  } else if (sekme === 'kuryeler') {
    fetch(API_URL + '/api/admin/kuryeler?key=' + key).then(function(r) { return r.json(); })
    .then(function(result) {
      if (!result.basari) { icerik.innerHTML = '<div class="hata">Yetkisiz erisim.</div>'; return; }
      adminKuryelerGoster(result.veri || [], key);
    }).catch(function() { icerik.innerHTML = '<div class="hata">Baglanamadi.</div>'; });

  } else if (sekme === 'musteriler') {
    fetch(API_URL + '/api/admin/musteriler?key=' + key).then(function(r) { return r.json(); })
    .then(function(result) {
      if (!result.basari) { icerik.innerHTML = '<div class="hata">Yetkisiz erisim.</div>'; return; }
      adminMusterilerGoster(result.veri || [], key);
    }).catch(function() { icerik.innerHTML = '<div class="hata">Baglanamadi.</div>'; });

  } else if (sekme === 'siparisler') {
    fetch(API_URL + '/api/admin/siparisler?key=' + key).then(function(r) { return r.json(); })
    .then(function(result) {
      if (!result.basari) { icerik.innerHTML = '<div class="hata">Yetkisiz erisim.</div>'; return; }
      adminSiparislerGoster(result.veri || [], key, 'tumu');
    }).catch(function() { icerik.innerHTML = '<div class="hata">Baglanamadi.</div>'; });
  }
}

function adminEsnaflarGoster(bekleyenler, aktifler, key) {
  var html = '<div class="s-title">Bekleyen Onaylar (' + bekleyenler.length + ')</div>';
  if (!bekleyenler.length) {
    html += '<div style="color:#aaa;font-size:.82rem;padding:8px 0">Bekleyen başvuru yok.</div>';
  } else {
    html += bekleyenler.map(function(e) {
      return '<div class="admin-card" onclick="adminEsnafDetay(' + e.id + ',\'' + key + '\')" style="cursor:pointer">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<div><b>' + e.ad + '</b><br><small>' + e.kategori + ' · ' + e.ilce + '</small><br><small style="color:#e65100">⏳ Onay Bekliyor</small></div>' +
          '<div style="color:#aaa;font-size:1.2rem">›</div>' +
        '</div></div>';
    }).join('');
  }

  html += '<div class="s-title" style="margin-top:16px">Tüm Esnaflar (' + aktifler.length + ')</div>';
  if (!aktifler.length) {
    html += '<div style="color:#aaa;font-size:.82rem;padding:8px 0">Kayıtlı esnaf yok.</div>';
  } else {
    html += aktifler.map(function(e) {
      return '<div class="admin-card" onclick="adminEsnafDetay(' + e.id + ',\'' + key + '\')" style="cursor:pointer">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<div><b>' + e.ad + '</b><br>' +
            '<small>' + e.kategori + ' · ' + e.ilce + '</small><br>' +
            '<small style="color:' + (e.onaylandi ? '#2e7d32' : '#e65100') + '">' + (e.onaylandi ? '✅ Yayında' : '⏳ Bekliyor') + '</small>' +
          '</div>' +
          '<div style="color:#aaa;font-size:1.2rem">›</div>' +
        '</div></div>';
    }).join('');
  }

  document.getElementById('admin-icerik').innerHTML = html;
}

function adminKuryelerGoster(kuryeler, key) {
  var html = '<div class="s-title">Tüm Kuryeler (' + kuryeler.length + ')</div>';
  if (!kuryeler.length) {
    html += '<div style="color:#aaa;font-size:.82rem;padding:8px 0">Kayıtlı kurye yok.</div>';
  } else {
    html += kuryeler.map(function(k) {
      return '<div class="admin-card" onclick="adminKuryeDetay(' + k.id + ',\'' + key + '\')" style="cursor:pointer">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<div><b>' + k.ad + '</b><br>' +
            '<small>' + k.telefon + ' · ' + k.arac_tipi + ' · ' + k.ilce + '</small><br>' +
            '<small style="color:' + (k.onaylandi ? '#2e7d32' : '#e65100') + '">' + (k.onaylandi ? '✅ Onaylı' : '⏳ Bekliyor') + '</small>' +
          '</div>' +
          '<div style="color:#aaa;font-size:1.2rem">›</div>' +
        '</div></div>';
    }).join('');
  }
  document.getElementById('admin-icerik').innerHTML = html;
}

function adminMusterilerGoster(musteriler, key) {
  var html = '<div class="s-title">Kayıtlı Müşteriler (' + musteriler.length + ')</div>';
  if (!musteriler.length) {
    html += '<div style="color:#aaa;font-size:.82rem;padding:8px 0">Kayıtlı müşteri yok.</div>';
  } else {
    html += musteriler.map(function(m) {
      var tarih = m.olusturma ? new Date(m.olusturma).toLocaleDateString('tr-TR') : '-';
      return '<div class="admin-card" onclick="adminMusteriDetay(' + m.id + ',\'' + m.ad + '\',\'' + m.telefon + '\',\'' + tarih + '\',\'' + key + '\')" style="cursor:pointer">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<div><b>' + (m.ad || 'İsimsiz') + '</b><br><small>' + m.telefon + '</small><br><small style="color:#999">Kayıt: ' + tarih + '</small></div>' +
          '<div style="color:#aaa;font-size:1.2rem">›</div>' +
        '</div></div>';
    }).join('');
  }
  document.getElementById('admin-icerik').innerHTML = html;
}

// ---- SİPARİŞLER ----

var _adminSiparisVerisi = [];

function adminSiparislerGoster(siparisler, key, filtre) {
  _adminSiparisVerisi = siparisler;
  var durumlar = [
    { v: 'tumu',          l: 'Tümü' },
    { v: 'bekliyor',      l: '⏳ Bekliyor' },
    { v: 'hazirlaniyor',  l: '👨‍🍳 Hazırlanıyor' },
    { v: 'kurye_atandi',  l: '🛵 Kurye Atandı' },
    { v: 'yolda',         l: '🚀 Yolda' },
    { v: 'teslim_edildi', l: '✅ Teslim' },
    { v: 'iptal',         l: '❌ İptal' }
  ];
  var filtreHTML = '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px">' +
    durumlar.map(function(d) {
      var aktif = filtre === d.v;
      return '<button onclick="adminSiparisFiltrele(\'' + d.v + '\',\'' + key + '\')" style="border:none;border-radius:8px;padding:5px 8px;font-size:.68rem;font-weight:700;cursor:pointer;background:' + (aktif ? '#1a1a2e' : '#f0f0f0') + ';color:' + (aktif ? '#fff' : '#444') + '">' + d.l + '</button>';
    }).join('') + '</div>';

  var liste = filtre === 'tumu' ? siparisler : siparisler.filter(function(s) { return s.durum === filtre; });
  var html = '<div class="s-title">Siparişler (' + liste.length + ')</div>' + filtreHTML;

  if (!liste.length) {
    html += '<div style="color:#aaa;font-size:.82rem;padding:8px 0">Bu filtrede sipariş yok.</div>';
  } else {
    html += liste.map(function(s) {
      var tarih = s.tarih ? new Date(s.tarih).toLocaleString('tr-TR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '-';
      var durumRenk = { bekliyor:'#e65100', hazirlaniyor:'#1565c0', kurye_atandi:'#6a1b9a', yolda:'#0277bd', teslim_edildi:'#2e7d32', iptal:'#c62828' };
      var renk = durumRenk[s.durum] || '#666';
      return '<div class="admin-card" onclick="adminSiparisDetay(' + s.id + ',\'' + key + '\')" style="cursor:pointer">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
          '<div style="flex:1">' +
            '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">' +
              '<b>#' + s.id + '</b>' +
              '<span style="background:' + renk + ';color:#fff;border-radius:6px;padding:2px 7px;font-size:.65rem;font-weight:700">' + (s.durum || 'bekliyor') + '</span>' +
            '</div>' +
            '<small>' + (s.esnaf_adi || '-') + '</small><br>' +
            '<small style="color:#888">' + (s.musteri_telefon || '-') + ' · ' + tarih + '</small>' +
          '</div>' +
          '<div style="text-align:right"><b style="color:#1a1a2e">₺' + (s.genel_toplam || 0) + '</b><div style="color:#aaa;font-size:1rem">›</div></div>' +
        '</div></div>';
    }).join('');
  }

  document.getElementById('admin-icerik').innerHTML = html;
}

function adminSiparisFiltrele(filtre, key) {
  adminSiparislerGoster(_adminSiparisVerisi, key, filtre);
}

// ---- MODAL ----

function adminModalAc(html) {
  document.getElementById('admin-modal-icerik').innerHTML = html;
  document.getElementById('admin-modal').style.display = 'block';
}

function adminModalKapat() {
  document.getElementById('admin-modal').style.display = 'none';
}

// ---- DETAY MODALLARI ----

function adminEsnafDetay(id, key) {
  adminModalAc('<div class="yukleniyor">Yükleniyor...</div>');
  fetch(API_URL + '/api/esnaflar/' + id).then(function(r) { return r.json(); })
  .then(function(res) {
    if (!res.basari) { adminModalAc('<div class="hata">Yüklenemedi.</div>'); return; }
    var e = res.veri;
    var urunlerHTML = (e.urunler && e.urunler.length)
      ? e.urunler.map(function(u) { return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f0f0f0"><span>' + u.ad + '</span><b>₺' + u.fiyat + '</b></div>'; }).join('')
      : '<div style="color:#aaa;font-size:.8rem">Ürün yok</div>';

    var html = '<h3 style="margin:0 30px 12px 0;font-size:1rem">🏪 Esnaf Detayı</h3>' +
      '<div style="display:flex;gap:8px;margin-bottom:8px">' +
        (e.onaylandi
          ? '<button onclick="adminIslem(\'pasif\',' + e.id + ',\'' + key + '\')" style="flex:1;background:#fff3e0;color:#e65100;border:none;border-radius:8px;padding:8px;font-size:.75rem;font-weight:700;cursor:pointer">Yayından Al</button>'
          : '<button onclick="adminIslem(\'onayla\',' + e.id + ',\'' + key + '\')" style="flex:1;background:#e8f5e9;color:#2e7d32;border:none;border-radius:8px;padding:8px;font-size:.75rem;font-weight:700;cursor:pointer">Onayla</button>'
        ) +
        '<button onclick="adminIslem(\'reddet\',' + e.id + ',\'' + key + '\')" style="flex:1;background:#ffebee;color:#c62828;border:none;border-radius:8px;padding:8px;font-size:.75rem;font-weight:700;cursor:pointer">Reddet/Sil</button>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:12px">' +
        (e.one_cikan
          ? '<button onclick="adminOneCikanKaldir(' + e.id + ',\'' + key + '\')" style="flex:1;background:#e8f5e9;color:#2e7d32;border:none;border-radius:8px;padding:8px;font-size:.75rem;font-weight:700;cursor:pointer">⭐ Öne Çıkıyor — Kaldır</button>'
          : '<button onclick="adminOneCikarModal(' + e.id + ',\'' + key + '\')" style="flex:1;background:#f3e5f5;color:#6a1b9a;border:none;border-radius:8px;padding:8px;font-size:.75rem;font-weight:700;cursor:pointer">⭐ Öne Çıkar</button>'
        ) +
      '</div>' +
      '<div style="background:#f9f9f9;border-radius:10px;padding:12px;margin-bottom:12px">' +
        '<div style="font-size:.75rem;color:#888;margin-bottom:8px">BİLGİLER — tıklayarak düzenle</div>' +
        '<input id="esnaf-edit-ad" value="' + (e.ad||'') + '" style="width:100%;border:1px solid #ddd;border-radius:8px;padding:7px 10px;margin-bottom:6px;font-size:.85rem;box-sizing:border-box">' +
        '<input id="esnaf-edit-kategori" value="' + (e.kategori||'') + '" placeholder="Kategori" style="width:100%;border:1px solid #ddd;border-radius:8px;padding:7px 10px;margin-bottom:6px;font-size:.85rem;box-sizing:border-box">' +
        '<input id="esnaf-edit-ilce" value="' + (e.ilce||'') + '" placeholder="İlçe" style="width:100%;border:1px solid #ddd;border-radius:8px;padding:7px 10px;margin-bottom:6px;font-size:.85rem;box-sizing:border-box">' +
        '<input id="esnaf-edit-telefon" value="' + (e.telefon||'') + '" placeholder="Telefon" style="width:100%;border:1px solid #ddd;border-radius:8px;padding:7px 10px;margin-bottom:6px;font-size:.85rem;box-sizing:border-box">' +
        '<input id="esnaf-edit-adres" value="' + (e.adres||'') + '" placeholder="Adres" style="width:100%;border:1px solid #ddd;border-radius:8px;padding:7px 10px;margin-bottom:6px;font-size:.85rem;box-sizing:border-box">' +
        '<button onclick="adminEsnafKaydet(' + e.id + ',\'' + key + '\')" style="width:100%;background:#1a1a2e;color:#fff;border:none;border-radius:8px;padding:9px;font-size:.8rem;font-weight:700;cursor:pointer">Kaydet</button>' +
      '</div>' +
      '<div style="font-weight:700;font-size:.82rem;margin-bottom:6px">Ürünler (' + (e.urunler ? e.urunler.length : 0) + ')</div>' +
      urunlerHTML;

    adminModalAc(html);
  }).catch(function() { adminModalAc('<div class="hata">Bağlantı hatası.</div>'); });
}

function adminEsnafKaydet(id, key) {
  var body = {
    key: key,
    ad:       document.getElementById('esnaf-edit-ad').value.trim(),
    kategori: document.getElementById('esnaf-edit-kategori').value.trim(),
    ilce:     document.getElementById('esnaf-edit-ilce').value.trim(),
    telefon:  document.getElementById('esnaf-edit-telefon').value.trim(),
    adres:    document.getElementById('esnaf-edit-adres').value.trim()
  };
  if (!body.ad || !body.telefon) { bildirim('Ad ve telefon zorunlu.', 'uyari'); return; }
  fetch(API_URL + '/api/admin/esnaf/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  .then(function(r) { return r.json(); })
  .then(function(res) {
    if (res.basari) { adminModalKapat(); adminGoster('esnaflar'); }
    else bildirim(res.mesaj, 'hata');
  });
}

function adminOneCikarModal(esnafId, key) {
  var etiket = prompt('Bu esnaf için öne çıkarma etiketi (örn: "Bu Haftanın Favorisi"):');
  if (etiket === null) return; // iptal
  fetch(API_URL + '/api/admin/esnaf/' + esnafId + '/one-cikan', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: key, aktif: true, etiket: etiket.trim() || null })
  }).then(function(r) { return r.json(); })
  .then(function(res) {
    bildirim(res.mesaj, res.basari ? 'basari' : 'hata');
    if (res.basari) { adminModalKapat(); adminGoster('esnaflar'); }
  });
}

function adminOneCikanKaldir(esnafId, key) {
  fetch(API_URL + '/api/admin/esnaf/' + esnafId + '/one-cikan', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: key, aktif: false })
  }).then(function(r) { return r.json(); })
  .then(function(res) {
    bildirim(res.mesaj, res.basari ? 'basari' : 'hata');
    if (res.basari) { adminModalKapat(); adminGoster('esnaflar'); }
  });
}

function adminKuryeDetay(id, key) {
  var oturum = oturumAl();
  if (!oturum) return;
  fetch(API_URL + '/api/admin/kuryeler?key=' + key).then(function(r) { return r.json(); })
  .then(function(res) {
    if (!res.basari) return;
    var k = (res.veri || []).find(function(x) { return x.id === id; });
    if (!k) { adminModalAc('<div class="hata">Kurye bulunamadı.</div>'); return; }
    var tarih = k.kayit_tarihi ? new Date(k.kayit_tarihi).toLocaleDateString('tr-TR') : '-';
    var html = '<h3 style="margin:0 30px 12px 0;font-size:1rem">🛵 Kurye Detayı</h3>' +
      '<div style="background:#f9f9f9;border-radius:10px;padding:12px;margin-bottom:14px">' +
        '<div style="margin-bottom:5px"><b>' + k.ad + '</b></div>' +
        '<div style="font-size:.83rem;color:#555;line-height:1.8">' +
          '📞 ' + k.telefon + '<br>' +
          '🚗 ' + k.arac_tipi + '<br>' +
          '📍 ' + k.ilce + '<br>' +
          '📅 Kayıt: ' + tarih + '<br>' +
          '<span style="color:' + (k.onaylandi ? '#2e7d32' : '#e65100') + '">' + (k.onaylandi ? '✅ Onaylı' : '⏳ Onay Bekliyor') + '</span>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px">' +
        (!k.onaylandi
          ? '<button onclick="kuryeIslem(\'onayla\',' + k.id + ',\'' + key + '\')" style="flex:1;background:#e8f5e9;color:#2e7d32;border:none;border-radius:8px;padding:9px;font-size:.8rem;font-weight:700;cursor:pointer">Onayla</button>'
          : '') +
        '<button onclick="kuryeIslem(\'sil\',' + k.id + ',\'' + key + '\')" style="flex:1;background:#ffebee;color:#c62828;border:none;border-radius:8px;padding:9px;font-size:.8rem;font-weight:700;cursor:pointer">Sil</button>' +
      '</div>';
    adminModalAc(html);
  });
}

function adminMusteriDetay(id, ad, telefon, tarih, key) {
  var html = '<h3 style="margin:0 30px 12px 0;font-size:1rem">👤 Müşteri Detayı</h3>' +
    '<div style="background:#f9f9f9;border-radius:10px;padding:12px;margin-bottom:14px">' +
      '<div style="margin-bottom:5px"><b>' + (ad || 'İsimsiz') + '</b></div>' +
      '<div style="font-size:.83rem;color:#555;line-height:1.8">' +
        '📞 ' + telefon + '<br>' +
        '📅 Kayıt: ' + tarih +
      '</div>' +
    '</div>' +
    '<div style="font-weight:700;font-size:.82rem;margin-bottom:8px">Siparişleri</div>' +
    '<div id="musteri-siparis-listesi"><div class="yukleniyor" style="font-size:.8rem">Yükleniyor...</div></div>' +
    '<div style="margin-top:14px">' +
      '<button onclick="adminMusteriSil(' + id + ',\'' + key + '\')" style="width:100%;background:#ffebee;color:#c62828;border:none;border-radius:8px;padding:9px;font-size:.8rem;font-weight:700;cursor:pointer">Müşteriyi Sil</button>' +
    '</div>';
  adminModalAc(html);

  fetch(API_URL + '/api/admin/siparisler?key=' + key).then(function(r) { return r.json(); })
  .then(function(res) {
    var el = document.getElementById('musteri-siparis-listesi');
    if (!el) return;
    var liste = (res.veri || []).filter(function(s) { return s.musteri_telefon === telefon; });
    if (!liste.length) { el.innerHTML = '<div style="color:#aaa;font-size:.78rem">Sipariş bulunamadı.</div>'; return; }
    el.innerHTML = liste.slice(0, 10).map(function(s) {
      var t = s.tarih ? new Date(s.tarih).toLocaleDateString('tr-TR') : '-';
      return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:.78rem">' +
        '<span><b>#' + s.id + '</b> ' + (s.esnaf_adi||'-') + ' · ' + t + '</span>' +
        '<b>₺' + (s.genel_toplam||0) + '</b></div>';
    }).join('');
  });
}

function adminMusteriSil(id, key) {
  if (!confirm('Müşteri silinecek. Emin misiniz?')) return;
  fetch(API_URL + '/api/admin/musteri/' + id + '?key=' + key, { method: 'DELETE' })
  .then(function(r) { return r.json(); })
  .then(function(res) {
    if (res.basari) { adminModalKapat(); adminGoster('musteriler'); }
    else bildirim(res.mesaj, 'hata');
  });
}

function adminSiparisDetay(id, key) {
  fetch(API_URL + '/api/siparis-detay/' + id).then(function(r) { return r.json(); })
  .then(function(res) {
    if (!res.basari) { adminModalAc('<div class="hata">Sipariş yüklenemedi.</div>'); return; }
    var s = res.veri;
    var tarih = s.tarih ? new Date(s.tarih).toLocaleString('tr-TR') : '-';
    var urunlerHTML = '';
    try {
      var urunler = typeof s.urunler === 'string' ? JSON.parse(s.urunler) : s.urunler;
      urunlerHTML = (urunler || []).map(function(u) {
        return '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f5f5f5;font-size:.8rem">' +
          '<span>' + u.ad + ' × ' + u.adet + '</span><b>₺' + (u.fiyat * u.adet) + '</b></div>';
      }).join('');
    } catch(e) { urunlerHTML = '<div style="font-size:.8rem;color:#aaa">Ürün verisi okunamadı</div>'; }

    var durumSecenekleri = ['bekliyor','hazirlaniyor','kurye_atandi','yolda','teslim_edildi','iptal'];
    var durumSelect = '<select id="siparis-durum-select" style="width:100%;border:1px solid #ddd;border-radius:8px;padding:8px;font-size:.82rem;margin-bottom:8px">' +
      durumSecenekleri.map(function(d) { return '<option value="' + d + '"' + (s.durum === d ? ' selected' : '') + '>' + d + '</option>'; }).join('') +
      '</select>';

    var html = '<h3 style="margin:0 30px 12px 0;font-size:1rem">📦 Sipariş #' + s.id + '</h3>' +
      '<div style="background:#f9f9f9;border-radius:10px;padding:12px;margin-bottom:12px;font-size:.82rem;line-height:1.9">' +
        '🏪 <b>' + (s.esnaf_adi||'-') + '</b><br>' +
        '👤 ' + (s.musteri_telefon||'-') + '<br>' +
        '📍 ' + (s.teslimat_turu||'-') + (s.adres ? ' · ' + s.adres : '') + '<br>' +
        '📅 ' + tarih +
      '</div>' +
      '<div style="font-weight:700;font-size:.82rem;margin-bottom:6px">Ürünler</div>' +
      '<div style="margin-bottom:12px">' + urunlerHTML + '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:.82rem;padding:6px 0;border-top:1px solid #eee">' +
        '<span>Ara toplam</span><span>₺' + (s.ara_toplam||0) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:.82rem;padding:6px 0;border-bottom:1px solid #eee">' +
        '<span>Kurye + Komisyon</span><span>₺' + ((s.kurye_ucreti||0) + (s.komisyon||0)) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:.9rem;font-weight:800;padding:8px 0;margin-bottom:12px">' +
        '<span>Toplam</span><span>₺' + (s.genel_toplam||0) + '</span></div>' +
      '<div style="font-weight:700;font-size:.82rem;margin-bottom:6px">Durum Güncelle</div>' +
      durumSelect +
      '<button onclick="adminSiparisGuncelle(' + s.id + ',\'' + key + '\')" style="width:100%;background:#1a1a2e;color:#fff;border:none;border-radius:8px;padding:9px;font-size:.82rem;font-weight:700;cursor:pointer">Kaydet</button>';

    adminModalAc(html);
  });
}

function adminSiparisGuncelle(id, key) {
  var durum = document.getElementById('siparis-durum-select').value;
  fetch(API_URL + '/api/siparisler/' + id + '/durum', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ durum: durum })
  }).then(function(r) { return r.json(); })
  .then(function(res) {
    if (res.basari) { adminModalKapat(); adminGoster('siparisler'); }
    else bildirim(res.mesaj, 'hata');
  });
}

function kuryeIslem(tip, id, key) {
  if (tip === 'sil' && !confirm('Kurye silinecek. Emin misiniz?')) return;
  var istek;
  if (tip === 'onayla') istek = fetch(API_URL + '/api/admin/kurye-onayla/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: key }) });
  else if (tip === 'sil') istek = fetch(API_URL + '/api/admin/kurye-sil/' + id + '?key=' + key, { method: 'DELETE' });
  istek.then(function(r) { return r.json(); }).then(function(data) {
    if (!data.basari) { bildirim('Hata: ' + data.mesaj, 'hata'); return; }
    adminModalKapat();
    adminGoster('kuryeler');
  }).catch(function() { bildirim('Bağlantı hatası.', 'hata'); });
}

function adminIslem(tip, id, key) {
  var onay = { reddet: 'Esnaf reddedilip silinecek.', sil: 'Esnaf tamamen silinecek!' };
  if (onay[tip] && !confirm(onay[tip] + ' Emin misiniz?')) return;

  var istek;
  if (tip === 'onayla') istek = fetch(API_URL + '/api/admin/onayla/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: key }) });
  else if (tip === 'pasif') istek = fetch(API_URL + '/api/admin/pasif/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: key }) });
  else if (tip === 'aktif') istek = fetch(API_URL + '/api/admin/aktif/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: key }) });
  else if (tip === 'reddet') istek = fetch(API_URL + '/api/admin/reddet/' + id + '?key=' + key, { method: 'DELETE' });
  else if (tip === 'sil')    istek = fetch(API_URL + '/api/admin/sil/'    + id + '?key=' + key, { method: 'DELETE' });

  istek.then(function(r) { return r.json(); }).then(function(data) {
    if (!data.basari) { bildirim('Hata: ' + data.mesaj, 'hata'); return; }
    adminModalKapat();
    fcSil('esnaflar'); // frontend önbelleği temizle
    adminGoster('esnaflar');
  }).catch(function() { bildirim('Bağlantı hatası.', 'hata'); });
}

// =============================================================
// OTURUM YÖNETİMİ
// =============================================================

function oturumAl() {
  try { return JSON.parse(localStorage.getItem('oturum') || 'null'); }
  catch(e) { return null; }
}

function oturumKaydet(kullanici) {
  localStorage.setItem('oturum', JSON.stringify(kullanici));
  durum.panelEsnafId = kullanici.esnaf_id || null;
  durum.oturumTip    = kullanici.tip;
  // Giriş yapıldığında bildirim badge'ini hemen güncelle
  bildirimSayisiGuncelle();
}

function oturumSil() {
  localStorage.removeItem('oturum');
  durum.panelEsnafId = null;
  durum.oturumTip    = null;
}

function girisYap(telefon, sifre, btn, callback) {
  var orijinalMetin = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Giriş yapılıyor...'; }
  fetch(API_URL + '/api/giris', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telefon: telefon, sifre: sifre })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (btn) { btn.disabled = false; btn.textContent = orijinalMetin; }
      if (!data.basari) { bildirim(data.mesaj, 'hata'); return; }
      data.veri.sifre = sifre; oturumKaydet(data.veri);
      oturumaGoreNavGuncelle();
      bildirimIzniAl();
      // Müşteri ise backend'deki profil verisini localStorage'a merge et
      if (data.veri.tip === 'musteri' && data.veri.kullanici_id) {
        var mevcutProfil = profilYukle() || {};
        if (data.veri.email)   mevcutProfil.email   = data.veri.email;
        if (data.veri.adresler && data.veri.adresler.length) mevcutProfil.adresler = data.veri.adresler;
        mevcutProfil.isim    = mevcutProfil.isim    || data.veri.ad    || '';
        mevcutProfil.telefon = mevcutProfil.telefon || data.veri.telefon || '';
        profilKaydet(mevcutProfil);
      }
      if (callback) callback(data.veri);
    })
    .catch(function() {
      if (btn) { btn.disabled = false; btn.textContent = orijinalMetin; }
      bildirim('Bağlantı hatası.', 'hata');
    });
}

function cikisYap() {
  oturumSil();
  oturumaGoreNavGuncelle();
  sayfaGoster('ana');
}

// =============================================================
// ESNAF PANELİ — GİRİŞ / ÇIKIŞ
// =============================================================

function panelEsnafAl() {
  // Backward compat: önce yeni oturum, sonra eski panel_esnaf
  var oturum = oturumAl();
  if (oturum && (oturum.tip === 'esnaf' || oturum.tip === 'admin')) return oturum;
  try { return JSON.parse(localStorage.getItem('panel_esnaf') || 'null'); }
  catch(e) { return null; }
}

function panelGirisYap() {
  var telefon = document.getElementById('panel-giris-telefon').value.trim();
  var sifre   = document.getElementById('panel-giris-sifre').value.trim();
  if (!telefon || !sifre) { bildirim('Telefon ve şifre zorunlu.', 'uyari'); return; }
  var btn = document.getElementById('panel-giris-btn');
  girisYap(telefon, sifre, btn, function(kullanici) {
    if (kullanici.tip === 'admin') {
      adminGoster();
    } else {
      panelGoruntule();
    }
  });
}

function panelCikisYap() {
  cikisYap();
}

function panelGoruntule() {
  var oturum   = oturumAl();
  var girisEl  = document.getElementById('panel-giris-bolum');
  var icerikEl = document.getElementById('panel-icerik');
  var baslikEl = document.getElementById('panel-baslik-ad');
  var cikisEl  = document.getElementById('panel-cikis-btn');

  if (!oturum || (oturum.tip !== 'esnaf' && oturum.tip !== 'kurye' && oturum.tip !== 'admin')) {
    girisEl.style.display  = 'block';
    icerikEl.style.display = 'none';
    cikisEl.style.display  = 'none';
    document.getElementById('panel-stats-row').style.display = 'none';
    baslikEl.textContent   = 'Giriş yapınız';
    document.getElementById('panel-giris-telefon').value = '';
    document.getElementById('panel-giris-sifre').value   = '';
    return;
  }

  girisEl.style.display  = 'none';
  icerikEl.style.display = 'block';
  baslikEl.textContent   = oturum.ad || oturum.tip;
  cikisEl.style.display  = 'inline-block';
  document.getElementById('panel-stats-row').style.display = 'flex';
  durum.panelEsnafId = oturum.esnaf_id || null;
  panelYukle();
}

// =============================================================
// ESNAF PANELİ — İÇERİK
// =============================================================

function panelYukle() {
  var esnafId = durum.panelEsnafId;
  if (!esnafId) return;
  var con = document.getElementById('panel-siparisler');
  con.innerHTML = '<div class="yukleniyor"></div>';
  fetch(API_URL + '/api/siparisler?esnaf_id=' + esnafId)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) { con.innerHTML = '<div class="hata">Hata.</div>'; return; }
      var siparisler = data.veri;
      var toplam = siparisler.reduce(function(t, s) { return t + parseFloat(s.genel_toplam || 0); }, 0);
      document.getElementById('panel-siparis-sayi').textContent = siparisler.length;
      document.getElementById('panel-toplam').textContent = '₺' + Math.round(toplam);

      if (!siparisler.length) { con.innerHTML = '<div class="yukleniyor">Henuz siparis yok.</div>'; return; }
      var durumMetin = { bekliyor: 'Bekliyor', hazirlaniyor: 'Hazırlanıyor', kurye_atandi: 'Kurye Atandı', yolda: 'Yolda', teslim_edildi: 'Teslim Edildi', tamamlandi: 'Tamamlandı', iptal: 'İptal' };
      var durumRenk  = { bekliyor: '#e65100', hazirlaniyor: '#1565c0', kurye_atandi: '#6a1b9a', yolda: '#0277bd', teslim_edildi: '#2e7d32', tamamlandi: '#388e3c', iptal: '#c62828' };
      con.innerHTML = siparisler.slice(0, 30).map(function(s) {
        var urunler = Array.isArray(s.urunler) ? s.urunler :
          (typeof s.urunler === 'string' ? JSON.parse(s.urunler) : []);
        var urunText = urunler.map(function(u) { return u.ad + ' x' + u.adet; }).join(', ');
        var sonDurum = s.durum === 'tamamlandi' || s.durum === 'teslim_edildi' || s.durum === 'iptal';
        var sonrakiButon = '';
        if (!sonDurum) {
          if (s.durum === 'bekliyor') {
            sonrakiButon = '<button class="btn-accept" style="background:#1565c0" onclick="panelSiparisDurum(' + s.id + ',\'hazirlaniyor\')">Hazırlanıyor</button>';
          } else if (s.durum === 'hazirlaniyor') {
            if (s.teslimat_turu === 'kurye') {
              sonrakiButon = '<button class="btn-accept" style="background:#0277bd" onclick="panelSiparisDurum(' + s.id + ',\'yolda\')">Yola Çıktı</button>';
            } else {
              sonrakiButon = '<button class="btn-accept" onclick="panelSiparisDurum(' + s.id + ',\'tamamlandi\')">Tamamlandı</button>';
            }
          } else if (s.durum === 'yolda' || s.durum === 'kurye_atandi') {
            sonrakiButon = '<button class="btn-accept" onclick="panelSiparisDurum(' + s.id + ',\'tamamlandi\')">Tamamlandı</button>';
          }
        }
        return '<div class="order-card">' +
          '<div class="order-header">' +
            '<span class="order-id">#' + s.id + '</span>' +
            '<span class="order-badge" style="background:' + (durumRenk[s.durum] || '#888') + ';color:#fff;border-radius:6px;padding:2px 7px;font-size:.68rem;font-weight:700">' + (durumMetin[s.durum] || s.durum) + '</span>' +
          '</div>' +
          '<div class="order-items">' + urunText +
            '<br><small>' + (s.teslimat_turu === 'kurye' ? '🛵 Kurye' : '🚶 Gel-Al') + (s.adres ? ' — ' + s.adres : '') + '</small>' +
          '</div>' +
          '<div class="order-footer">' +
            '<span class="order-price">₺' + (parseFloat(s.genel_toplam) || 0) + '</span>' +
            sonrakiButon +
          '</div></div>';
      }).join('');
    })
    .catch(function() { con.innerHTML = '<div class="hata">Baglanamadi.</div>'; });

  panelUrunleriYukle(esnafId);
  calismaSaatleriYukle(esnafId);
  kampanyalariYukle(esnafId);
  panelIstatistikYukle();
  panelProfilFormYukle(esnafId);
  randevuAyarlariniYukle(esnafId);
  hizmetleriYukle(esnafId);
  randevulariYukle();
  panelIlanlarYukle();
}

function panelIstatistikYukle() {
  var esnafId = durum.panelEsnafId;
  if (!esnafId) return;
  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/istatistik')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) return;
      var v = data.veri;

      // Özet sayılar
      document.getElementById('stat-hafta-sayi').textContent   = v.hafta.sayi;
      document.getElementById('stat-hafta-tutar').textContent  = '₺' + Math.round(v.hafta.tutar);
      document.getElementById('stat-ay-sayi').textContent      = v.ay.sayi;
      document.getElementById('stat-ay-tutar').textContent     = '₺' + Math.round(v.ay.tutar);
      document.getElementById('stat-toplam-sayi').textContent  = v.toplam.sayi;
      document.getElementById('stat-toplam-tutar').textContent = '₺' + Math.round(v.toplam.tutar);
      document.getElementById('panel-goruntuleme').textContent  = v.goruntuleme;

      var enCok = document.getElementById('stat-en-cok');
      enCok.style.display = '';

      // ── En çok satanlar ──────────────────────────────────
      var enCokHtml = '';
      if (v.en_cok_satanlar.length) {
        enCokHtml += '<div style="font-size:.72rem;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">En Çok Satan Ürünler</div>' +
          v.en_cok_satanlar.map(function(u, i) {
            var madalya = ['🥇','🥈','🥉','4.','5.'][i] || '';
            var maxAdet = v.en_cok_satanlar[0].adet || 1;
            var yuzde = Math.round((u.adet / maxAdet) * 100);
            return '<div style="margin-bottom:8px">' +
              '<div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:3px">' +
                '<span>' + madalya + ' ' + u.ad + '</span>' +
                '<span style="font-weight:800;color:#ff6b35">' + u.adet + ' adet</span>' +
              '</div>' +
              '<div style="background:#f0f0f0;border-radius:6px;height:5px">' +
                '<div style="background:#ff6b35;height:5px;border-radius:6px;width:' + yuzde + '%;transition:width .5s"></div>' +
              '</div>' +
            '</div>';
          }).join('');
      }

      // ── Ek istatistikler: ort tutar, tekrar müşteri, teslimat ──
      var kurye = v.teslimat_dagilim['kurye'] || 0;
      var gelal = v.teslimat_dagilim['gel-al'] || 0;
      var topTeslimat = kurye + gelal || 1;
      enCokHtml += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px">' +
        _statMiniKart('💰', 'Ort. Sipariş', '₺' + (v.ay.ort_tutar || 0), '#ff6b35') +
        _statMiniKart('🔄', 'Sadık Müşteri', v.tekrar_musteri + ' kişi', '#2e7d32') +
        _statMiniKart('🛵', 'Kurye', Math.round(kurye/topTeslimat*100) + '%', '#6a1b9a') +
        _statMiniKart('🚶', 'Gel-Al', Math.round(gelal/topTeslimat*100) + '%', '#1565c0') +
      '</div>';

      // ── Son 7 gün mini bar chart ──────────────────────────
      if (v.yedi_gun && v.yedi_gun.length) {
        var maxSayi = Math.max.apply(null, v.yedi_gun.map(function(g) { return g.sayi; })) || 1;
        enCokHtml += '<div style="margin-top:14px">' +
          '<div style="font-size:.72rem;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Son 7 Gün</div>' +
          '<div style="display:flex;align-items:flex-end;gap:4px;height:60px">' +
          v.yedi_gun.map(function(g) {
            var yuzde = Math.max(4, Math.round((g.sayi / maxSayi) * 100));
            var gun = new Date(g.gun).toLocaleDateString('tr-TR', { weekday: 'short' });
            return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">' +
              '<div style="font-size:.6rem;color:#888;font-weight:700">' + (g.sayi || '') + '</div>' +
              '<div style="width:100%;background:' + (g.sayi ? '#ff6b35' : '#f0f0f0') + ';border-radius:4px 4px 0 0;height:' + yuzde + '%;min-height:4px;transition:height .5s"></div>' +
              '<div style="font-size:.6rem;color:#aaa">' + gun + '</div>' +
            '</div>';
          }).join('') +
          '</div></div>';
      }

      // ── Saatlik yoğunluk (sadece aktif saatler) ────────────
      var aktifSaatler = (v.saatlik_dagilim || []).filter(function(s) { return s.sayi > 0; });
      if (aktifSaatler.length) {
        var maxSaatSayi = Math.max.apply(null, aktifSaatler.map(function(s) { return s.sayi; })) || 1;
        var zirve = aktifSaatler.reduce(function(a, b) { return a.sayi >= b.sayi ? a : b; });
        enCokHtml += '<div style="margin-top:14px">' +
          '<div style="font-size:.72rem;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Zirve Saatler <span style="font-weight:400;color:#ff6b35">(en yoğun: ' + zirve.saat + ':00)</span></div>' +
          '<div style="display:flex;align-items:flex-end;gap:2px;height:40px;overflow-x:auto">' +
          (v.saatlik_dagilim || []).filter(function(s) { return s.saat >= 7 && s.saat <= 23; }).map(function(s) {
            var yuzde = Math.max(4, Math.round((s.sayi / maxSaatSayi) * 100));
            return '<div style="flex:1;min-width:10px;display:flex;flex-direction:column;align-items:center;gap:2px">' +
              '<div style="width:100%;background:' + (s.sayi ? '#1565c0' : '#f0f0f0') + ';border-radius:2px 2px 0 0;height:' + yuzde + '%;min-height:2px"></div>' +
              '<div style="font-size:.52rem;color:#bbb">' + s.saat + '</div>' +
            '</div>';
          }).join('') +
          '</div></div>';
      }

      enCok.innerHTML = enCokHtml;
    })
    .catch(function() {});
}

function _statMiniKart(ikon, baslik, deger, renk) {
  return '<div style="background:#f9f9f9;border-radius:10px;padding:10px;border-left:3px solid ' + renk + '">' +
    '<div style="font-size:1rem;margin-bottom:2px">' + ikon + '</div>' +
    '<div style="font-size:.68rem;color:#888;font-weight:600">' + baslik + '</div>' +
    '<div style="font-size:.95rem;font-weight:800;color:#1a1a2e">' + deger + '</div>' +
  '</div>';
}

function panelProfilFormYukle(esnafId) {
  fetch(API_URL + '/api/esnaflar/' + esnafId)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) return;
      var e = data.veri;
      var adEl = document.getElementById('panel-profil-ad');
      var telEl = document.getElementById('panel-profil-telefon');
      var adrEl = document.getElementById('panel-profil-adres');
      var katEl = document.getElementById('panel-profil-kategori');
      var igEl  = document.getElementById('panel-profil-instagram');
      var gmEl  = document.getElementById('panel-profil-gmaps');
      if (adEl)  adEl.value  = e.ad || '';
      if (telEl) telEl.value = e.telefon || '';
      if (adrEl) adrEl.value = e.adres || '';
      if (katEl) katEl.value = e.kategori || 'yemek';
      if (igEl)  igEl.value  = e.instagram_url || '';
      if (gmEl)  gmEl.value  = e.google_maps_url || '';

      // İlan bildirimi toggle
      var ilanToggle  = document.getElementById('ilan-bildirimi-toggle');
      var ilanSlider  = document.getElementById('ilan-bildirimi-slider');
      var ilanKnob    = document.getElementById('ilan-bildirimi-knob');
      var aktif = e.ilan_bildirimi !== false; // varsayılan true
      if (ilanToggle) ilanToggle.checked = aktif;
      if (ilanSlider) ilanSlider.style.background = aktif ? '#ff6b35' : '#ccc';
      if (ilanKnob)   ilanKnob.style.transform = aktif ? 'translateX(20px)' : 'translateX(0)';

      // Onay durumu banneri
      var bannerEl = document.getElementById('panel-onay-banner');
      if (bannerEl) {
        if (!e.onaylandi) {
          bannerEl.style.display = 'block';
          fetch(API_URL + '/api/config').then(function(r){return r.json();}).then(function(cfg){
            var waBtn = document.getElementById('panel-onay-wa-btn');
            if (waBtn && cfg.admin_wa) {
              var msg = encodeURIComponent('Merhaba! Yakinda Ne Var uygulamasindaki ' + e.ad + ' isletmemi onaylar misiniz? Kayit ID: ' + esnafId);
              waBtn.href = cfg.admin_wa + '?text=' + msg;
            }
          }).catch(function(){});
        } else {
          bannerEl.style.display = 'none';
        }
      }
    })
    .catch(function() {});
}

function panelProfilKaydet() {
  var esnafId = durum.panelEsnafId;
  if (!esnafId) { bildirim('Esnaf ID bulunamadı.', 'uyari'); return; }
  var ad       = document.getElementById('panel-profil-ad').value.trim();
  var telefon  = document.getElementById('panel-profil-telefon').value.trim();
  var adres    = document.getElementById('panel-profil-adres').value.trim();
  var kategori = document.getElementById('panel-profil-kategori').value;
  var instagram_url   = document.getElementById('panel-profil-instagram').value.trim();
  var google_maps_url = document.getElementById('panel-profil-gmaps').value.trim();
  if (!ad || !telefon) { bildirim('Ad ve telefon zorunludur.', 'uyari'); return; }
  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/profil', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ad: ad, telefon: telefon, adres: adres, kategori: kategori, instagram_url: instagram_url, google_maps_url: google_maps_url })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      bildirim(data.mesaj || (data.basari ? 'Profil kaydedildi.' : 'Hata oluştu.'), data.basari ? 'basari' : 'hata');
    })
    .catch(function() { bildirim('Bağlanamadı.', 'hata'); });
}

function calismaSaatleriYukle(esnafId) {
  fetch(API_URL + '/api/esnaflar/' + esnafId)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) return;
      var saatler = data.veri.calisma_saatleri || {};
      var con = document.getElementById('panel-saatler-form');
      con.innerHTML = GUNLER.map(function(gun) {
        var s = saatler[gun] || { acilis: '09:00', kapanis: '18:00', kapali: false };
        return '<div class="saat-satir">' +
          '<span class="saat-gun-label">' + GUN_ETIKET[gun] + '</span>' +
          '<input type="time" id="saat-acilis-' + gun + '" value="' + (s.acilis || '09:00') + '" class="saat-input" ' + (s.kapali ? 'disabled' : '') + '>' +
          '<span style="font-size:.75rem;color:#aaa">–</span>' +
          '<input type="time" id="saat-kapanis-' + gun + '" value="' + (s.kapanis || '18:00') + '" class="saat-input" ' + (s.kapali ? 'disabled' : '') + '>' +
          '<label class="saat-kapali-label"><input type="checkbox" id="saat-kapali-' + gun + '" onchange="saatKapaliToggle(\'' + gun + '\')" ' + (s.kapali ? 'checked' : '') + '> Kapali</label>' +
          '</div>';
      }).join('');
    });
}

function saatKapaliToggle(gun) {
  var kapali = document.getElementById('saat-kapali-' + gun).checked;
  document.getElementById('saat-acilis-' + gun).disabled = kapali;
  document.getElementById('saat-kapanis-' + gun).disabled = kapali;
}

function calismaSaatleriKaydet() {
  var esnafId = durum.panelEsnafId;
  if (!esnafId) { bildirim('Önce Esnaf ID girin.', 'uyari'); return; }
  var saatler = {};
  GUNLER.forEach(function(gun) {
    saatler[gun] = {
      acilis:  document.getElementById('saat-acilis-' + gun).value || '09:00',
      kapanis: document.getElementById('saat-kapanis-' + gun).value || '18:00',
      kapali:  document.getElementById('saat-kapali-' + gun).checked
    };
  });
  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/calisma-saatleri', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ calisma_saatleri: saatler })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      bildirim(data.mesaj || (data.basari ? 'Kaydedildi.' : 'Hata.'), data.basari ? 'basari' : 'hata');
    })
    .catch(function() { bildirim('Bağlanamadı.', 'hata'); });
}

// Ürün Yönetimi
function panelUrunleriYukle(esnafId) {
  var con = document.getElementById('panel-urunler');
  con.innerHTML = '<div class="yukleniyor"></div>';
  fetch(API_URL + '/api/esnaflar/' + esnafId)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) { con.innerHTML = '<div class="hata">Yüklenemedi.</div>'; return; }
      var urunler = data.veri.urunler || [];
      if (!urunler.length) { con.innerHTML = '<div style="color:#aaa;font-size:.82rem;padding:6px 0">Henüz ürün eklenmemiş.</div>'; return; }
      con.innerHTML = urunler.map(function(u) {
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0">' +
          '<div style="flex:1">' +
            '<div style="font-size:.84rem;font-weight:700">' + u.ad + '</div>' +
            (u.aciklama ? '<div style="font-size:.72rem;color:#888">' + u.aciklama + '</div>' : '') +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            '<span style="font-weight:800;color:#ff6b35;font-size:.88rem">₺' + parseFloat(u.fiyat || 0).toFixed(2) + '</span>' +
            '<button onclick="urunSil(' + esnafId + ',' + u.id + ')" style="background:#ffebee;color:#c62828;border:none;border-radius:6px;padding:4px 8px;font-size:.72rem;cursor:pointer">Sil</button>' +
          '</div>' +
        '</div>';
      }).join('');
    });
}

function urunFormAc() {
  document.getElementById('urun-ekle-form').style.display = '';
  document.getElementById('urun-ekle-btn').style.display = 'none';
  document.getElementById('urun-ad').focus();
}

function urunFormKapat() {
  document.getElementById('urun-ekle-form').style.display = 'none';
  document.getElementById('urun-ekle-btn').style.display = '';
  document.getElementById('urun-ad').value = '';
  document.getElementById('urun-fiyat').value = '';
  document.getElementById('urun-aciklama').value = '';
}

function urunEkle() {
  var esnafId = durum.panelEsnafId;
  if (!esnafId) return;
  var ad = document.getElementById('urun-ad').value.trim();
  var fiyat = document.getElementById('urun-fiyat').value;
  var aciklama = document.getElementById('urun-aciklama').value.trim();
  if (!ad) { bildirim('Ürün adı zorunlu.', 'uyari'); return; }
  fetch(API_URL + '/api/esnaflar/' + esnafId + '/urunler', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ad: ad, fiyat: fiyat, aciklama: aciklama })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) { bildirim(data.mesaj, 'hata'); return; }
      bildirim('Ürün eklendi!', 'basari');
      urunFormKapat();
      panelUrunleriYukle(esnafId);
    })
    .catch(function() { bildirim('Bağlanamadı.', 'hata'); });
}

function urunSil(esnafId, urunId) {
  if (!confirm('Ürün silinecek. Emin misiniz?')) return;
  fetch(API_URL + '/api/esnaflar/' + esnafId + '/urunler/' + urunId, { method: 'DELETE' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.basari) { bildirim('Ürün silindi.', 'basari'); panelUrunleriYukle(esnafId); }
      else bildirim(data.mesaj, 'hata');
    });
}

function kampanyalariYukle(esnafId) {
  fetch(API_URL + '/api/esnaflar/' + esnafId)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) return;
      var liste = data.veri.kampanyalar || [];
      var con = document.getElementById('panel-kampanyalar-liste');
      if (!liste.length) { con.innerHTML = '<div style="color:#aaa;font-size:.82rem;padding:6px 0">Aktif kampanya yok.</div>'; return; }
      con.innerHTML = liste.map(function(k) {
        var bitis = k.bitis_tarihi ? new Date(k.bitis_tarihi).toLocaleDateString('tr-TR') : '—';
        return '<div class="kampanya-satir">' +
          '<div class="kampanya-satir-bilgi">' +
            '<b>' + k.baslik + '</b>' +
            (k.indirim_orani ? ' <span class="kampanya-rozet">%' + k.indirim_orani + '</span>' : '') +
            '<div style="font-size:.72rem;color:#888">' + (k.aciklama || '') + ' · Son: ' + bitis + '</div>' +
          '</div>' +
          '<button class="kampanya-sil-btn" onclick="kampanyaSil(' + esnafId + ',' + k.id + ')">🗑</button>' +
        '</div>';
      }).join('');
    });
}

function kampanyaEkle() {
  var esnafId = durum.panelEsnafId;
  if (!esnafId) { bildirim('Önce Esnaf ID yükleyin.', 'uyari'); return; }
  var baslik = document.getElementById('kamp-baslik').value.trim();
  var aciklama = document.getElementById('kamp-aciklama').value.trim();
  var oran = document.getElementById('kamp-oran').value;
  var bitis = document.getElementById('kamp-bitis').value;
  if (!baslik) { bildirim('Başlık zorunlu.', 'uyari'); return; }
  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/kampanya', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baslik: baslik, aciklama: aciklama, indirim_orani: oran, bitis_tarihi: bitis || null })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) { bildirim(data.mesaj, 'hata'); return; }
      document.getElementById('kamp-baslik').value = '';
      document.getElementById('kamp-aciklama').value = '';
      document.getElementById('kamp-oran').value = '';
      document.getElementById('kamp-bitis').value = '';
      kampanyalariYukle(esnafId);
    })
    .catch(function() { bildirim('Bağlanamadı.', 'hata'); });
}

function kampanyaSil(esnafId, kampanyaId) {
  if (!confirm('Kampanya silinecek. Emin misiniz?')) return;
  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/kampanya/' + kampanyaId, { method: 'DELETE' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.basari) kampanyalariYukle(esnafId);
      else bildirim(data.mesaj, 'hata');
    });
}

function siparisKabul(id) {
  panelSiparisDurum(id, 'tamamlandi');
}

function panelSiparisDurum(id, yeniDurum) {
  fetch(API_URL + '/api/siparisler/' + id + '/durum', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ durum: yeniDurum })
  })
    .then(function(r) { return r.json(); })
    .then(function() { panelYukle(); });
}

// =============================================================
// RANDEVU SİSTEMİ — ESNAF PANELİ
// =============================================================

// Global indirimli saatler state
var _indirimliSaatler = {};

function _indirimSaatleriniGoster() {
  var liste = document.getElementById('indirimli-saatler-liste');
  if (!liste) return;
  var anahtarlar = Object.keys(_indirimliSaatler).sort(function(a, b) { return parseInt(a) - parseInt(b); });
  if (!anahtarlar.length) {
    liste.innerHTML = '<span style="font-size:.7rem;color:#aaa">Henüz indirim saati eklenmedi</span>';
    return;
  }
  liste.innerHTML = anahtarlar.map(function(s) {
    return '<div style="display:flex;align-items:center;gap:4px;background:#fff;border:1px solid #ffd5c2;border-radius:6px;padding:3px 8px">' +
      '<span style="font-size:.75rem;font-weight:700">' + s + ':00</span>' +
      '<span style="font-size:.72rem;color:#ff6b35;font-weight:800">%' + _indirimliSaatler[s] + '</span>' +
      '<button onclick="indirimSaatSil(\'' + s + '\')" style="background:none;border:none;color:#ccc;cursor:pointer;font-size:.8rem;padding:0 2px;line-height:1">✕</button>' +
    '</div>';
  }).join('');
}

function indirimSaatEkle() {
  var saat = document.getElementById('indirim-saat').value;
  var oran = parseInt(document.getElementById('indirim-oran').value);
  if (!saat) { bildirim('Saat seçin.', 'uyari'); return; }
  if (!oran || oran < 5 || oran > 50) { bildirim('İndirim %5 ile %50 arasında olmalı.', 'uyari'); return; }
  _indirimliSaatler[saat] = oran;
  document.getElementById('indirim-oran').value = '';
  document.getElementById('indirim-saat').value = '';
  _indirimSaatleriniGoster();
}

function indirimSaatSil(saat) {
  delete _indirimliSaatler[saat];
  _indirimSaatleriniGoster();
}

function panelIlanlarYukle() {
  var esnafId = durum.panelEsnafId;
  if (!esnafId) return;
  var con = document.getElementById('panel-ilanlar-liste');
  if (!con) return;
  // Esnaf kategorisini al — aynı kategorideki ilanları göster
  fetch(API_URL + '/api/esnaflar/' + esnafId)
    .then(function(r) { return r.json(); })
    .then(function(esnafData) {
      var kategori = esnafData.basari && esnafData.veri ? esnafData.veri.kategori : '';
      var url = API_URL + '/api/is-ilanlari' + (kategori ? '?kategori=' + encodeURIComponent(kategori) : '');
      return fetch(url).then(function(r) { return r.json(); });
    })
    .then(function(data) {
      var ilanlar = data.basari ? data.veri : [];
      if (!ilanlar.length) { con.innerHTML = '<div style="color:#aaa;font-size:.82rem;text-align:center;padding:10px">Kategorinizde açık ilan yok.</div>'; return; }
      con.innerHTML = ilanlar.map(function(ilan) {
        var fotoHTML = ilan.fotograf_url
          ? '<div style="margin:6px 0;border-radius:8px;overflow:hidden;height:90px"><img src="' + ilan.fotograf_url + '" style="width:100%;height:100%;object-fit:cover"></div>'
          : '';
        return '<div style="border:1px solid #f0f0f0;border-radius:12px;padding:10px;margin-bottom:8px;background:#fff">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">' +
            '<div style="font-weight:700;font-size:.82rem;flex:1;padding-right:8px">' + ilan.baslik + '</div>' +
            '<span style="font-size:.66rem;color:#888;white-space:nowrap;background:#f5f5f5;padding:2px 6px;border-radius:6px">👥 ' + ilan.teklif_sayisi + '</span>' +
          '</div>' +
          fotoHTML +
          (ilan.aciklama ? '<div style="font-size:.72rem;color:#666;margin-bottom:4px">' + ilan.aciklama.slice(0,80) + (ilan.aciklama.length > 80 ? '...' : '') + '</div>' : '') +
          (ilan.butce_min ? '<div style="font-size:.72rem;color:#2e7d32;font-weight:700;margin-bottom:6px">₺' + ilan.butce_min + (ilan.butce_max ? '–₺' + ilan.butce_max : '+') + '</div>' : '') +
          '<button onclick="panelTeklifModal(' + ilan.id + ',\'' + (ilan.baslik||'').replace(/'/g, '') + '\')" style="width:100%;background:#ff6b35;color:#fff;border:none;border-radius:8px;padding:9px;font-size:.76rem;font-weight:700;cursor:pointer">🙋 İlgileniyorum</button>' +
        '</div>';
      }).join('');
    }).catch(function() { con.innerHTML = '<div class="hata">Yüklenemedi.</div>'; });
}

function panelTeklifModal(ilanId, ilanBaslik) {
  var html = '<div style="padding:4px">' +
    '<h3 style="font-size:.9rem;margin:0 0 4px">🙋 İlgileniyorum</h3>' +
    '<div style="font-size:.78rem;color:#888;margin-bottom:14px;line-height:1.5">' + ilanBaslik + '</div>' +
    '<textarea id="teklif-aciklama" class="form-input" placeholder="Müşteriye mesajınız — kendinizi tanıtın, ne sunabileceğinizi yazın..." rows="4" style="resize:none;margin-bottom:8px"></textarea>' +
    '<div style="display:flex;gap:8px;margin-bottom:14px">' +
      '<div style="flex:1">' +
        '<div style="font-size:.72rem;color:#888;margin-bottom:4px">Fiyat teklifi (opsiyonel)</div>' +
        '<input id="teklif-fiyat" type="number" class="form-input" placeholder="₺" min="0" style="margin:0">' +
      '</div>' +
    '</div>' +
    '<div style="background:#fff8f5;border-radius:10px;padding:10px;margin-bottom:14px;font-size:.72rem;color:#888">📲 Müşteri bildirim alacak ve sizinle iletişime geçebilecek.</div>' +
    '<button onclick="panelTeklifGonder(' + ilanId + ')" style="width:100%;background:#ff6b35;color:#fff;border:none;border-radius:12px;padding:13px;font-size:.88rem;font-weight:700;cursor:pointer">Yanıt Gönder</button>' +
  '</div>';
  adminModalAc(html);
}

function panelTeklifGonder(ilanId) {
  var esnafId = durum.panelEsnafId;
  if (!esnafId) return;
  var aciklama = document.getElementById('teklif-aciklama').value.trim();
  if (!aciklama) { bildirim('Müşteriye bir mesaj yazın.', 'uyari'); return; }
  var fiyat = document.getElementById('teklif-fiyat').value;
  fetch(API_URL + '/api/is-ilani/' + ilanId + '/teklif', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      esnaf_id: esnafId,
      fiyat: fiyat ? parseFloat(fiyat) : null,
      aciklama: aciklama
    })
  }).then(function(r) { return r.json(); })
  .then(function(data) {
    bildirim(data.mesaj || (data.basari ? 'Yanıt gönderildi!' : 'Hata.'), data.basari ? 'basari' : 'hata');
    if (data.basari) { adminModalKapat(); panelIlanlarYukle(); }
  });
}

function randevuAyarlariniYukle(esnafId) {
  // Saat seçeneklerini doldur (7-23)
  var saatSel = document.getElementById('indirim-saat');
  if (saatSel && saatSel.options.length <= 1) {
    for (var s = 7; s <= 22; s++) {
      var opt = document.createElement('option');
      opt.value = String(s);
      opt.textContent = (s < 10 ? '0' : '') + s + ':00';
      saatSel.appendChild(opt);
    }
  }

  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/randevu-ayar')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) return;
      var v = data.veri;
      var toggle = document.getElementById('randevu-modu-toggle');
      var slider = document.getElementById('randevu-toggle-slider');
      var knob = document.getElementById('randevu-toggle-knob');
      if (toggle) {
        toggle.checked = !!v.randevu_modu;
        slider.style.background = v.randevu_modu ? '#ff6b35' : '#ccc';
        knob.style.transform = v.randevu_modu ? 'translateX(20px)' : 'translateX(0)';
      }
      var slotEl = document.getElementById('randevu-slot-suresi');
      if (slotEl) slotEl.value = v.slot_suresi || 30;
      _indirimliSaatler = v.indirimli_saatler || {};
      _indirimSaatleriniGoster();
    });
}

function ilanBildirimiToggle() {
  var esnafId = durum.panelEsnafId;
  if (!esnafId) return;
  var toggle = document.getElementById('ilan-bildirimi-toggle');
  var slider = document.getElementById('ilan-bildirimi-slider');
  var knob   = document.getElementById('ilan-bildirimi-knob');
  var aktif  = toggle.checked;
  slider.style.background = aktif ? '#ff6b35' : '#ccc';
  knob.style.transform    = aktif ? 'translateX(20px)' : 'translateX(0)';
  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/ilan-bildirimi', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aktif: aktif })
  }).then(function(r) { return r.json(); })
  .then(function(data) { bildirim(data.mesaj, data.basari ? 'basari' : 'hata'); })
  .catch(function() { bildirim('Bağlantı hatası.', 'hata'); });
}

function randevuModuToggle() {
  var toggle = document.getElementById('randevu-modu-toggle');
  var slider = document.getElementById('randevu-toggle-slider');
  var knob = document.getElementById('randevu-toggle-knob');
  slider.style.background = toggle.checked ? '#ff6b35' : '#ccc';
  knob.style.transform = toggle.checked ? 'translateX(20px)' : 'translateX(0)';
}

function randevuAyarKaydet() {
  var esnafId = durum.panelEsnafId;
  if (!esnafId) return;
  var modu = document.getElementById('randevu-modu-toggle').checked;
  var sure = parseInt(document.getElementById('randevu-slot-suresi').value) || 30;
  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/randevu-ayar', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ randevu_modu: modu, slot_suresi: sure, indirimli_saatler: _indirimliSaatler })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) { bildirim(data.mesaj || (data.basari ? 'Kaydedildi.' : 'Hata.'), data.basari ? 'basari' : 'hata'); });
}

function hizmetleriYukle(esnafId) {
  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/hizmetler')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) return;
      var con = document.getElementById('panel-hizmetler-liste');
      if (!data.veri.length) { con.innerHTML = '<div style="color:#aaa;font-size:.82rem;padding:4px 0">Henüz hizmet eklenmedi.</div>'; return; }
      con.innerHTML = data.veri.map(function(h) {
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #f0f0f0">' +
          '<div>' +
            '<span style="font-size:.84rem;font-weight:700">' + h.ad + '</span>' +
            '<span style="font-size:.75rem;color:#888;margin-left:6px">' + h.sure + ' dk · ₺' + h.fiyat + '</span>' +
          '</div>' +
          '<button onclick="hizmetSil(' + esnafId + ',' + h.id + ')" style="background:none;border:none;color:#ff4444;cursor:pointer;font-size:1rem">🗑</button>' +
        '</div>';
      }).join('');
    });
}

function hizmetEkle() {
  var esnafId = durum.panelEsnafId;
  if (!esnafId) return;
  var ad = document.getElementById('hiz-ad').value.trim();
  if (!ad) { bildirim('Hizmet adı zorunlu.', 'uyari'); return; }
  var sure = parseInt(document.getElementById('hiz-sure').value) || 30;
  var fiyat = parseFloat(document.getElementById('hiz-fiyat').value) || 0;
  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/hizmet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ad: ad, sure: sure, fiyat: fiyat })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) { bildirim(data.mesaj, 'hata'); return; }
      document.getElementById('hiz-ad').value = '';
      document.getElementById('hiz-sure').value = '30';
      document.getElementById('hiz-fiyat').value = '';
      hizmetleriYukle(esnafId);
    });
}

function hizmetSil(esnafId, hizmetId) {
  if (!confirm('Hizmet silinecek. Emin misiniz?')) return;
  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/hizmet/' + hizmetId, { method: 'DELETE' })
    .then(function(r) { return r.json(); })
    .then(function(data) { if (data.basari) hizmetleriYukle(esnafId); else bildirim(data.mesaj, 'hata'); });
}

function randevulariYukle() {
  var esnafId = durum.panelEsnafId;
  if (!esnafId) return;
  var tarih = document.getElementById('randevu-tarih-filtre') ? document.getElementById('randevu-tarih-filtre').value : '';
  var url = API_URL + '/api/esnaf-panel/' + esnafId + '/randevular' + (tarih ? '?tarih=' + tarih : '');
  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var con = document.getElementById('panel-randevular-liste');
      if (!data.basari || !data.veri.length) { con.innerHTML = '<div style="color:#aaa;font-size:.82rem">Randevu yok.</div>'; return; }
      var durumRenk = { bekliyor: '#ff6b35', onaylandi: '#2e7d32', tamamlandi: '#888', iptal: '#c62828' };
      var durumMetin = { bekliyor: 'Bekliyor', onaylandi: 'Onaylandı', tamamlandi: 'Tamamlandı', iptal: 'İptal' };
      con.innerHTML = data.veri.map(function(r) {
        var tarihStr = new Date(r.tarih).toLocaleDateString('tr-TR', { day:'numeric', month:'short' });
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0">' +
          '<div>' +
            '<div style="font-size:.84rem;font-weight:700">' + r.musteri_ad + '</div>' +
            '<div style="font-size:.72rem;color:#888">' + tarihStr + ' · ' + (r.saat||'').slice(0,5) + ' · ' + (r.hizmet_adi||'Genel') + '</div>' +
            '<div style="font-size:.7rem;color:#aaa">' + r.musteri_telefon + '</div>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">' +
            '<span style="font-size:.7rem;font-weight:700;color:' + (durumRenk[r.durum]||'#888') + '">' + (durumMetin[r.durum]||r.durum) + '</span>' +
            (r.durum === 'bekliyor' ? '<button onclick="panelRandevuOnayla(' + r.id + ')" style="font-size:.65rem;padding:3px 7px;background:#e8f5e9;color:#2e7d32;border:none;border-radius:6px;cursor:pointer">Onayla</button>' : '') +
            (r.durum !== 'iptal' && r.durum !== 'tamamlandi' ? '<button onclick="panelRandevuIptal(' + r.id + ')" style="font-size:.65rem;padding:3px 7px;background:#ffebee;color:#c62828;border:none;border-radius:6px;cursor:pointer">İptal</button>' : '') +
          '</div>' +
        '</div>';
      }).join('');
    });
}

function panelRandevuOnayla(randevuId) {
  var esnafId = durum.panelEsnafId;
  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/randevu/' + randevuId + '/durum', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ durum: 'onaylandi' })
  }).then(function() { randevulariYukle(); });
}

function panelRandevuIptal(randevuId) {
  if (!confirm('Randevu iptal edilecek. Emin misiniz?')) return;
  var esnafId = durum.panelEsnafId;
  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/randevu/' + randevuId + '/durum', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ durum: 'iptal' })
  }).then(function() { randevulariYukle(); });
}

// =============================================================
// KURYE PANELİ
// =============================================================

// Kurye konum paylaşımı — 30 sn aralıkla konum gönderir
var _kuryeKonumInterval = null;
function kuryeKonumPaylasimiBaslat(telefon) {
  if (_kuryeKonumInterval) return; // zaten çalışıyor
  function konumGonder() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(function(pos) {
      fetch(API_URL + '/api/kurye-konum', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefon: telefon, lat: pos.coords.latitude, lng: pos.coords.longitude })
      }).catch(function() {});
    }, function() {}, { enableHighAccuracy: true, maximumAge: 20000 });
  }
  konumGonder(); // hemen bir kez
  _kuryeKonumInterval = setInterval(konumGonder, 30000);
}

function kuryeAktifSiparisleriYukle() {
  var oturum = oturumYukle();
  if (!oturum || oturum.tip !== 'kurye') return;
  var con = document.getElementById('kurye-aktif-liste');
  fetch(API_URL + '/api/kurye-siparislerim?telefon=' + encodeURIComponent(oturum.telefon))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari || !data.veri.length) {
        con.innerHTML = '<div style="color:#aaa;font-size:.82rem">Aktif sipariş yok.</div>';
        return;
      }
      var durumMetin = { bekliyor: 'Bekliyor', hazirlaniyor: 'Hazırlanıyor', kurye_atandi: 'Atandı', yolda: 'Yolda', teslim_edildi: 'Teslim Edildi', iptal: 'İptal' };
      var durumRenk  = { bekliyor: '#e65100', hazirlaniyor: '#1565c0', kurye_atandi: '#6a1b9a', yolda: '#0277bd', teslim_edildi: '#2e7d32', iptal: '#c62828' };
      con.innerHTML = data.veri.map(function(s) {
        var urunler = Array.isArray(s.urunler) ? s.urunler.map(function(u) { return u.ad + ' x' + u.adet; }).join(', ') : '';
        return '<div style="border:1.5px solid #f0f0f0;border-radius:10px;padding:10px;margin-bottom:8px">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">' +
            '<div>' +
              '<div style="font-weight:700;font-size:.84rem">' + (s.esnaf_adi || '') + '</div>' +
              '<div style="font-size:.72rem;color:#888">' + (s.esnaf_adres || '') + '</div>' +
              '<div style="font-size:.72rem;color:#888;margin-top:2px">Müşteri: ' + (s.musteri_telefon || '') + '</div>' +
              '<div style="font-size:.72rem;color:#666;margin-top:2px">' + urunler + '</div>' +
            '</div>' +
            '<span style="font-size:.7rem;font-weight:700;color:' + (durumRenk[s.durum] || '#888') + ';white-space:nowrap;margin-left:6px">' + (durumMetin[s.durum] || s.durum) + '</span>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center">' +
            '<span style="font-weight:800;font-size:.9rem;color:#ff6b35">₺' + parseFloat(s.genel_toplam || 0).toFixed(2) + '</span>' +
            (s.durum !== 'teslim_edildi' && s.durum !== 'iptal'
              ? '<button onclick="kuryeTeslimEt(' + s.id + ')" style="background:#e8f5e9;color:#2e7d32;border:none;border-radius:8px;padding:6px 12px;font-size:.75rem;font-weight:700;cursor:pointer">Teslim Ettim</button>'
              : '') +
          '</div>' +
        '</div>';
      }).join('');
    });
}

function kuryeBekleyenleriYukle() {
  var oturum = oturumYukle();
  if (!oturum || oturum.tip !== 'kurye') return;
  var ilce = oturum.ilce || '';
  var con = document.getElementById('kurye-bekleyen-liste');
  fetch(API_URL + '/api/kurye-bekleyen?ilce=' + encodeURIComponent(ilce))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari || !data.veri.length) {
        con.innerHTML = '<div style="color:#aaa;font-size:.82rem">Bölgenizde bekleyen sipariş yok.</div>';
        return;
      }
      con.innerHTML = data.veri.map(function(s) {
        var urunler = Array.isArray(s.urunler) ? s.urunler.map(function(u) { return u.ad + ' x' + u.adet; }).join(', ') : '';
        return '<div style="border:1.5px solid #ffe0b2;border-radius:10px;padding:10px;margin-bottom:8px;background:#fffde7">' +
          '<div style="font-weight:700;font-size:.84rem;margin-bottom:4px">' + (s.esnaf_adi || '') + ' · ' + (s.esnaf_ilce || '') + '</div>' +
          '<div style="font-size:.72rem;color:#888;margin-bottom:4px">' + urunler + '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center">' +
            '<span style="font-weight:800;font-size:.9rem;color:#ff6b35">₺' + parseFloat(s.genel_toplam || 0).toFixed(2) + '</span>' +
            '<button onclick="kuryeSiparisKabul(' + s.id + ')" style="background:#ff6b35;color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:.75rem;font-weight:700;cursor:pointer">Kabul Et</button>' +
          '</div>' +
        '</div>';
      }).join('');
    });
}

function kuryeSiparisKabul(siparisId) {
  var oturum = oturumYukle();
  if (!oturum) return;
  fetch(API_URL + '/api/kurye-kabul', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kurye_telefon: oturum.telefon, siparis_id: siparisId })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.basari) {
        kuryeBekleyenleriYukle();
        kuryeAktifSiparisleriYukle();
      } else {
        bildirim(data.mesaj || 'Sipariş alınamadı.', 'hata');
      }
    });
}

function kuryeTeslimEt(siparisId) {
  if (!confirm('Siparişi teslim ettiğinizi onaylıyor musunuz?')) return;
  fetch(API_URL + '/api/siparisler/' + siparisId + '/durum', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ durum: 'teslim_edildi' })
  })
    .then(function(r) { return r.json(); })
    .then(function() { kuryeAktifSiparisleriYukle(); });
}

// =============================================================
// BAŞLATMA
// =============================================================

// Touchstart/click hybrid — 300ms iOS gecikmeyi kaldır
function hizliTikla(el, fn) {
  var dokunuldu = false;
  el.addEventListener('touchstart', function(e) {
    dokunuldu = true;
    fn(e);
    e.preventDefault();
  }, { passive: false });
  el.addEventListener('click', function(e) {
    if (dokunuldu) { dokunuldu = false; return; }
    fn(e);
  });
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') lightboxKapat();
});

// ─── BİLDİRİM SİSTEMİ ──────────────────────────────────────────────────────

var _bildirimInterval = null;

function bildirimSayisiGuncelle() {
  var oturum = oturumAl();
  if (!oturum || !oturum.telefon) return;
  fetch(API_URL + '/api/bildirimler?telefon=' + encodeURIComponent(oturum.telefon))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var badge = document.getElementById('bildirim-badge');
      if (!badge) return;
      var sayi = data.okunmamis || 0;
      if (sayi > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = sayi > 9 ? '9+' : sayi;
      } else {
        badge.style.display = 'none';
      }
    })
    .catch(function() {});
}

function bildirimKartHTML(b) {
  var renkler = { ilan: '#ff6b35', teklif: '#4caf50', siparis: '#2196f3', bilgi: '#888' };
  var renk = renkler[b.tip] || renkler.bilgi;
  var tarih = new Date(b.olusturma);
  var simdi = new Date();
  var fark = Math.floor((simdi - tarih) / 60000);
  var zamanStr = fark < 1 ? 'Az önce' : fark < 60 ? fark + ' dk önce' : fark < 1440 ? Math.floor(fark/60) + ' sa önce' : Math.floor(fark/1440) + ' gün önce';
  var navonclick = '';
  if (b.link_tip === 'ilan' && b.link_id) {
    navonclick = 'bildirimCekmeciKapat();sayfaGoster(\'siparislerim\');siparislerSekmeSec(\'ilanlar\');';
  } else if (b.link_tip === 'siparis') {
    navonce = 'bildirimCekmeciKapat();sayfaGoster(\'siparislerim\');siparislerimYukle();';
  }
  return '<div onclick="' + navonclick + '" style="background:#fafafa;border-left:3px solid ' + renk + ';border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:' + (navonclick ? 'pointer' : 'default') + '">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
    '<div style="font-weight:700;font-size:.82rem;color:#222">' + (b.baslik || '') + '</div>' +
    '<div style="font-size:.68rem;color:#aaa;white-space:nowrap;flex-shrink:0">' + zamanStr + '</div>' +
    '</div>' +
    (b.mesaj ? '<div style="font-size:.78rem;color:#555;margin-top:3px">' + b.mesaj + '</div>' : '') +
    '</div>';
}

function bildirimCekmeciAc() {
  var oturum = oturumAl();
  var cekmece = document.getElementById('bildirim-cekmece');
  var liste = document.getElementById('bildirim-liste');
  cekmece.style.display = 'block';
  if (!oturum || !oturum.telefon) {
    liste.innerHTML = '<div style="text-align:center;padding:32px 16px;color:#bbb"><div style="font-size:2rem;margin-bottom:8px">🔔</div><div style="font-size:.85rem">Bildirimler için giriş yapmalısınız.</div></div>';
    return;
  }
  liste.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa;font-size:.85rem">Yükleniyor...</div>';

  fetch(API_URL + '/api/bildirimler?telefon=' + encodeURIComponent(oturum.telefon))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var bildirimler = data.veri || [];
      if (bildirimler.length === 0) {
        liste.innerHTML = '<div style="text-align:center;padding:32px 16px;color:#bbb"><div style="font-size:2rem;margin-bottom:8px">🔔</div><div style="font-size:.85rem">Henüz bildirim yok</div></div>';
      } else {
        liste.innerHTML = bildirimler.map(bildirimKartHTML).join('');
      }
      // Hepsini okundu işaretle
      fetch(API_URL + '/api/bildirimler/oku', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefon: oturum.telefon })
      }).then(function() { bildirimSayisiGuncelle(); }).catch(function() {});
    })
    .catch(function() {
      liste.innerHTML = '<div style="text-align:center;padding:20px;color:#e53935;font-size:.85rem">Bildirimler yüklenemedi.</div>';
    });
}

function bildirimCekmeciKapat() {
  var cekmece = document.getElementById('bildirim-cekmece');
  if (cekmece) cekmece.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function() {
  if (window.L) L.Icon.Default.imagePath = 'images/';

  // Oturum restore
  var _oturum = oturumAl();
  if (_oturum) {
    durum.panelEsnafId = _oturum.esnaf_id || null;
    durum.oturumTip    = _oturum.tip;
  }

  // Alt navigasyonlar (oturuma göre)
  oturumaGoreNavGuncelle('ana');

  // Filtre UI
  kategorilerOlustur();
  siralamaOlustur();
  mesafeButonlariniOlustur();

  // Haritalar
  anaHaritaBaslat();

  // Arama
  aramaBaslat();
  gorselAramaBaslat();

  // Konum al → esnafları yükle
  konumAl();

  // Öne çıkan esnafları yükle
  oneCikanlariYukle();

  // Buton event'leri
  document.getElementById('sepet-btn').addEventListener('click', siparisVer);
  document.getElementById('yorum-gonder-btn').addEventListener('click', yorumGonder);
  document.getElementById('back-btn').addEventListener('click', function() { sayfaGoster('ana'); });
  document.getElementById('admin-geri').addEventListener('click', function() { sayfaGoster('ana'); });
  document.getElementById('admin-modal-kapat').addEventListener('click', adminModalKapat);
  document.getElementById('admin-modal').addEventListener('click', function(e) {
    if (e.target === this) adminModalKapat();
  });
  document.getElementById('admin-cikis').addEventListener('click', function() {
    adminAktifSekme = 'ozet';
    cikisYap();
  });
  document.querySelectorAll('.admin-sekme').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var oturum = oturumAl();
      var key = oturum && oturum.sifre;
      if (!key) return;
      adminAktifSekme = btn.dataset.sekme;
      adminSekmeGuncelle(adminAktifSekme);
      adminVerileriYukle(key, adminAktifSekme);
    });
  });
  document.getElementById('urun-ekle-btn').addEventListener('click', urunFormAc);
  document.getElementById('siparislerim-geri').addEventListener('click', function() { sayfaGoster('ana'); });
  document.getElementById('kayit-geri').addEventListener('click', function() { sayfaGoster('kayit-secim'); });
  document.getElementById('kurye-kayit-gonder').addEventListener('click', kuryeKayitGonder);
  var musKayitBtn = document.getElementById('musteri-kayit-gonder');
  if (musKayitBtn) musKayitBtn.addEventListener('click', musteriKayitGonder);
  var secimGirisBtn = document.getElementById('kayit-secim-giris-btn');
  if (secimGirisBtn) secimGirisBtn.addEventListener('click', function() {
    var tel  = document.getElementById('kayit-secim-telefon').value.trim();
    var sif  = document.getElementById('kayit-secim-sifre').value.trim();
    if (!tel || !sif) { bildirim('Telefon ve şifre zorunlu.', 'uyari'); return; }
    girisYap(tel, sif, secimGirisBtn, function(k) {
      if (k.tip === 'admin') { adminGoster(); } else { sayfaGoster('ana'); }
    });
  });

  document.getElementById('btn-kurye').addEventListener('click', function() {
    durum.teslimat = 'kurye';
    document.getElementById('btn-kurye').classList.add('secili');
    document.getElementById('btn-gelal').classList.remove('secili');
  });
  document.getElementById('btn-gelal').addEventListener('click', function() {
    durum.teslimat = 'gel-al';
    document.getElementById('btn-gelal').classList.add('secili');
    document.getElementById('btn-kurye').classList.remove('secili');
  });
  document.getElementById('btn-randevu').addEventListener('click', function() {
    var tabs = document.querySelectorAll('.detay-tab');
    var randevuIdx = tabs.length - 1; // Randevu her zaman son tab
    if (tabs[randevuIdx]) tabSec(tabs[randevuIdx], randevuIdx);
    document.getElementById('tab-randevu').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.getElementById('btn-soru-sor').addEventListener('click', function() {
    soruModalAc();
  });

  // Profil formu
  profilFormuBaslat();

  // Kayıt formu
  kayitFormuBaslat();

  // Adres modal kapat
  var adresModalKapatBtn = document.getElementById('adres-modal-kapat');
  if (adresModalKapatBtn) adresModalKapatBtn.addEventListener('click', function() {
    document.getElementById('adres-modal').style.display = 'none';
  });
  var adresModal = document.getElementById('adres-modal');
  if (adresModal) adresModal.addEventListener('click', function(e) {
    if (e.target === this) this.style.display = 'none';
  });

  // Admin gizli erişim: konum div'e 5 kez tıkla
  var tikSayisi = 0;
  document.getElementById('konum-div').addEventListener('click', function() {
    if (++tikSayisi >= 5) { tikSayisi = 0; adminGoster(); }
  });

  // Bildirim polling — her 30 saniyede badge güncelle
  bildirimSayisiGuncelle();
  _bildirimInterval = setInterval(bildirimSayisiGuncelle, 30000);
});
