// =============================================================
// Yakinda Ne Var - Frontend App
// =============================================================

var API_URL = 'https://yakinda-ne-var-backend-production.up.railway.app';

var durum = {
  lat: null,
  lng: null,
  kategori: null,
  siralama: 'mesafe',
  arama: '',
  mesafeFiltre: 2,
  panelEsnafId: null,
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

function profilSayfasiGoster() {
  var profil = profilYukle();
  sayfaGoster('profil');
  document.getElementById('profil-isim').value    = profil ? profil.isim    : '';
  document.getElementById('profil-telefon').value = profil ? profil.telefon : '';
  document.getElementById('profil-adres1').value  = profil ? (profil.adres1 || '') : '';
  document.getElementById('profil-lat').value     = profil ? (profil.lat || '') : '';
  document.getElementById('profil-lng').value     = profil ? (profil.lng || '') : '';
  if (profil && profil.lat && profil.lng) {
    document.getElementById('profil-harita-wrap').style.display = 'block';
    setTimeout(function() {
      if (!durum.profilHarita) {
        durum.profilHarita = L.map('profil-harita', { zoomControl: false, attributionControl: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(durum.profilHarita);
      }
      durum.profilHarita.setView([profil.lat, profil.lng], 16);
      durum.profilHarita.invalidateSize();
      if (durum.profilHaritaMarker) durum.profilHaritaMarker.remove();
      durum.profilHaritaMarker = L.marker([profil.lat, profil.lng]).addTo(durum.profilHarita).bindPopup('Konumunuz').openPopup();
      reverseGeocode(profil.lat, profil.lng, function(adres) {
        document.getElementById('profil-konum-bilgi').textContent = '📍 ' + adres;
      });
    }, 150);
  } else {
    document.getElementById('profil-harita-wrap').style.display = 'none';
  }
  document.getElementById('profil-hosgeldin').textContent =
    profil ? 'Merhaba, ' + profil.isim + '!' : 'Hosgeldiniz!';
}

function profilFormuBaslat() {
  document.getElementById('profil-kaydet').addEventListener('click', function() {
    var isim    = document.getElementById('profil-isim').value.trim();
    var telefon = document.getElementById('profil-telefon').value.trim();
    var adres1  = document.getElementById('profil-adres1').value.trim();
    if (!isim || !telefon) { alert('Lutfen isim ve telefon girin.'); return; }
    var mevcutProfil = profilYukle() || {};
    profilKaydet({ isim: isim, telefon: telefon, adres1: adres1, lat: mevcutProfil.lat || null, lng: mevcutProfil.lng || null });
    document.getElementById('profil-hosgeldin').textContent = 'Merhaba, ' + isim + '!';
    alert('Profil kaydedildi!');
    sayfaGoster('ana');
  });

  document.getElementById('profil-sifirla').addEventListener('click', function() {
    if (!confirm('Profil bilgileriniz silinecek. Emin misiniz?')) return;
    localStorage.removeItem('musteri_profil');
    document.getElementById('profil-isim').value    = '';
    document.getElementById('profil-telefon').value = '';
    document.getElementById('profil-adres1').value  = '';
    document.getElementById('profil-hosgeldin').textContent = 'Hosgeldiniz!';
    alert('Profil sifirlandi.');
  });

  document.getElementById('profil-konum-al').addEventListener('click', function() {
    var btn = document.getElementById('profil-konum-al');
    if (!navigator.geolocation) { alert('Konum desteklenmiyor.'); return; }
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
            var profil = profilYukle() || {};
            profil.lat = latlng[0]; profil.lng = latlng[1];
            profilKaydet(profil);
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

      // localStorage'a kaydet
      var profil = profilYukle() || {};
      profil.lat = lat;
      profil.lng = lng;
      profilKaydet(profil);
      durum.lat = lat;
      durum.lng = lng;

      btn.textContent = '✅ Konum Alindi';
      btn.disabled = false;
    }, function() {
      alert('Konum alinamadi. Lutfen izin verin.');
      btn.textContent = '📍 Konumumu Kullan';
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
var durumIkon  = { 'bekliyor': '⏳', 'hazirlaniyor': '👨‍🍳', 'yolda': '🛵', 'teslim edildi': '✅' };
var durumRenk  = { 'bekliyor': '#ff9800', 'hazirlaniyor': '#2196f3', 'yolda': '#9c27b0', 'teslim edildi': '#4caf50' };

function siparislerimSayfasiAc(siparisId) {
  siparisTakip.siparisId = siparisId;
  sayfaGoster('siparislerim');
  siparisGuncelle();
  if (siparisTakip.interval) clearInterval(siparisTakip.interval);
  siparisTakip.interval = setInterval(function() {
    if (document.getElementById('sayfa-siparislerim').classList.contains('aktif')) {
      siparisGuncelle();
    } else {
      clearInterval(siparisTakip.interval);
    }
  }, 10000);
}

function siparisGuncelle() {
  if (!siparisTakip.siparisId) return;
  fetch(API_URL + '/api/siparis-detay/' + siparisTakip.siparisId)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) throw new Error(data.mesaj);
      siparisDetayGoster(data.veri);
    })
    .catch(function(err) {
      document.getElementById('siparislerim-icerik').innerHTML =
        '<div class="hata">Siparis bilgisi alinamadi: ' + err.message + '</div>';
    });
}

function siparisDetayGoster(s) {
  var urunler = Array.isArray(s.urunler) ? s.urunler :
    (typeof s.urunler === 'string' ? JSON.parse(s.urunler) : []);
  var aktifAdim = durumAdim.indexOf(s.durum);

  var adimlerHtml = '<div style="display:flex;justify-content:space-between;align-items:center;margin:20px 0 8px">' +
    durumAdim.map(function(ad, i) {
      var gecti  = i <= aktifAdim;
      var aktif  = i === aktifAdim;
      var renk   = gecti ? (durumRenk[ad] || '#4caf50') : '#ddd';
      var boyut  = aktif ? '2rem' : '1.4rem';
      return '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1">' +
        '<span style="font-size:' + boyut + ';filter:' + (gecti ? 'none' : 'grayscale(1)') + '">' + (durumIkon[ad] || '•') + '</span>' +
        '<span style="font-size:.6rem;font-weight:' + (aktif ? '800' : '400') + ';color:' + renk + ';text-align:center">' + ad + '</span>' +
      '</div>';
    }).join('<div style="flex:0 0 2px;height:2px;background:#eee;margin-top:16px"></div>') +
  '</div>';

  var ilerlemeYuzde = aktifAdim >= 0 ? Math.round((aktifAdim / (durumAdim.length - 1)) * 100) : 0;
  var ilerlemeBar = '<div style="background:#f0f0f0;border-radius:10px;height:6px;margin-bottom:20px">' +
    '<div style="background:' + (durumRenk[s.durum] || '#4caf50') + ';height:6px;border-radius:10px;width:' + ilerlemeYuzde + '%;transition:width .5s"></div>' +
  '</div>';

  var urunlerHtml = urunler.map(function(u) {
    return '<div style="display:flex;justify-content:space-between;font-size:.85rem;padding:4px 0;border-bottom:1px solid #f5f5f5">' +
      '<span>' + u.ad + ' <span style="color:#aaa">x' + u.adet + '</span></span>' +
      '<span style="font-weight:700;color:#ff6b35">₺' + (u.fiyat * u.adet) + '</span>' +
    '</div>';
  }).join('');

  document.getElementById('siparislerim-icerik').innerHTML =
    '<div style="background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 10px rgba(0,0,0,.07);margin-bottom:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
        '<span style="font-weight:800;font-size:1rem">Siparis #' + s.id + '</span>' +
        '<span style="background:' + (durumRenk[s.durum] || '#ccc') + ';color:#fff;padding:3px 10px;border-radius:20px;font-size:.75rem;font-weight:700">' +
          (durumIkon[s.durum] || '') + ' ' + (s.durum || '') + '</span>' +
      '</div>' +
      '<div style="font-size:.8rem;color:#aaa;margin-bottom:16px">' + (s.esnaf_adi || '') + ' · ' +
        (s.teslimat_turu || '') + (s.adres ? ' · ' + s.adres : '') + '</div>' +
      adimlerHtml +
      ilerlemeBar +
      '<div style="font-size:.8rem;font-weight:700;color:#666;margin-bottom:6px">Urunler</div>' +
      urunlerHtml +
      '<div style="display:flex;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:2px solid #f0f0f0">' +
        '<span style="font-size:.85rem;color:#666">Toplam</span>' +
        '<span style="font-weight:800;font-size:1rem;color:#ff6b35">₺' + (parseFloat(s.genel_toplam) || 0) + '</span>' +
      '</div>' +
    '</div>' +
    '<div style="text-align:center;font-size:.75rem;color:#bbb;margin-top:8px">🔄 Her 10 saniyede otomatik güncellenir</div>';
}

function siparislerListele() {
  var profil = profilYukle();
  var icerik = document.getElementById('siparislerim-icerik');
  if (!icerik) return;

  // Aktif takip varsa önce onu göster
  if (siparisTakip.siparisId) {
    siparisGuncelle();
    return;
  }

  if (!profil || !profil.telefon) {
    icerik.innerHTML = '<div style="text-align:center;padding:40px;color:#aaa">Siparişlerinizi görmek için profilinizde telefon numarası kaydedin.</div>';
    return;
  }

  icerik.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa">Yükleniyor...</div>';

  fetch(API_URL + '/api/siparislerim?telefon=' + encodeURIComponent(profil.telefon))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) throw new Error(data.mesaj);
      var siparisler = data.veri;
      if (!siparisler.length) {
        icerik.innerHTML = '<div style="text-align:center;padding:40px;color:#aaa">Henüz siparişiniz yok.</div>';
        return;
      }
      icerik.innerHTML = siparisler.map(function(s) {
        var tarih = new Date(s.tarih).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
        var renk = durumRenk[s.durum] || '#aaa';
        return '<div style="background:#fff;border-radius:14px;padding:14px 16px;box-shadow:0 2px 8px rgba(0,0,0,.06);margin-bottom:10px;cursor:pointer" onclick="siparisTakip.siparisId=' + s.id + ';siparisGuncelle()">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
            '<span style="font-weight:800;font-size:.95rem">Siparis #' + s.id + '</span>' +
            '<span style="background:' + renk + ';color:#fff;padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:700">' + (durumIkon[s.durum] || '') + ' ' + (s.durum || '') + '</span>' +
          '</div>' +
          '<div style="font-size:.82rem;color:#666;margin-bottom:4px">' + (s.esnaf_adi || '') + '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center">' +
            '<span style="font-size:.75rem;color:#bbb">' + tarih + '</span>' +
            '<span style="font-weight:800;color:#ff6b35">₺' + (parseFloat(s.genel_toplam) || 0) + '</span>' +
          '</div>' +
        '</div>';
      }).join('');
    })
    .catch(function(err) {
      icerik.innerHTML = '<div class="hata">Siparisler alinamadi: ' + err.message + '</div>';
    });
}

