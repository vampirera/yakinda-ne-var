var API = 'https://yakinda-ne-var-backend-production.up.railway.app';
var ikonlar = { yemek: '🍽️', urun: '🛒', hizmet: '🔧' };
var tumEsnaflar = [];
var secilenEsnaf = null;
var sepet = {};
var secilenTeslimat = 'kurye';
var secilenKategori = 'tumu';
var secilenSiralama = 'mesafe';
var secilenPuan = 5;
var kullaniciLat = null;
var kullaniciLng = null;
var anaHarita = null;
var tamHarita = null;
var detayHarita = null;
var kayitHarita = null;
var kayitMarker = null;
var adminKey = null;

function init() {
  document.getElementById('ana-nav').innerHTML =
    '<div class="nav-item active" data-sayfa="ana"><div class="nav-icon">🏠</div><span>Ana</span></div>' +
    '<div class="nav-item" data-sayfa="harita"><div class="nav-icon">🗺️</div><span>Harita</span></div>' +
    '<div class="nav-item" data-sayfa="kayit"><div class="nav-icon">🏪</div><span>Esnaf Ol</span></div>' +
    '<div class="nav-item" data-sayfa="panel"><div class="nav-icon">📦</div><span>Panel</span></div>' +
    '<div class="nav-item" id="admin-nav-btn"><div class="nav-icon">⚙️</div><span>Admin</span></div>';
  document.getElementById('harita-nav').innerHTML =
    '<div class="nav-item" data-sayfa="ana"><div class="nav-icon">🏠</div><span>Ana</span></div>' +
    '<div class="nav-item active"><div class="nav-icon">🗺️</div><span>Harita</span></div>' +
    '<div class="nav-item" data-sayfa="kayit"><div class="nav-icon">🏪</div><span>Esnaf Ol</span></div>' +
    '<div class="nav-item" data-sayfa="panel"><div class="nav-icon">📦</div><span>Panel</span></div>' +
    '<div class="nav-item" data-sayfa="ana"><div class="nav-icon">👤</div><span>Profil</span></div>';
  document.getElementById('panel-nav').innerHTML =
    '<div class="nav-item" data-sayfa="ana"><div class="nav-icon">🏠</div><span>Musteri</span></div>' +
    '<div class="nav-item active"><div class="nav-icon">🏪</div><span>Esnaf</span></div>' +
    '<div class="nav-item" id="yenile-nav"><div class="nav-icon">📦</div><span>Siparisler</span></div>';
  document.getElementById('cats-row').innerHTML =
    '<div class="cat-btn active" data-kategori="tumu"><div class="icon">🏠</div><p>Tumu</p></div>' +
    '<div class="cat-btn" data-kategori="yemek"><div class="icon">🍽️</div><p>Yemek</p></div>' +
    '<div class="cat-btn" data-kategori="urun"><div class="icon">🛒</div><p>Urunler</p></div>' +
    '<div class="cat-btn" data-kategori="hizmet"><div class="icon">🔧</div><p>Hizmetler</p></div>';
  document.getElementById('siralama-row').innerHTML =
    '<button class="siralama-btn active" data-siralama="mesafe">📍 En Yakin</button>' +
    '<button class="siralama-btn" data-siralama="puan">⭐ En Yuksek</button>' +
    '<button class="siralama-btn" data-siralama="fiyat">💰 En Ucuz</button>';
  document.getElementById('detay-tabs').innerHTML =
    '<div class="detay-tab active" data-tab="menu">Menu</div>' +
    '<div class="detay-tab" data-tab="yorumlar">Yorumlar</div>' +
    '<div class="detay-tab" data-tab="yorum-ekle">Yorum Yaz</div>';
  var puanHtml = '';
  for (var p = 1; p <= 5; p++) puanHtml += '<span class="puan-yildiz aktif" data-puan="' + p + '">⭐</span>';
  document.getElementById('puan-secici').innerHTML = puanHtml;
  document.getElementById('arama').addEventListener('input', function() { esnaflariYukle(); });
  document.getElementById('fotograf-input').addEventListener('change', function(e) { gorselAra(e); });
  document.getElementById('k-vergi-dosya').addEventListener('change', function() {
    document.getElementById('vergi-text').textContent = this.files[0] ? this.files[0].name : 'Vergi levhasini yukleyin';
  });
  document.addEventListener('click', clickHandler);
  konumAl();
}

