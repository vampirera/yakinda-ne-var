// =============================================================
// Yakinda Ne Var - Frontend App
// =============================================================

var API_URL = 'http://localhost:3000';

var durum = {
  lat: null,
  lng: null,
  kategori: null,
  siralama: 'mesafe',
  arama: '',
  teslimat: 'kurye',
  secilenEsnaf: null,
  sepet: [],
  secilenPuan: 0,
  anaHarita: null,
  tamHarita: null,
  detayHarita: null,
  kayitHarita: null,
  kayitLat: null,
  kayitLng: null,
  anaMarkers: [],
  tamMarkers: [],
  profilHarita: null,
  profilHaritaMarker: null
};

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
      document.getElementById('profil-konum-bilgi').textContent =
        '📍 ' + parseFloat(profil.lat).toFixed(5) + ', ' + parseFloat(profil.lng).toFixed(5);
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
            document.getElementById('profil-konum-bilgi').textContent = '📍 ' + latlng[0].toFixed(5) + ', ' + latlng[1].toFixed(5);
          });
        }
        durum.profilHarita.setView([lat, lng], 16);
        durum.profilHarita.invalidateSize();
        if (durum.profilHaritaMarker) durum.profilHaritaMarker.remove();
        durum.profilHaritaMarker = L.marker([lat, lng]).addTo(durum.profilHarita).bindPopup('Konumunuz').openPopup();
        document.getElementById('profil-konum-bilgi').textContent =
          '📍 ' + lat.toFixed(5) + ', ' + lng.toFixed(5);
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
  fetch(API_URL + '/api/siparisler/' + siparisTakip.siparisId)
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

  if (id === 'harita') {
    setTimeout(function() {
      if (!durum.tamHarita) tamHaritaBaslat();
      durum.tamHarita.invalidateSize();
    }, 100);
  }
  if (id === 'detay') {
    setTimeout(function() {
      if (durum.detayHarita) durum.detayHarita.invalidateSize();
    }, 100);
  }
  if (id === 'kayit') {
    setTimeout(kayitHaritaBaslat, 150);
  }
}