// =============================================================
// FAVORİLER
// =============================================================

function favorileriYukle() {
  try { return JSON.parse(localStorage.getItem('favoriler') || '[]'); }
  catch(e) { return []; }
}

function favorileriKaydet(favoriler) {
  localStorage.setItem('favoriler', JSON.stringify(favoriler));
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
  listesi.innerHTML = '<div class="yukleniyor">Yukleniyor...</div>';
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

function navOlustur(containerId, aktif) {
  var items = [
    { id: 'ana',          icon: '🏠', label: 'Ana Sayfa'  },
    { id: 'favoriler',    icon: '❤️', label: 'Favoriler'  },
    { id: 'siparislerim', icon: '🛵', label: 'Siparisim'  },
    { id: 'profil',       icon: '👤', label: 'Profilim'   },
    { id: 'kayit',        icon: '🏪', label: 'Kayit Ol'   },
    { id: 'panel',        icon: '📦', label: 'Panelim'    }
  ];
  document.getElementById(containerId).innerHTML = items.map(function(item) {
    return '<div class="nav-item' + (item.id === aktif ? ' active' : '') +
      '" onclick="navTikla(\'' + item.id + '\')">' +
      '<span class="nav-icon">' + item.icon + '</span>' + item.label + '</div>';
  }).join('');
}

function navTikla(id) {
  if (id === 'ana') {
    sayfaGoster('ana');
  } else if (id === 'siparislerim') {
    sayfaGoster('siparislerim');
    siparislerListele();
  } else if (id === 'profil') {
    profilSayfasiGoster();
  } else if (id === 'favoriler') {
    favorilerSayfasiGoster();
  } else if (id === 'kayit') {
    sayfaGoster('kayit-secim');
  } else if (id === 'panel') {
    sayfaGoster('panel');
    panelYukle();
  }
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

function haritaMarkerlariGuncelle(esnaflar) {
  markerlariTemizle(durum.anaMarkers);

  esnaflar.forEach(function(e) {
    if (!e.lat || !e.lng) return;
    var lat = parseFloat(e.lat), lng = parseFloat(e.lng);
    var popup = '<b>' + e.ad + '</b>' + (e.mesafe_text ? '<br>' + e.mesafe_text : '');

    if (durum.anaHarita) {
      var m = L.marker([lat, lng]).addTo(durum.anaHarita).bindPopup(popup);
      m.on('click', function() { esnafDetay(e.id); });
      durum.anaMarkers.push(m);
    }
  });
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

  listesi.innerHTML = '<div class="yukleniyor">Yukleniyor...</div>';

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
    return '<div class="esnaf-card" onclick="esnafDetay(' + e.id + ')">' +
      '<div class="esnaf-card-top">' +
        '<div class="esnaf-img">' + ikon(e.kategori) + '</div>' +
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
          '</div>' +
        '</div>' +
      '</div>' +
      (urunAdi ? '<div class="esnaf-fiyat-bar"><span>' + urunAdi + '</span>' +
        (minFiyat !== null ? '<span class="min-fiyat">₺' + minFiyat + '\'den</span>' : '') +
      '</div>' : '') +
    '</div>';
  }).join('');
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
  durum.sepet = [];
  durum.secilenEsnaf = null;
  document.getElementById('detay-adi').textContent = 'Yukleniyor...';
  document.getElementById('tab-menu').innerHTML = '<div class="yukleniyor">Yukleniyor...</div>';
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

function detayDoldur(e) {
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

  // Tablar
  document.getElementById('detay-tabs').innerHTML = ['Menu', 'Yorumlar', 'Yorum Yaz'].map(function(t, i) {
    return '<div class="detay-tab' + (i === 0 ? ' active' : '') + '" onclick="tabSec(this,' + i + ')">' + t + '</div>';
  }).join('');

  menuGoster(e.urunler || []);
  yorumlarGoster(e.yorumlar || []);
  puanSeciciOlustur();

  document.getElementById('tab-menu').style.display = '';
  document.getElementById('tab-yorumlar').style.display = 'none';
  document.getElementById('tab-yorum-ekle').style.display = 'none';
}

function tabSec(el, idx) {
  document.querySelectorAll('.detay-tab').forEach(function(t) { t.classList.remove('active'); });
  el.classList.add('active');
  document.getElementById('tab-menu').style.display = idx === 0 ? '' : 'none';
  document.getElementById('tab-yorumlar').style.display = idx === 1 ? '' : 'none';
  document.getElementById('tab-yorum-ekle').style.display = idx === 2 ? '' : 'none';
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
    alert('Siparis vermek icin once profilinize telefon numarasi ekleyin.');
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
      } else { alert('Hata: ' + data.mesaj); }
    })
    .catch(function() { alert('Siparis gonderilemedi.'); });
}

