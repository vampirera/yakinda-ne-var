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
    method: 'POST', headers: jsonAuthHeader(),
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
    method: 'POST', headers: jsonAuthHeader(),
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
  var oturum = oturumAl(); // Token tabanlı auth — key artık gerekli değil
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

function adminVerileriYukle(sekme) {
  var icerik = document.getElementById('admin-icerik');
  icerik.innerHTML = '<div class="yukleniyor"></div>';

  if (sekme === 'ozet') {
    fetch(API_URL + '/api/admin/ozet', { headers: authHeader() }).then(function(r) { return r.json(); })
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
      fetch(API_URL + '/api/admin/bekleyenler', { headers: authHeader() }).then(function(r) { return r.json(); }),
      fetch(API_URL + '/api/admin/aktifler', { headers: authHeader() }).then(function(r) { return r.json(); })
    ]).then(function(results) {
      if (!results[0].basari) { icerik.innerHTML = '<div class="hata">Yetkisiz erisim.</div>'; return; }
      adminEsnaflarGoster(results[0].veri, results[1].veri || [], key);
    }).catch(function() { icerik.innerHTML = '<div class="hata">Baglanamadi.</div>'; });

  } else if (sekme === 'kuryeler') {
    fetch(API_URL + '/api/admin/kuryeler', { headers: authHeader() }).then(function(r) { return r.json(); })
    .then(function(result) {
      if (!result.basari) { icerik.innerHTML = '<div class="hata">Yetkisiz erisim.</div>'; return; }
      adminKuryelerGoster(result.veri || [], key);
    }).catch(function() { icerik.innerHTML = '<div class="hata">Baglanamadi.</div>'; });

  } else if (sekme === 'musteriler') {
    fetch(API_URL + '/api/admin/musteriler', { headers: authHeader() }).then(function(r) { return r.json(); })
    .then(function(result) {
      if (!result.basari) { icerik.innerHTML = '<div class="hata">Yetkisiz erisim.</div>'; return; }
      adminMusterilerGoster(result.veri || [], key);
    }).catch(function() { icerik.innerHTML = '<div class="hata">Baglanamadi.</div>'; });

  } else if (sekme === 'siparisler') {
    fetch(API_URL + '/api/admin/siparisler', { headers: authHeader() }).then(function(r) { return r.json(); })
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
          ? '<button onclick="adminIslem(\'pasif\',' + e.id + ')" style="flex:1;background:#fff3e0;color:#e65100;border:none;border-radius:8px;padding:8px;font-size:.75rem;font-weight:700;cursor:pointer">Yayından Al</button>'
          : '<button onclick="adminIslem(\'onayla\',' + e.id + ')" style="flex:1;background:#e8f5e9;color:#2e7d32;border:none;border-radius:8px;padding:8px;font-size:.75rem;font-weight:700;cursor:pointer">Onayla</button>'
        ) +
        '<button onclick="adminIslem(\'reddet\',' + e.id + ')" style="flex:1;background:#ffebee;color:#c62828;border:none;border-radius:8px;padding:8px;font-size:.75rem;font-weight:700;cursor:pointer">Reddet/Sil</button>' +
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
    headers: jsonAuthHeader(),
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
    headers: jsonAuthHeader(),
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
  fetch(API_URL + '/api/admin/kuryeler', { headers: authHeader() }).then(function(r) { return r.json(); })
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
          ? '<button onclick="kuryeIslem(\'onayla\',' + k.id + ')" style="flex:1;background:#e8f5e9;color:#2e7d32;border:none;border-radius:8px;padding:9px;font-size:.8rem;font-weight:700;cursor:pointer">Onayla</button>'
          : '') +
        '<button onclick="kuryeIslem(\'sil\',' + k.id + ')" style="flex:1;background:#ffebee;color:#c62828;border:none;border-radius:8px;padding:9px;font-size:.8rem;font-weight:700;cursor:pointer">Sil</button>' +
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

  fetch(API_URL + '/api/admin/siparisler', { headers: authHeader() }).then(function(r) { return r.json(); })
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
  fetch(API_URL + '/api/admin/musteri/' + id, { method: 'DELETE', headers: authHeader() })
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
    headers: jsonAuthHeader(),
    body: JSON.stringify({ durum: durum })
  }).then(function(r) { return r.json(); })
  .then(function(res) {
    if (res.basari) { adminModalKapat(); adminGoster('siparisler'); }
    else bildirim(res.mesaj, 'hata');
  });
}

function kuryeIslem(tip, id) {
  if (tip === 'sil' && !confirm('Kurye silinecek. Emin misiniz?')) return;
  var istek;
  if (tip === 'onayla') istek = fetch(API_URL + '/api/admin/kurye-onayla/' + id, { method: 'POST', headers: jsonAuthHeader(), body: JSON.stringify({}) });
  else if (tip === 'sil') istek = fetch(API_URL + '/api/admin/kurye-sil/' + id, { method: 'DELETE', headers: authHeader() });
  istek.then(function(r) { return r.json(); }).then(function(data) {
    if (!data.basari) { bildirim('Hata: ' + data.mesaj, 'hata'); return; }
    adminModalKapat();
    adminGoster('kuryeler');
  }).catch(function() { bildirim('Bağlantı hatası.', 'hata'); });
}

function adminIslem(tip, id) {
  var onay = { reddet: 'Esnaf reddedilip silinecek.', sil: 'Esnaf tamamen silinecek!' };
  if (onay[tip] && !confirm(onay[tip] + ' Emin misiniz?')) return;

  var istek;
  if (tip === 'onayla') istek = fetch(API_URL + '/api/admin/onayla/' + id, { method: 'POST', headers: jsonAuthHeader(), body: JSON.stringify({}) });
  else if (tip === 'pasif') istek = fetch(API_URL + '/api/admin/pasif/' + id, { method: 'POST', headers: jsonAuthHeader(), body: JSON.stringify({}) });
  else if (tip === 'aktif') istek = fetch(API_URL + '/api/admin/aktif/' + id, { method: 'POST', headers: jsonAuthHeader(), body: JSON.stringify({}) });
  else if (tip === 'reddet') istek = fetch(API_URL + '/api/admin/reddet/' + id, { method: 'DELETE', headers: authHeader() });
  else if (tip === 'sil')    istek = fetch(API_URL + '/api/admin/sil/' + id, { method: 'DELETE', headers: authHeader() });

  istek.then(function(r) { return r.json(); }).then(function(data) {
    if (!data.basari) { bildirim('Hata: ' + data.mesaj, 'hata'); return; }
    adminModalKapat();
    fcSil('esnaflar'); // frontend önbelleği temizle
    adminGoster('esnaflar');
  }).catch(function() { bildirim('Bağlantı hatası.', 'hata'); });
}