function navOlustur(containerId, aktif) {
  var items = [
    { id: 'ana',       icon: '🏠', label: 'Ana Sayfa' },
    { id: 'harita',    icon: '🗺️', label: 'Harita'    },
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
  } else if (id === 'harita') {
    sayfaGoster('harita');
    tamHaritaGuncelle();
  } else if (id === 'siparislerim') {
    sayfaGoster('siparislerim');
    siparislerListele();
  } else if (id === 'profil') {
    profilSayfasiGoster();
  } else if (id === 'favoriler') {
    favorilerSayfasiGoster();
  } else if (id === 'kayit') {
    sayfaGoster('kayit');
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

// =============================================================
// KONUM
// =============================================================

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
    document.getElementById('konum-text').textContent = 'Konumunuz';
    esnaflarYukle();
    if (durum.anaHarita) {
      durum.anaHarita.setView([durum.lat, durum.lng], 13);
      L.circleMarker([durum.lat, durum.lng], {
        radius: 10, color: '#1565c0', fillColor: '#1e88e5', fillOpacity: 0.8, weight: 2
      }).addTo(durum.anaHarita).bindPopup('Konumunuz');
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
}

function tamHaritaBaslat() {
  if (durum.tamHarita) return;
  durum.tamHarita = L.map('tam-harita', { attributionControl: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(durum.tamHarita);
  durum.tamHarita.setView([36.8550, 28.2753], 13);
  var konumMarkerTam = null;
  konumButonuEkle(durum.tamHarita, function(latlng) {
    if (konumMarkerTam) durum.tamHarita.removeLayer(konumMarkerTam);
    konumMarkerTam = L.circleMarker(latlng, { radius: 10, color: '#1565c0', fillColor: '#1e88e5', fillOpacity: 0.8, weight: 2 })
      .addTo(durum.tamHarita).bindPopup('Konumunuz');
    durum.lat = latlng[0]; durum.lng = latlng[1];
  });
}

function tamHaritaGuncelle() {
  if (!durum.tamHarita) tamHaritaBaslat();
  setTimeout(function() { durum.tamHarita.invalidateSize(); }, 100);
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
    document.getElementById('kayit-konum-text').textContent =
      durum.kayitLat.toFixed(4) + ', ' + durum.kayitLng.toFixed(4);
  });
  konumButonuEkle(durum.kayitHarita, function(latlng) {
    if (marker) durum.kayitHarita.removeLayer(marker);
    marker = L.marker(latlng).addTo(durum.kayitHarita);
    durum.kayitLat = latlng[0]; durum.kayitLng = latlng[1];
    document.getElementById('k-lat').value = durum.kayitLat;
    document.getElementById('k-lng').value = durum.kayitLng;
    document.getElementById('kayit-konum-text').textContent =
      durum.kayitLat.toFixed(4) + ', ' + durum.kayitLng.toFixed(4);
  });
}

function markerlariTemizle(liste) {
  liste.forEach(function(m) { m.remove(); });
  liste.length = 0;
}

function haritaMarkerlariGuncelle(esnaflar) {
  markerlariTemizle(durum.anaMarkers);
  markerlariTemizle(durum.tamMarkers);

  esnaflar.forEach(function(e) {
    if (!e.lat || !e.lng) return;
    var lat = parseFloat(e.lat), lng = parseFloat(e.lng);
    var popup = '<b>' + e.ad + '</b>' + (e.mesafe_text ? '<br>' + e.mesafe_text : '');

    if (durum.anaHarita) {
      var m1 = L.marker([lat, lng]).addTo(durum.anaHarita).bindPopup(popup);
      m1.on('click', function() { esnafDetay(e.id); });
      durum.anaMarkers.push(m1);
    }
    if (durum.tamHarita) {
      var m2 = L.marker([lat, lng]).addTo(durum.tamHarita).bindPopup(popup);
      m2.on('click', function() { esnafDetay(e.id); });
      durum.tamMarkers.push(m2);
    }
  });

  var sayac = document.getElementById('harita-sayac');
  if (sayac) sayac.textContent = esnaflar.length + ' esnaf';
}

// =============================================================
// ESNAF LİSTESİ
// =============================================================

function esnaflarYukle() {
  var listesi = document.getElementById('esnaf-listesi');
  listesi.innerHTML = '<div class="yukleniyor">Yukleniyor...</div>';

  var params = new URLSearchParams();
  if (durum.lat)      { params.append('lat', durum.lat); params.append('lng', durum.lng); }
  if (durum.kategori) { params.append('kategori', durum.kategori); }
  if (durum.siralama) { params.append('siralama', durum.siralama); }
  if (durum.arama)    { params.append('arama', durum.arama); }

  var url = API_URL + '/api/esnaflar?' + params.toString();
  console.log('[esnaflarYukle]', url);

  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) throw new Error(data.mesaj);
      esnaflarGoster(data.veri);
      haritaMarkerlariGuncelle(data.veri);
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
            '<span class="tag ' + (e.acik ? 'open' : '') + '">' + (e.acik ? '🟢 Acik' : '🔴 Kapali') + '</span>' +
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
  document.getElementById('detay-durum').textContent = e.acik ? '🟢 Acik' : '🔴 Kapali';

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
      (u.fotograf_url ? '<img src="' + u.fotograf_url + '" onclick="event.stopPropagation();lightboxAc(\'' + u.fotograf_url + '\')" style="width:50px;height:50px;object-fit:cover;border-radius:8px;margin-right:10px;cursor:zoom-in">' : '') +
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
  if (!profil) {
    alert('Siparis verebilmek icin once profilinizi olusturun.');
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

function adminGoster() {
  var key = prompt('Admin sifresi:');
  if (!key) return;
  sayfaGoster('admin');
  var icerik = document.getElementById('admin-icerik');
  icerik.innerHTML = '<div class="yukleniyor">Yukleniyor...</div>';

  Promise.all([
    fetch(API_URL + '/api/admin/bekleyenler?key=' + key).then(function(r) { return r.json(); }),
    fetch(API_URL + '/api/admin/aktifler?key='    + key).then(function(r) { return r.json(); })
  ]).then(function(results) {
    if (!results[0].basari) { icerik.innerHTML = '<div class="hata">Yetkisiz erisim.</div>'; return; }
    adminPanelGoster(results[0].veri, results[1].veri || [], key);
  }).catch(function() { icerik.innerHTML = '<div class="hata">Baglanamadi.</div>'; });
}

function adminPanelGoster(bekleyenler, aktifler, key) {
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

  document.getElementById('admin-icerik').innerHTML = html;
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

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') lightboxKapat();
});

document.addEventListener('DOMContentLoaded', function() {
  if (window.L) L.Icon.Default.imagePath = 'images/';

  // Alt navigasyonlar
  navOlustur('ana-nav',          'ana');
  navOlustur('harita-nav',       'harita');
  navOlustur('favoriler-nav',    'favoriler');
  navOlustur('siparislerim-nav', 'siparislerim');
  navOlustur('profil-nav',       'profil');
  navOlustur('panel-nav',        'panel');

  // Filtre UI
  kategorilerOlustur();
  siralamaOlustur();

  // Haritalar
  anaHaritaBaslat();
  tamHaritaBaslat();

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
  document.getElementById('kayit-geri').addEventListener('click', function() { sayfaGoster('ana'); });

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