// =============================================================
// YORUM GÖNDER
// =============================================================

function yorumGonder() {
  if (!durum.secilenEsnaf) return;
  var kullanici = document.getElementById('yorum-kullanici').value.trim();
  var yorum     = document.getElementById('yorum-metin').value.trim();
  if (!kullanici || !yorum || !durum.secilenPuan) {
    alert('Lutfen tum alanlari doldurun ve puan verin.'); return;
  }
  fetch(API_URL + '/api/esnaflar/' + durum.secilenEsnaf.id + '/yorumlar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kullanici: kullanici, puan: durum.secilenPuan, yorum: yorum })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.basari) {
        alert('Yorumunuz eklendi!');
        document.getElementById('yorum-kullanici').value = '';
        document.getElementById('yorum-metin').value = '';
        fcSil('esnaflar:');
        esnafDetay(durum.secilenEsnaf.id);
      } else { alert('Hata: ' + data.mesaj); }
    })
    .catch(function() { alert('Yorum gonderilemedi.'); });
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
      if (!navigator.geolocation) { alert('Konum desteklenmiyor.'); return; }
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

      if (!ad || !kategori || !ilce || !telefon || !vergiNo) {
        alert('Lutfen zorunlu alanlari doldurun (*)'); return;
      }

      var fd = new FormData();
      fd.append('ad', ad); fd.append('kategori', kategori); fd.append('ilce', ilce);
      fd.append('adres', adres); fd.append('telefon', telefon); fd.append('email', email);
      fd.append('vergi_no', vergiNo);
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

      kayitGonderBtn.disabled = true;
      kayitGonderBtn.textContent = 'Gonderiliyor...';

      fetch(API_URL + '/api/esnaf-kayit', { method: 'POST', body: fd })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          kayitGonderBtn.disabled = false;
          kayitGonderBtn.textContent = 'Kayit Ol ve WhatsApp ile Onayla';
          if (data.basari) {
            alert('Kaydiniz alindi! Kayit ID: ' + data.kayit_id);
            if (data.whatsapp_url) window.open(data.whatsapp_url, '_blank');
            sayfaGoster('ana');
          } else { alert('Hata: ' + data.mesaj); }
        })
        .catch(function() {
          kayitGonderBtn.disabled = false;
          kayitGonderBtn.textContent = 'Kayit Ol ve WhatsApp ile Onayla';
          alert('Kayit gonderilemedi.');
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
  var mesaj   = document.getElementById('kurye-kayit-mesaj');

  if (!ad || !telefon || !arac || !ilce) {
    mesaj.style.color = '#e53935';
    mesaj.textContent = 'Lütfen tüm alanları doldurun.';
    return;
  }

  var btn = document.getElementById('kurye-kayit-gonder');
  btn.disabled = true;
  btn.textContent = 'Gönderiliyor...';
  mesaj.textContent = '';

  fetch(API_URL + '/api/kurye-kayit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ad: ad, telefon: telefon, arac_tipi: arac, ilce: ilce })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      btn.disabled = false;
      btn.textContent = 'Başvur';
      if (data.basari) {
        mesaj.style.color = '#2e7d32';
        mesaj.textContent = '✅ Başvurunuz alındı! Onaylandığında size ulaşacağız.';
        document.getElementById('kur-ad').value = '';
        document.getElementById('kur-telefon').value = '';
        document.getElementById('kur-arac').value = '';
        document.getElementById('kur-ilce').value = '';
      } else {
        mesaj.style.color = '#e53935';
        mesaj.textContent = 'Hata: ' + data.mesaj;
      }
    })
    .catch(function() {
      btn.disabled = false;
      btn.textContent = 'Başvur';
      mesaj.style.color = '#e53935';
      mesaj.textContent = 'Bağlantı hatası.';
    });
}

