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