function clickHandler(e) {
  var t = e.target;
  var nav = t.closest('[data-sayfa]'); if (nav) { sayfaGit(nav.getAttribute('data-sayfa')); return; }
  var cat = t.closest('[data-kategori]'); if (cat) { secilenKategori = cat.getAttribute('data-kategori'); document.querySelectorAll('.cat-btn').forEach(function(b){b.classList.remove('active');}); cat.classList.add('active'); esnaflariYukle(); return; }
  var sir = t.closest('[data-siralama]'); if (sir) { secilenSiralama = sir.getAttribute('data-siralama'); document.querySelectorAll('.siralama-btn').forEach(function(b){b.classList.remove('active');}); sir.classList.add('active'); esnaflariYukle(); return; }
  var kart = t.closest('[data-esnaf-id]'); if (kart) { esnafAc(parseInt(kart.getAttribute('data-esnaf-id'))); return; }
  var addB = t.closest('[data-urun-id]'); if (addB) { sepeteEkle(parseInt(addB.getAttribute('data-urun-id')), addB.getAttribute('data-urun-ad'), parseInt(addB.getAttribute('data-urun-fiyat'))); return; }
  var dtab = t.closest('[data-tab]'); if (dtab) { tabSec(dtab.getAttribute('data-tab')); return; }
  var puan = t.closest('[data-puan]'); if (puan) { puanSec(parseInt(puan.getAttribute('data-puan'))); return; }
  var foto = t.closest('[data-foto]'); if (foto) { fotografBuyut(foto.getAttribute('data-foto')); return; }
  var onay = t.closest('[data-onayla-id]'); if (onay) { adminOnayla(parseInt(onay.getAttribute('data-onayla-id'))); return; }
  var red = t.closest('[data-reddet-id]'); if (red) { adminReddet(parseInt(red.getAttribute('data-reddet-id'))); return; }
  var pasif = t.closest('[data-pasif-id]'); if (pasif) { esnafPasifYap(parseInt(pasif.getAttribute('data-pasif-id'))); return; }
  var aktif = t.closest('[data-aktif-id]'); if (aktif) { esnafAktifYap(parseInt(aktif.getAttribute('data-aktif-id'))); return; }
  var sil = t.closest('[data-sil-id]'); if (sil) { esnafSil(parseInt(sil.getAttribute('data-sil-id'))); return; }
  var sip = t.closest('[data-siparis-id]'); if (sip) { siparisOnayla(parseInt(sip.getAttribute('data-siparis-id'))); return; }
  var ulas = t.closest('[data-ulasim]'); if (ulas) { document.querySelectorAll('.ulasim-btn').forEach(function(b){b.classList.remove('active');}); ulas.classList.add('active'); return; }
  if (t.id==='back-btn'||t.closest('#back-btn')) { sayfaGit('ana'); return; }
  if (t.id==='btn-kurye') { teslimatSec('kurye'); return; }
  if (t.id==='btn-gelal') { teslimatSec('gel-al'); return; }
  if (t.id==='sepet-btn'||t.closest('#sepet-btn')) { siparisVer(); return; }
  if (t.id==='konum-div'||t.closest('#konum-div')) { konumAl(); return; }
  if (t.id==='yorum-gonder-btn') { yorumGonder(); return; }
  if (t.id==='yenile-btn'||t.id==='yenile-nav') { siparisleriYukle(); return; }
  if (t.id==='urun-ekle-btn') { urunEkle(); return; }
  if (t.id==='yol-tarifi-btn'||t.closest('#yol-tarifi-btn')) { if (secilenEsnaf) { window.open('https://www.google.com/maps/dir/'+(kullaniciLat?kullaniciLat+','+kullaniciLng+'/':'')+secilenEsnaf.lat+','+secilenEsnaf.lng,'_blank'); } return; }
  if (t.id==='gorsel-ara-btn'||t.closest('#gorsel-ara-btn')) { document.getElementById('fotograf-input').click(); return; }
  if (t.id==='kayit-geri') { sayfaGit('ana'); return; }
  if (t.id==='admin-geri') { sayfaGit('ana'); return; }
  if (t.id==='urun-satir-ekle') { urunSatirEkle(); return; }
  if (t.id==='kayit-gonder') { kayitGonder(); return; }
  if (t.id==='admin-nav-btn'||t.closest('#admin-nav-btn')) { adminAc(); return; }
  if (t.id==='vergi-label'||t.closest('#vergi-label')) { document.getElementById('k-vergi-dosya').click(); return; }
  if (t.id==='konum-al-kayit') { konumAlKayit(); return; }
  if (t.id==='aktif-liste-btn') { adminAktifListesi(); return; }
  if (t.id==='bekleyenler-btn') { adminAc(); return; }
}

function sayfaGit(sayfa) {
  document.querySelectorAll('.sayfa').forEach(function(s){s.classList.remove('aktif');});
  document.getElementById('sayfa-'+sayfa).classList.add('aktif');
  if (sayfa==='panel') panelYukle();
  if (sayfa==='harita') tamHaritaOlustur();
  if (sayfa==='kayit') kayitHaritaOlustur();
  if (sayfa==='ana'&&anaHarita) setTimeout(function(){anaHarita.invalidateSize();},100);
}

