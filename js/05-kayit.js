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

