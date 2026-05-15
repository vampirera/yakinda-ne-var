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
        headers: jsonAuthHeader(),
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
    headers: jsonAuthHeader(),
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
    headers: jsonAuthHeader(),
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
        headers: jsonAuthHeader(),
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