function anaHaritaOlustur(lat, lng) {
  if (anaHarita) { anaHarita.remove(); anaHarita = null; }
  anaHarita = L.map('ana-harita', { zoomControl: false, attributionControl: false }).setView([lat, lng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(anaHarita);
  var ki = L.divIcon({ html: '<div style="background:#ff6b35;width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>', iconSize:[14,14], iconAnchor:[7,7], className:'' });
  L.marker([lat, lng], { icon: ki }).addTo(anaHarita);
}

function anaHaritaEsnafEkle(esnaflar) {
  if (!anaHarita) return;
  esnaflar.forEach(function(e) {
    if (!e.lat || !e.lng) return;
    var ik = L.divIcon({ html: '<div style="background:#1a1a2e;color:#fff;padding:3px 8px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer">' + (ikonlar[e.kategori]||'🏪') + ' ' + e.ad + '</div>', className:'', iconAnchor:[0,8] });
    var m = L.marker([e.lat, e.lng], { icon: ik }).addTo(anaHarita);
    m.on('click', function() { esnafAc(e.id); });
  });
}

function tamHaritaOlustur() {
  setTimeout(function() {
    if (tamHarita) { tamHarita.remove(); tamHarita = null; }
    var lat = kullaniciLat || 36.8550, lng = kullaniciLng || 28.2753;
    tamHarita = L.map('tam-harita', { zoomControl: true, attributionControl: false }).setView([lat, lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(tamHarita);
    if (kullaniciLat) {
      var ki = L.divIcon({ html: '<div style="background:#ff6b35;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>', iconSize:[16,16], iconAnchor:[8,8], className:'' });
      L.marker([kullaniciLat, kullaniciLng], { icon: ki }).addTo(tamHarita).bindPopup('📍 Konumunuz').openPopup();
    }
    tumEsnaflar.forEach(function(e) {
      if (!e.lat || !e.lng) return;
      var ik = L.divIcon({ html: '<div style="background:#1a1a2e;color:#fff;padding:5px 10px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer">' + (ikonlar[e.kategori]||'🏪') + ' ' + e.ad + (e.mesafe_text ? ' · ' + e.mesafe_text : '') + '</div>', className:'', iconAnchor:[0,10] });
      var m = L.marker([e.lat, e.lng], { icon: ik }).addTo(tamHarita);
      m.on('click', function() { esnafAc(e.id); });
    });
    document.getElementById('harita-sayac').textContent = tumEsnaflar.length + ' esnaf yakin';
  }, 200);
}

function detayHaritaOlustur(elat, elng) {
  setTimeout(function() {
    if (detayHarita) { detayHarita.remove(); detayHarita = null; }
    var merkez = kullaniciLat ? [(kullaniciLat+elat)/2, (kullaniciLng+elng)/2] : [elat, elng];
    detayHarita = L.map('detay-harita', { zoomControl: false, attributionControl: false }).setView(merkez, 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(detayHarita);
    var ei = L.divIcon({ html: '<div style="background:#ff6b35;color:#fff;padding:5px 10px;border-radius:20px;font-size:11px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🏪 ' + secilenEsnaf.ad + '</div>', className:'', iconAnchor:[0,10] });
    L.marker([elat, elng], { icon: ei }).addTo(detayHarita);
    if (kullaniciLat) {
      var ki = L.divIcon({ html: '<div style="background:#1a1a2e;color:#fff;padding:5px 10px;border-radius:20px;font-size:11px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.3)">📍 Siz</div>', className:'', iconAnchor:[0,10] });
      L.marker([kullaniciLat, kullaniciLng], { icon: ki }).addTo(detayHarita);
      L.polyline([[kullaniciLat, kullaniciLng], [elat, elng]], { color:'#ff6b35', weight:3, dashArray:'6,6' }).addTo(detayHarita);
      detayHarita.fitBounds(L.latLngBounds([[kullaniciLat, kullaniciLng], [elat, elng]]), { padding:[30,30] });
    }
  }, 150);
}

function kayitHaritaOlustur() {
  if (kayitHarita) return;
  setTimeout(function() {
    var lat = kullaniciLat || 36.8550, lng = kullaniciLng || 28.2753;
    kayitHarita = L.map('kayit-harita', { zoomControl: true, attributionControl: false }).setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(kayitHarita);
    kayitHarita.on('click', function(e) { kayitKonumAyarla(e.latlng.lat, e.latlng.lng); });
  }, 300);
}

function kayitKonumAyarla(lat, lng) {
  document.getElementById('k-lat').value = lat;
  document.getElementById('k-lng').value = lng;
  if (kayitMarker) kayitHarita.removeLayer(kayitMarker);
  var ik = L.divIcon({ html: '<div style="background:#ff6b35;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>', iconSize:[16,16], iconAnchor:[8,8], className:'' });
  kayitMarker = L.marker([lat, lng], { icon: ik }).addTo(kayitHarita);
  fetch('https://nominatim.openstreetmap.org/reverse?lat='+lat+'&lon='+lng+'&format=json')
    .then(function(r){return r.json();}).then(function(d){
      var a = d.address;
      var adres = (a.road||'') + ' ' + (a.house_number||'') + ' ' + (a.town||a.city||a.village||'');
      document.getElementById('kayit-konum-text').textContent = adres.trim() || 'Konum secildi';
      if (!document.getElementById('k-adres').value) document.getElementById('k-adres').value = adres.trim();
    }).catch(function(){ document.getElementById('kayit-konum-text').textContent = lat.toFixed(4)+', '+lng.toFixed(4); });
}

function ulasimGoster(km) {
  if (!km) { document.getElementById('ulasim-bar').innerHTML = ''; return; }
  var y = Math.round(km/0.08), a = Math.round(km/0.5), t = Math.round(km/0.4);
  document.getElementById('ulasim-bar').innerHTML =
    '<div class="ulasim-btn active" data-ulasim="arac"><div class="u-icon">🚗</div><div class="u-sure">'+a+' dk</div><div class="u-label">Arac</div></div>' +
    '<div class="ulasim-btn" data-ulasim="yuruyus"><div class="u-icon">🚶</div><div class="u-sure">'+y+' dk</div><div class="u-label">Yuruyus</div></div>' +
    '<div class="ulasim-btn" data-ulasim="toplu"><div class="u-icon">🚌</div><div class="u-sure">'+t+' dk</div><div class="u-label">Toplu</div></div>' +
    '<button class="yol-btn" id="yol-tarifi-btn">🗺️ Yol</button>';
}

function konumAl() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(pos) {
      kullaniciLat = pos.coords.latitude; kullaniciLng = pos.coords.longitude;
      fetch('https://nominatim.openstreetmap.org/reverse?lat='+kullaniciLat+'&lon='+kullaniciLng+'&format=json')
        .then(function(r){return r.json();}).then(function(d){var a=d.address; document.getElementById('konum-text').textContent=a.town||a.city||a.village||a.county||'Konumunuz';}).catch(function(){document.getElementById('konum-text').textContent='Konum alindi';});
      anaHaritaOlustur(kullaniciLat, kullaniciLng);
      esnaflariYukle();
    }, function() { kullaniciLat=36.8550; kullaniciLng=28.2753; document.getElementById('konum-text').textContent='Marmaris, Mugla'; anaHaritaOlustur(kullaniciLat, kullaniciLng); esnaflariYukle(); });
  } else { kullaniciLat=36.8550; kullaniciLng=28.2753; document.getElementById('konum-text').textContent='Marmaris, Mugla'; anaHaritaOlustur(kullaniciLat, kullaniciLng); esnaflariYukle(); }
}

function konumAlKayit() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(pos) {
      kayitHarita.setView([pos.coords.latitude, pos.coords.longitude], 16);
      kayitKonumAyarla(pos.coords.latitude, pos.coords.longitude);
    }, function() { alert('Konum alinamadi!'); });
  }
}

