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
  // Harita viewport bbox — sadece görünen alanı yükle
  if (window.harita) {
    try {
      var bounds = window.harita.getBounds();
      var sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
      // Viewport'u %20 genişlet (kenardaki esnaflar kaybolmasın)
      var latPad = (ne.lat - sw.lat) * 0.2, lngPad = (ne.lng - sw.lng) * 0.2;
      params.append('swLat', (sw.lat - latPad).toFixed(6));
      params.append('swLng', (sw.lng - lngPad).toFixed(6));
      params.append('neLat', (ne.lat + latPad).toFixed(6));
      params.append('neLng', (ne.lng + lngPad).toFixed(6));
    } catch(e) {}
  }

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
    var urunAdi  = (e.urunler || []).slice(0, 2).map(function(u) { return temizle(u.ad); }).join(', ');
    var kalp     = favoriMi(e.id) ? '❤️' : '🤍';
    var kampanyaVar = (e.kampanyalar || []).length > 0;
    var kapakStyle = kapakBgStyle(e);
    var kapakIkon = e.kapak_foto ? '' : ('<div style="font-size:1.8rem;line-height:1;opacity:.85">' + kapakEmoji(e.ad, e.kategori) + '</div>');
    return '<div class="esnaf-card" onclick="esnafDetay(' + e.id + ')">' +
      '<div style="height:80px;' + kapakStyle + 'position:relative;border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:center">' +
        kapakIkon +
        (kampanyaVar ? '<div class="kart-kampanya-rozet" style="position:absolute;top:6px;right:6px">🏷️</div>' : '') +
      '</div>' +
      '<div class="esnaf-card-top">' +
        '<div class="esnaf-info">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
            '<h4>' + temizle(e.ad) + (e.onayli ? ' <span class="onay-rozet">✓ Onaylı</span>' : '') + '</h4>' +
            '<button class="kalp-btn" data-id="' + e.id + '" onclick="favoriToggle(' + e.id + ',event)" ' +
              'style="background:none;border:none;font-size:1.2rem;cursor:pointer;padding:0 4px;line-height:1">' +
              kalp + '</button>' +
          '</div>' +
          '<div class="esnaf-meta">' +
            '<span>⭐ ' + (e.puan || 0) + '</span>' +
            '<span>(' + (e.yorum_sayisi || 0) + ' yorum)</span>' +
            (e.mesafe_text ? '<span>📍 ' + e.mesafe_text + '</span>' : '') +
            '<span>' + temizle(e.ilce) + '</span>' +
          '</div>' +
          '<div class="esnaf-tags">' +
            acikDurumHtml(e) +
            '<span class="tag">' + temizle(e.kategori || '') + '</span>' +
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
              (e.one_cikan_etiket ? '<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.7));padding:4px 6px;font-size:.6rem;color:#fff;font-weight:700">' + temizle(e.one_cikan_etiket) + '</div>' : '') +
            '</div>' +
            '<div style="padding:7px 8px;background:#fff">' +
              '<div style="font-size:.78rem;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + temizle(e.ad) + '</div>' +
              '<div style="font-size:.68rem;color:#888">' + temizle(e.kategori) + '</div>' +
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
    listesi.innerHTML = '<div class="bos-durum">Yakında esnaf bulunamadı.</div>';
    return;
  }
  var LIMIT = 5;
  if (liste.length <= LIMIT) {
    listesi.innerHTML = esnafKartlariOlustur(liste);
    return;
  }
  listesi.innerHTML = esnafKartlariOlustur(liste.slice(0, LIMIT)) +
    '<button id="daha-fazla-btn" onclick="tumEsnaflarGoster()" style="' +
      'display:block;width:100%;margin-top:10px;padding:12px;' +
      'background:#6a1b9a;color:#fff;border:none;border-radius:10px;' +
      'font-size:.92rem;font-weight:700;cursor:pointer;letter-spacing:.02em' +
    '">Tümünü Göster (' + liste.length + ' esnaf)</button>';
  _tumEsnafListesi = liste;
}

var _tumEsnafListesi = [];

function tumEsnaflarGoster() {
  var listesi = document.getElementById('esnaf-listesi');
  if (!listesi || !_tumEsnafListesi.length) return;
  listesi.innerHTML = esnafKartlariOlustur(_tumEsnafListesi);
  _tumEsnafListesi = [];
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
  var heroEl = document.querySelector('#sayfa-detay .hero');
  var heroIcon = document.getElementById('hero-icon');
  if (heroEl) {
    if (e.kapak_foto) {
      heroEl.style.backgroundImage = 'url(' + e.kapak_foto + ')';
      heroEl.style.backgroundSize = 'cover';
      heroEl.style.backgroundPosition = 'center';
      heroEl.style.backgroundRepeat = 'no-repeat';
      if (heroIcon) heroIcon.style.display = 'none';
    } else {
      heroEl.style.backgroundImage = '';
      heroEl.style.background = '';
      if (heroIcon) { heroIcon.style.display = ''; heroIcon.textContent = kapakEmoji(e.ad, e.kategori); }
    }
  }
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
    sosyal.push('<a href="' + guvenliUrl(e.instagram_url) + '" target="_blank" rel="noopener" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,#833ab4,#e1306c,#f77737);color:#fff;border-radius:10px;padding:9px 8px;font-size:.78rem;font-weight:700;text-decoration:none">📸 Instagram</a>');
  }
  if (e.google_maps_url) {
    sosyal.push('<a href="' + guvenliUrl(e.google_maps_url) + '" target="_blank" rel="noopener" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;background:#fff;border:1.5px solid #4285f4;color:#4285f4;border-radius:10px;padding:9px 8px;font-size:.78rem;font-weight:700;text-decoration:none">⭐ Google Yorumları</a>');
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
    headers: jsonAuthHeader(),
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
      (u.fotograf_url ? '<img src="' + encodeURI(u.fotograf_url) + '" loading="lazy" onclick="event.stopPropagation();lightboxAc(\'' + encodeURI(u.fotograf_url).replace(/'/g,"%27") + '\')" style="width:50px;height:50px;object-fit:cover;border-radius:8px;margin-right:10px;cursor:zoom-in">' : '') +
      '<div class="menu-item-info">' +
        '<h5>' + temizle(u.ad) + '</h5>' +
        '<p>' + temizle(u.aciklama || '') + '</p>' +
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
        '<span class="yorum-kullanici">' + temizle(y.kullanici || 'Anonim') + '</span>' +
        '<span class="yorum-tarih">' + (y.tarih ? new Date(y.tarih).toLocaleDateString('tr-TR') : '') + '</span>' +
      '</div>' +
      '<div class="yorum-puan">' + '⭐'.repeat(parseInt(y.puan) || 0) + '</div>' +
      '<div class="yorum-text">' + temizle(y.yorum || '') + '</div>' +
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
    headers: jsonAuthHeader(),
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
    headers: jsonAuthHeader(),
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
    headers: jsonAuthHeader(),
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

