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
    listesi.innerHTML = '<div class="bos-durum">Henüz favoriniz yok.</div>';
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
        listesi.innerHTML = '<div class="bos-durum">Henüz favoriniz yok.</div>';
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

// Hizmet esnafları için kategori/ad bazlı varsayılan emoji
var _kapakEmojiKural = [
  [/doktor|klinik|sağlık|saglik|hastane|hekim/i, '🩺'],
  [/berber|kuaför|kuafor|saç|sac|güzellik|guzellik/i, '✂️'],
  [/temizlik/i, '🧹'],
  [/elektrik/i, '⚡'],
  [/tesisat|tesisatçı|tesisatci/i, '🔧'],
  [/boyacı|boyaci|boya/i, '🎨'],
  [/nakliyat|nakliye|taşıma|tasima/i, '🚚'],
  [/avukat|hukuk/i, '⚖️'],
  [/muhasebe|mali müşavir|mali musavir|muhasebeci/i, '📊'],
  [/oto|araba|otomobil|tamirci|tamirhan/i, '🚗'],
  [/diş|dis|dişçi|disci/i, '🦷'],
  [/veteriner|hayvan/i, '🐾'],
  [/fotoğrafçı|fotografci/i, '📸'],
  [/düğün|dugun|organizasyon/i, '🎉'],
  [/spor|fitness|gym/i, '💪']
];

function kapakEmoji(ad, kategori) {
  var metin = ((ad || '') + ' ' + (kategori || '')).toLowerCase();
  for (var i = 0; i < _kapakEmojiKural.length; i++) {
    if (_kapakEmojiKural[i][0].test(metin)) return _kapakEmojiKural[i][1];
  }
  return ikon(kategori);
}

// Esnaf kartı arka plan stili: kapak_foto varsa resim, yoksa emoji + gradient
function kapakBgStyle(e) {
  if (e.kapak_foto) return 'background:url(' + e.kapak_foto + ') center/cover no-repeat;';
  return 'background:linear-gradient(135deg,#1a1a2e,#16213e);';
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