function esnaflariYukle() {
  var liste = document.getElementById('esnaf-listesi');
  liste.innerHTML = '<div class="yukleniyor">Yukleniyor...</div>';
  var url = API+'/api/esnaflar?siralama='+secilenSiralama;
  if (secilenKategori !== 'tumu') url += '&kategori='+secilenKategori;
  if (kullaniciLat) url += '&lat='+kullaniciLat+'&lng='+kullaniciLng;
  var q = document.getElementById('arama').value;
  if (q) url += '&arama='+encodeURIComponent(q);
  fetch(url).then(function(r){return r.json();}).then(function(d){tumEsnaflar=d.veri; esnaflariGoster(tumEsnaflar); anaHaritaEsnafEkle(tumEsnaflar);}).catch(function(){liste.innerHTML='<div class="hata">API baglantisi kurulamadi.</div>';});
}

function esnaflariGoster(esnaflar) {
  var liste = document.getElementById('esnaf-listesi');
  if (!esnaflar.length) { liste.innerHTML='<div class="yukleniyor">Esnaf bulunamadi.</div>'; return; }
  var html = '';
  for (var i=0;i<esnaflar.length;i++) {
    var e = esnaflar[i];
    var mf = e.urunler.length ? Math.min.apply(null,e.urunler.map(function(u){return u.fiyat;})) : 0;
    html += '<div class="esnaf-card" data-esnaf-id="'+e.id+'">';
    html += '<div class="esnaf-card-top"><div class="esnaf-img">'+(ikonlar[e.kategori]||'🏪')+'</div>';
    html += '<div class="esnaf-info"><h4>'+e.ad+(e.onayli?' <span class="onay-rozet">Onaylı</span>':'')+'</h4>';
    html += '<div class="esnaf-meta"><span>⭐ '+e.puan+' ('+e.yorum_sayisi+')</span>'+(e.mesafe_text?'<span>📍 '+e.mesafe_text+'</span>':'')+'</div>';
    html += '<div class="esnaf-tags"><span class="tag open">'+(e.acik?'🟢 Acik':'🔴 Kapali')+'</span><span class="tag">'+e.kategori+'</span></div>';
    html += '</div></div><div class="esnaf-fiyat-bar"><span>'+e.urunler.length+' urun</span><span class="min-fiyat">₺'+mf+' den baslar</span></div></div>';
  }
  liste.innerHTML = html;
}