function adminGoster() {
  var key = prompt('Admin sifresi:');
  if (!key) return;
  sayfaGoster('admin');
  var icerik = document.getElementById('admin-icerik');
  icerik.innerHTML = '<div class="yukleniyor">Yukleniyor...</div>';

  Promise.all([
    fetch(API_URL + '/api/admin/bekleyenler?key=' + key).then(function(r) { return r.json(); }),
    fetch(API_URL + '/api/admin/aktifler?key='    + key).then(function(r) { return r.json(); }),
    fetch(API_URL + '/api/admin/kuryeler?key='    + key).then(function(r) { return r.json(); })
  ]).then(function(results) {
    if (!results[0].basari) { icerik.innerHTML = '<div class="hata">Yetkisiz erisim.</div>'; return; }
    adminPanelGoster(results[0].veri, results[1].veri || [], results[2].veri || [], key);
  }).catch(function() { icerik.innerHTML = '<div class="hata">Baglanamadi.</div>'; });
}

function adminPanelGoster(bekleyenler, aktifler, kuryeler, key) {
  var html = '<div class="s-title">Bekleyen Onaylar (' + bekleyenler.length + ')</div>';
  html += bekleyenler.map(function(e) {
    return '<div class="admin-card">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
        '<div><b>' + e.ad + '</b><br><small>' + e.kategori + ' - ' + e.ilce + '</small></div>' +
        '<div style="display:flex;gap:5px">' +
          '<button onclick="adminIslem(\'onayla\',' + e.id + ',\'' + key + '\')" style="background:#e8f5e9;color:#2e7d32;border:none;border-radius:7px;padding:5px 10px;font-size:.73rem;font-weight:700;cursor:pointer">Onayla</button>' +
          '<button onclick="adminIslem(\'reddet\',' + e.id + ',\'' + key + '\')" style="background:#ffebee;color:#c62828;border:none;border-radius:7px;padding:5px 10px;font-size:.73rem;font-weight:700;cursor:pointer">Reddet</button>' +
        '</div>' +
      '</div></div>';
  }).join('');

  html += '<div class="s-title" style="margin-top:16px">Tum Esnaflar (' + aktifler.length + ')</div>';
  html += aktifler.map(function(e) {
    return '<div class="admin-card">' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<div><b>' + e.ad + '</b><br><small>' + e.kategori + ' - ' + e.ilce + ' - ' +
          (e.onaylandi ? '✅ Yayinda' : '⏳ Bekliyor') + '</small></div>' +
        '<div style="display:flex;gap:5px;flex-wrap:wrap">' +
          (e.onaylandi
            ? '<button onclick="adminIslem(\'pasif\',' + e.id + ',\'' + key + '\')" style="background:#fff3e0;color:#e65100;border:none;border-radius:7px;padding:4px 8px;font-size:.7rem;font-weight:700;cursor:pointer">Yayindan Al</button>'
            : '<button onclick="adminIslem(\'aktif\',' + e.id + ',\'' + key + '\')" style="background:#e8f5e9;color:#2e7d32;border:none;border-radius:7px;padding:4px 8px;font-size:.7rem;font-weight:700;cursor:pointer">Yayina Al</button>'
          ) +
          '<button onclick="adminIslem(\'sil\',' + e.id + ',\'' + key + '\')" style="background:#ffebee;color:#c62828;border:none;border-radius:7px;padding:4px 8px;font-size:.7rem;font-weight:700;cursor:pointer">Sil</button>' +
        '</div>' +
      '</div></div>';
  }).join('');

  // Kurye başvuruları
  html += '<div class="s-title" style="margin-top:16px">🛵 Kurye Başvuruları (' + kuryeler.length + ')</div>';
  if (!kuryeler.length) {
    html += '<div style="color:#aaa;font-size:.82rem;padding:8px 0">Bekleyen kurye başvurusu yok.</div>';
  } else {
    html += kuryeler.map(function(k) {
      return '<div class="admin-card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<div><b>' + k.ad + '</b><br><small>' + k.telefon + ' · ' + k.arac_tipi + ' · ' + k.ilce + ' · ' +
            (k.onaylandi ? '✅ Onaylı' : '⏳ Bekliyor') + '</small></div>' +
          '<div style="display:flex;gap:5px;flex-wrap:wrap">' +
            (!k.onaylandi
              ? '<button onclick="kuryeIslem(\'onayla\',' + k.id + ',\'' + key + '\')" style="background:#e8f5e9;color:#2e7d32;border:none;border-radius:7px;padding:5px 10px;font-size:.73rem;font-weight:700;cursor:pointer">Onayla</button>'
              : '') +
            '<button onclick="kuryeIslem(\'sil\',' + k.id + ',\'' + key + '\')" style="background:#ffebee;color:#c62828;border:none;border-radius:7px;padding:5px 10px;font-size:.73rem;font-weight:700;cursor:pointer">Sil</button>' +
          '</div>' +
        '</div></div>';
    }).join('');
  }

  document.getElementById('admin-icerik').innerHTML = html;
}

