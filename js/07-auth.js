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
    headers: jsonAuthHeader(),
    body: JSON.stringify({ telefon: telefon, sifre: sifre })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (btn) { btn.disabled = false; btn.textContent = orijinalMetin; }
      if (!data.basari) { bildirim(data.mesaj, 'hata'); return; }
      oturumKaydet(data.veri); // token data.veri.token içinde gelir
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