function esnafAc(id) {
  sayfaGit('detay'); sepet={}; sepetGuncelle();
  document.getElementById('detay-adi').textContent='Yukleniyor...';
  document.getElementById('tab-menu').innerHTML='<div class="yukleniyor">Yukleniyor...</div>';
  document.getElementById('ulasim-bar').innerHTML='';
  var url = API+'/api/esnaflar/'+id;
  if (kullaniciLat) url += '?lat='+kullaniciLat+'&lng='+kullaniciLng;
  fetch(url).then(function(r){return r.json();}).then(function(d){secilenEsnaf=d.veri; detayDoldur();}).catch(function(){document.getElementById('detay-adi').textContent='Hata!';});
}

function detayDoldur() {
  var e = secilenEsnaf;
  document.getElementById('hero-icon').textContent=ikonlar[e.kategori]||'🏪';
  document.getElementById('detay-adi').textContent=e.ad;
  document.getElementById('detay-puan').textContent='⭐ '+e.puan;
  document.getElementById('detay-mesafe').textContent='📍 '+(e.mesafe_text||e.ilce);
  document.getElementById('detay-yorum-sayi').textContent=e.yorum_sayisi+' yorum';
  document.getElementById('detay-durum').textContent=e.acik?'🟢 Acik':'🔴 Kapali';
  detayHaritaOlustur(e.lat, e.lng);
  ulasimGoster(e.mesafe_km);
  menuDoldur(); yorumlarDoldur(); tabSec('menu');
}

function menuDoldur() {
  var html = '';
  for (var i=0;i<secilenEsnaf.urunler.length;i++) {
    var u = secilenEsnaf.urunler[i];
    html += '<div class="menu-item">';
    if (u.fotograf_url) html += '<img src="'+u.fotograf_url+'" style="width:60px;height:60px;border-radius:10px;object-fit:cover;margin-right:10px;flex-shrink:0;cursor:pointer" data-foto="'+u.fotograf_url+'">';
    html += '<div class="menu-item-info"><h5>'+u.ad+'</h5><p>'+(u.aciklama||'')+'</p></div>';
    html += '<div style="display:flex;flex-direction:column;align-items:flex-end"><span class="menu-price">₺'+u.fiyat+'</span>';
    html += '<button class="add-btn" data-urun-id="'+u.id+'" data-urun-ad="'+u.ad+'" data-urun-fiyat="'+u.fiyat+'">+</button></div></div>';
  }
  document.getElementById('tab-menu').innerHTML = html;
}

function fotografBuyut(url) {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;z-index:9999;cursor:pointer';
  var img = document.createElement('img');
  img.src = url;
  img.style.cssText = 'max-width:90%;max-height:90%;border-radius:12px;object-fit:contain';
  overlay.appendChild(img);
  overlay.addEventListener('click', function() { document.body.removeChild(overlay); });
  document.body.appendChild(overlay);
}

function yorumlarDoldur() {
  if (!secilenEsnaf.yorumlar||!secilenEsnaf.yorumlar.length) { document.getElementById('tab-yorumlar').innerHTML='<div class="yukleniyor">Henuz yorum yok.</div>'; return; }
  var html = '';
  for (var i=secilenEsnaf.yorumlar.length-1;i>=0;i--) {
    var y=secilenEsnaf.yorumlar[i], yil='';
    for (var j=0;j<y.puan;j++) yil+='⭐';
    html+='<div class="yorum-card"><div class="yorum-header"><span class="yorum-kullanici">'+y.kullanici+'</span><span class="yorum-tarih">'+y.tarih+'</span></div>';
    html+='<div class="yorum-puan">'+yil+'</div><p class="yorum-text">'+y.yorum+'</p></div>';
  }
  document.getElementById('tab-yorumlar').innerHTML = html;
}

function tabSec(tab) {
  document.querySelectorAll('.detay-tab').forEach(function(t){t.classList.remove('active');});
  document.querySelector('[data-tab="'+tab+'"]').classList.add('active');
  document.getElementById('tab-menu').style.display=tab==='menu'?'block':'none';
  document.getElementById('tab-yorumlar').style.display=tab==='yorumlar'?'block':'none';
  document.getElementById('tab-yorum-ekle').style.display=tab==='yorum-ekle'?'block':'none';
}

function puanSec(p) {
  secilenPuan=p;
  document.querySelectorAll('.puan-yildiz').forEach(function(y,i){y.classList.toggle('aktif',i<p);});
}