function kuryeIslem(tip, id, key) {
  if (tip === 'sil' && !confirm('Kurye silinecek. Emin misiniz?')) return;
  var istek;
  if (tip === 'onayla') istek = fetch(API_URL + '/api/admin/kurye-onayla/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: key }) });
  else if (tip === 'sil') istek = fetch(API_URL + '/api/admin/kurye-sil/' + id + '?key=' + key, { method: 'DELETE' });
  istek.then(function() { adminGoster(); });
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

  istek.then(function() { adminGoster(); });
}

// =============================================================
// ESNAF PANELİ
// =============================================================

function panelYukle() {
  var con = document.getElementById('panel-siparisler');
  con.innerHTML = '<div class="yukleniyor">Yukleniyor...</div>';
  fetch(API_URL + '/api/siparisler')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) { con.innerHTML = '<div class="hata">Hata.</div>'; return; }
      var siparisler = data.veri;
      var toplam = siparisler.reduce(function(t, s) { return t + parseFloat(s.genel_toplam || 0); }, 0);
      document.getElementById('panel-siparis-sayi').textContent = siparisler.length;
      document.getElementById('panel-toplam').textContent = '₺' + Math.round(toplam);

      if (!siparisler.length) { con.innerHTML = '<div class="yukleniyor">Henuz siparis yok.</div>'; return; }
      con.innerHTML = siparisler.slice(0, 20).map(function(s) {
        var urunler = Array.isArray(s.urunler) ? s.urunler :
          (typeof s.urunler === 'string' ? JSON.parse(s.urunler) : []);
        var urunText = urunler.map(function(u) { return u.ad + ' x' + u.adet; }).join(', ');
        return '<div class="order-card">' +
          '<div class="order-header">' +
            '<span class="order-id">#' + s.id + ' - ' + (s.esnaf_adi || '') + '</span>' +
            '<span class="order-badge ' + (s.durum === 'tamamlandi' ? 'badge-done' : 'badge-new') + '">' + s.durum + '</span>' +
          '</div>' +
          '<div class="order-items">' + urunText +
            '<br><small>' + (s.teslimat_turu || '') + (s.adres ? ' - ' + s.adres : '') + '</small>' +
          '</div>' +
          '<div class="order-footer">' +
            '<span class="order-price">₺' + (parseFloat(s.genel_toplam) || 0) + '</span>' +
            (s.durum !== 'tamamlandi'
              ? '<button class="btn-accept" onclick="siparisKabul(' + s.id + ')">Tamamlandi</button>'
              : '') +
          '</div></div>';
      }).join('');
    })
    .catch(function() { con.innerHTML = '<div class="hata">Baglanamadi.</div>'; });

  if (durum.panelEsnafId) calismaSaatleriYukle(durum.panelEsnafId);
}