function yorumGonder() {
  var k=document.getElementById('yorum-kullanici').value, y=document.getElementById('yorum-metin').value;
  if (!k||!y) { alert('Ad ve yorum zorunlu!'); return; }
  fetch(API+'/api/esnaflar/'+secilenEsnaf.id+'/yorumlar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kullanici:k,puan:secilenPuan,yorum:y})})
    .then(function(r){return r.json();}).then(function(){document.getElementById('yorum-kullanici').value=''; document.getElementById('yorum-metin').value=''; alert('Yorumunuz eklendi!'); esnafAc(secilenEsnaf.id);}).catch(function(){alert('Hata!');});
}

function sepeteEkle(id, ad, fiyat) {
  if (sepet[id]) sepet[id].adet++; else sepet[id]={id:id,ad:ad,fiyat:fiyat,adet:1};
  sepetGuncelle();
}

function sepetGuncelle() {
  var ul=Object.keys(sepet).map(function(k){return sepet[k];}), t=0, a=0;
  for (var i=0;i<ul.length;i++){t+=ul[i].fiyat*ul[i].adet; a+=ul[i].adet;}
  document.getElementById('sepet-btn').classList.toggle('gizli',a===0);
  document.getElementById('sepet-adet').textContent=a+' urun';
  document.getElementById('sepet-toplam').textContent='₺'+t;
}

function teslimatSec(tur) {
  secilenTeslimat=tur;
  document.getElementById('btn-kurye').classList.toggle('secili',tur==='kurye');
  document.getElementById('btn-gelal').classList.toggle('secili',tur==='gel-al');
}

function siparisVer() {
  var ul=Object.keys(sepet).map(function(k){return sepet[k];});
  if (!ul.length) return;
  fetch(API+'/api/siparisler',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({esnaf_id:secilenEsnaf.id,urunler:ul,teslimat_turu:secilenTeslimat,adres:'Test Adresi'})})
    .then(function(r){return r.json();}).then(function(d){alert('Siparissiniz alindi! #'+d.veri.id+' Toplam: ₺'+d.veri.genel_toplam); sepet={}; sepetGuncelle(); sayfaGit('ana');}).catch(function(){alert('Hata!');});
}

function panelYukle() { siparisleriYukle(); panelUrunleriYukle(); }

function siparisleriYukle() {
  var div=document.getElementById('panel-siparisler');
  fetch(API+'/api/siparisler').then(function(r){return r.json();}).then(function(d){
    var s=d.veri; document.getElementById('panel-siparis-sayi').textContent=s.length;
    var t=0; for (var i=0;i<s.length;i++) t+=s[i].genel_toplam||0;
    document.getElementById('panel-toplam').textContent='₺'+t;
    if (!s.length) { div.innerHTML='<div class="yukleniyor">Henuz siparis yok.</div>'; return; }
    var html='';
    for (var i=s.length-1;i>=0;i--) {
      var si=s[i], ua=si.urunler.map(function(u){return u.ad+' x'+u.adet;}).join(', ');
      html+='<div class="order-card"><div class="order-header"><span class="order-id">#'+si.id+'</span>';
      html+='<span class="order-badge '+(si.durum==='tamamlandi'?'badge-done':'badge-new')+'">'+(si.durum==='tamamlandi'?'Tamamlandi':'Yeni')+'</span></div>';
      html+='<div class="order-items">'+ua+'</div><div class="order-footer"><span class="order-price">₺'+si.genel_toplam+'</span>';
      if (si.durum!=='tamamlandi') html+='<button class="btn-accept" data-siparis-id="'+si.id+'">Tamam</button>';
      html+='</div></div>';
    }
    div.innerHTML=html;
  }).catch(function(){div.innerHTML='<div class="hata">Hata</div>';});
}

function siparisOnayla(id) {
  fetch(API+'/api/siparisler/'+id+'/durum',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({durum:'tamamlandi'})}).then(function(){siparisleriYukle();});
}

function panelUrunleriYukle() {
  var div=document.getElementById('panel-urunler');
  fetch(API+'/api/esnaflar/1').then(function(r){return r.json();}).then(function(d){
    var html='';
    for (var i=0;i<d.veri.urunler.length;i++) { var u=d.veri.urunler[i]; html+='<div class="prod-card"><div><h5>'+u.ad+'</h5><p>'+(u.aciklama||'')+'</p></div><span class="prod-price">₺'+u.fiyat+'</span></div>'; }
    div.innerHTML=html;
  }).catch(function(){div.innerHTML='<div class="hata">Hata</div>';});
}

function urunEkle() {
  var ad=prompt('Urun adi:'); if (!ad) return;
  var fiyat=prompt('Fiyat:'); if (!fiyat) return;
  fetch(API+'/api/esnaflar/1/urunler',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ad:ad,fiyat:parseFloat(fiyat)})}).then(function(){panelUrunleriYukle(); esnaflariYukle();});
}

function gorselAra(e) {
  var dosya=e.target.files[0]; if (!dosya) return;
  var fd=new FormData(); fd.append('fotograf',dosya);
  document.getElementById('esnaf-listesi').innerHTML='<div class="yukleniyor">📷 Analiz ediliyor...</div>';
  fetch(API+'/api/gorsel-ara',{method:'POST',body:fd})
    .then(function(r){return r.json();}).then(function(d){if(d.basari){tumEsnaflar=d.veri; esnaflariGoster(tumEsnaflar); anaHaritaEsnafEkle(tumEsnaflar); alert('📷 '+d.mesaj);}}).catch(function(){alert('Fotograf yuklenemedi!'); esnaflariYukle();});
  e.target.value='';
}

function urunSatirEkle() {
  var div=document.createElement('div');
  div.style.cssText='display:flex;gap:8px;margin-bottom:8px;align-items:center;flex-wrap:wrap';
  div.innerHTML='<input type="text" name="urun_adlari" placeholder="Urun adi" style="flex:2;min-width:120px;background:#fff;border:2px solid #eee;border-radius:10px;padding:9px;font-size:.82rem;outline:none;font-family:inherit"><input type="number" name="urun_fiyatlari" placeholder="Fiyat" style="flex:1;min-width:70px;background:#fff;border:2px solid #eee;border-radius:10px;padding:9px;font-size:.82rem;outline:none;font-family:inherit"><label style="cursor:pointer;background:#f5f5f5;border:2px solid #eee;border-radius:10px;padding:8px;font-size:1.1rem">📸<input type="file" name="urun_fotograflari" accept="image/*" style="display:none"></label>';
  document.getElementById('urun-girisleri').appendChild(div);
}

function kayitGonder() {
  var ad=document.getElementById('k-ad').value, kategori=document.getElementById('k-kategori').value;
  var ilce=document.getElementById('k-ilce').value, adres=document.getElementById('k-adres').value;
  var telefon=document.getElementById('k-telefon').value, email=document.getElementById('k-email').value;
  var vergi=document.getElementById('k-vergi').value;
  if (!ad||!kategori||!ilce||!telefon||!vergi) { alert('Lutfen yildizli alanlari doldurun!'); return; }
  var fd=new FormData();
  fd.append('ad',ad); fd.append('kategori',kategori); fd.append('ilce',ilce);
  fd.append('adres',adres); fd.append('telefon',telefon); fd.append('email',email); fd.append('vergi_no',vergi);
  var lat=document.getElementById('k-lat').value, lng=document.getElementById('k-lng').value;
  if (lat) { fd.append('lat',lat); fd.append('lng',lng); } else if (kullaniciLat) { fd.append('lat',kullaniciLat); fd.append('lng',kullaniciLng); }
  var uAdlari=document.querySelectorAll('[name="urun_adlari"]');
  var uFiyat=document.querySelectorAll('[name="urun_fiyatlari"]');
  var uFotograf=document.querySelectorAll('[name="urun_fotograflari"]');
  for (var i=0;i<uAdlari.length;i++) {
    if (uAdlari[i].value) {
      fd.append('urun_adlari',uAdlari[i].value);
      fd.append('urun_fiyatlari',uFiyat[i].value||'0');
      if (uFotograf[i]&&uFotograf[i].files[0]) fd.append('urun_fotograflari',uFotograf[i].files[0]);
    }
  }
  var vd=document.getElementById('k-vergi-dosya').files[0];
  if (vd) fd.append('vergi_levhasi',vd);
  document.getElementById('kayit-gonder').textContent='Gonderiliyor...';
  fetch(API+'/api/esnaf-kayit',{method:'POST',body:fd})
    .then(function(r){return r.json();}).then(function(d){
      if (d.basari) { alert('Kaydiniz alindi!'); window.open(d.whatsapp_url,'_blank'); sayfaGit('ana'); }
      else { alert('Hata: '+d.mesaj); }
      document.getElementById('kayit-gonder').textContent='Kayit Ol ve WhatsApp ile Onayla';
    }).catch(function(){alert('Baglanti hatasi!'); document.getElementById('kayit-gonder').textContent='Kayit Ol ve WhatsApp ile Onayla';});
}

function adminAc() {
  var key=prompt('Admin sifresi:'); if (!key) return;
  adminKey=key;
  fetch(API+'/api/admin/bekleyenler?key='+key)
    .then(function(r){return r.json();})
    .then(function(d){
      if (!d.basari) { alert('Yanlis sifre!'); return; }
      sayfaGit('admin');
      var esnaflar=d.veri;
      var html='<h3 style="font-size:.95rem;font-weight:800;margin-bottom:12px">Onay Bekleyenler ('+esnaflar.length+')</h3>';
      if (!esnaflar.length) html+='<div class="yukleniyor">Bekleyen esnaf yok.</div>';
      for (var i=0;i<esnaflar.length;i++) {
        var e=esnaflar[i];
        html+='<div class="admin-card"><h4 style="font-size:.95rem;margin-bottom:6px">'+e.ad+'</h4>';
        html+='<p style="font-size:.8rem;color:#666;margin-bottom:3px">📍 '+e.ilce+' — '+e.kategori+'</p>';
        html+='<p style="font-size:.8rem;color:#666;margin-bottom:3px">📞 '+e.telefon+'</p>';
        html+='<p style="font-size:.8rem;color:#666;margin-bottom:10px">🧾 '+e.vergi_no+'</p>';
        html+='<div style="display:flex;gap:8px">';
        html+='<button style="flex:1;background:#e8f5e9;color:#2e7d32;border:none;border-radius:10px;padding:9px;font-weight:700;cursor:pointer" data-onayla-id="'+e.id+'">✓ Onayla</button>';
        html+='<button style="flex:1;background:#ffebee;color:#c62828;border:none;border-radius:10px;padding:9px;font-weight:700;cursor:pointer" data-reddet-id="'+e.id+'">✗ Reddet</button>';
        html+='</div></div>';
      }
      html+='<button style="width:100%;background:#1a1a2e;color:#fff;border:none;border-radius:12px;padding:12px;font-weight:700;cursor:pointer;margin-top:12px" id="aktif-liste-btn">📋 Tum Esnaflar</button>';
      document.getElementById('admin-icerik').innerHTML=html;
    }).catch(function(){alert('Hata!');});
}