function panelEsnafIdSec() {
  var inp = document.getElementById('panel-esnaf-id-giris');
  var id = parseInt(inp.value);
  if (!id) { alert('Gecerli bir Esnaf ID girin.'); return; }
  durum.panelEsnafId = id;
  calismaSaatleriYukle(id);
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
  if (!esnafId) { alert('Once Esnaf ID girin.'); return; }
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
      alert(data.mesaj || (data.basari ? 'Kaydedildi.' : 'Hata.'));
    })
    .catch(function() { alert('Baglanamadi.'); });
}

function siparisKabul(id) {
  fetch(API_URL + '/api/siparisler/' + id + '/durum', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ durum: 'tamamlandi' })
  }).then(function() { panelYukle(); });
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

document.addEventListener('DOMContentLoaded', function() {
  if (window.L) L.Icon.Default.imagePath = 'images/';

  // Alt navigasyonlar
  navOlustur('ana-nav',          'ana');
  navOlustur('favoriler-nav',    'favoriler');
  navOlustur('siparislerim-nav', 'siparislerim');
  navOlustur('profil-nav',       'profil');
  navOlustur('panel-nav',        'panel');

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

  // Buton event'leri
  document.getElementById('sepet-btn').addEventListener('click', siparisVer);
  document.getElementById('yorum-gonder-btn').addEventListener('click', yorumGonder);
  document.getElementById('back-btn').addEventListener('click', function() { sayfaGoster('ana'); });
  document.getElementById('admin-geri').addEventListener('click', function() { sayfaGoster('ana'); });
  document.getElementById('siparislerim-geri').addEventListener('click', function() { sayfaGoster('ana'); });
  document.getElementById('kayit-geri').addEventListener('click', function() { sayfaGoster('kayit-secim'); });
  document.getElementById('kurye-kayit-gonder').addEventListener('click', kuryeKayitGonder);

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

  // Profil formu
  profilFormuBaslat();

  // Kayıt formu
  kayitFormuBaslat();

  // Admin gizli erişim: konum div'e 5 kez tıkla
  var tikSayisi = 0;
  document.getElementById('konum-div').addEventListener('click', function() {
    if (++tikSayisi >= 5) { tikSayisi = 0; adminGoster(); }
  });
});