function adminOnayla(id) {
  fetch(API+'/api/admin/onayla/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:adminKey})})
    .then(function(r){return r.json();}).then(function(d){alert(d.mesaj); adminAc();}).catch(function(){alert('Hata!');});
}

function adminReddet(id) {
  if (!confirm('Silmek istediginizden emin misiniz?')) return;
  fetch(API+'/api/admin/reddet/'+id+'?key='+adminKey,{method:'DELETE'})
    .then(function(r){return r.json();}).then(function(d){alert(d.mesaj); adminAc();}).catch(function(){alert('Hata!');});
}

function adminAktifListesi() {
  fetch(API+'/api/admin/aktifler?key='+adminKey)
    .then(function(r){return r.json();})
    .then(function(d){
      if (!d.basari) { alert('Hata!'); return; }
      var esnaflar=d.veri;
      var html='<h3 style="font-size:.95rem;font-weight:800;margin-bottom:12px">Tum Esnaflar ('+esnaflar.length+')</h3>';
      for (var i=0;i<esnaflar.length;i++) {
        var e=esnaflar[i];
        html+='<div class="admin-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
        html+='<h4 style="font-size:.92rem">'+e.ad+'</h4>';
        html+='<span style="font-size:.75rem;padding:3px 8px;border-radius:20px;background:'+(e.onaylandi?'#e8f5e9':'#ffebee')+';color:'+(e.onaylandi?'#2e7d32':'#c62828')+'">'+(e.onaylandi?'✅ Aktif':'⏸️ Pasif')+'</span>';
        html+='</div><p style="font-size:.78rem;color:#666;margin-bottom:3px">📍 '+e.ilce+' — '+e.kategori+'</p>';
        html+='<p style="font-size:.78rem;color:#666;margin-bottom:8px">📞 '+e.telefon+'</p>';
        html+='<div style="display:flex;gap:6px;flex-wrap:wrap">';
        if (e.onaylandi) {
          html+='<button style="flex:1;background:#fff3e0;color:#e65100;border:none;border-radius:8px;padding:7px;font-size:.75rem;font-weight:700;cursor:pointer" data-pasif-id="'+e.id+'">⏸️ Yayindan Kaldir</button>';
        } else {
          html+='<button style="flex:1;background:#e8f5e9;color:#2e7d32;border:none;border-radius:8px;padding:7px;font-size:.75rem;font-weight:700;cursor:pointer" data-aktif-id="'+e.id+'">✅ Yayina Al</button>';
        }
        html+='<button style="flex:1;background:#ffebee;color:#c62828;border:none;border-radius:8px;padding:7px;font-size:.75rem;font-weight:700;cursor:pointer" data-sil-id="'+e.id+'">🗑️ Sil</button>';
        html+='</div></div>';
      }
      html+='<button style="width:100%;background:#ff6b35;color:#fff;border:none;border-radius:12px;padding:12px;font-weight:700;cursor:pointer;margin-top:12px" id="bekleyenler-btn">← Bekleyenlere Don</button>';
      document.getElementById('admin-icerik').innerHTML=html;
    }).catch(function(){alert('Hata!');});
}

function esnafPasifYap(id) {
  fetch(API+'/api/admin/pasif/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:adminKey})})
    .then(function(r){return r.json();}).then(function(d){alert(d.mesaj); adminAktifListesi();}).catch(function(){alert('Hata!');});
}

function esnafAktifYap(id) {
  fetch(API+'/api/admin/aktif/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:adminKey})})
    .then(function(r){return r.json();}).then(function(d){alert(d.mesaj); adminAktifListesi();}).catch(function(){alert('Hata!');});
}

function esnafSil(id) {
  if (!confirm('Kalici olarak silmek istediginizden emin misiniz?')) return;
  fetch(API+'/api/admin/sil/'+id+'?key='+adminKey,{method:'DELETE'})
    .then(function(r){return r.json();}).then(function(d){alert(d.mesaj); adminAktifListesi();}).catch(function(){alert('Hata!');});
}

window.addEventListener('load', init);