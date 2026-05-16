// =============================================================
// ESNAF PANELİ — İÇERİK
// =============================================================

function panelYukle() {
  var esnafId = durum.panelEsnafId;
  if (!esnafId) return;
  var con = document.getElementById('panel-siparisler');
  con.innerHTML = '<div class="yukleniyor"></div>';
  fetch(API_URL + '/api/siparisler?esnaf_id=' + esnafId)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) { con.innerHTML = '<div class="hata">Hata.</div>'; return; }
      var siparisler = data.veri;
      var toplam = siparisler.reduce(function(t, s) { return t + parseFloat(s.genel_toplam || 0); }, 0);
      document.getElementById('panel-siparis-sayi').textContent = siparisler.length;
      document.getElementById('panel-toplam').textContent = '₺' + Math.round(toplam);

      if (!siparisler.length) { con.innerHTML = '<div class="yukleniyor">Henuz siparis yok.</div>'; return; }
      var durumMetin = { bekliyor: 'Bekliyor', hazirlaniyor: 'Hazırlanıyor', kurye_atandi: 'Kurye Atandı', yolda: 'Yolda', teslim_edildi: 'Teslim Edildi', tamamlandi: 'Tamamlandı', iptal: 'İptal' };
      var durumRenk  = { bekliyor: '#e65100', hazirlaniyor: '#1565c0', kurye_atandi: '#6a1b9a', yolda: '#0277bd', teslim_edildi: '#2e7d32', tamamlandi: '#388e3c', iptal: '#c62828' };
      con.innerHTML = siparisler.slice(0, 30).map(function(s) {
        var urunler = Array.isArray(s.urunler) ? s.urunler :
          (typeof s.urunler === 'string' ? JSON.parse(s.urunler) : []);
        var urunText = urunler.map(function(u) { return temizle(u.ad) + ' x' + parseInt(u.adet||0); }).join(', ');
        var sonDurum = s.durum === 'tamamlandi' || s.durum === 'teslim_edildi' || s.durum === 'iptal';
        var sonrakiButon = '';
        if (!sonDurum) {
          if (s.durum === 'bekliyor') {
            sonrakiButon = '<button class="btn-accept" style="background:#1565c0" onclick="panelSiparisDurum(' + s.id + ',\'hazirlaniyor\')">Hazırlanıyor</button>';
          } else if (s.durum === 'hazirlaniyor') {
            if (s.teslimat_turu === 'kurye') {
              sonrakiButon = '<button class="btn-accept" style="background:#0277bd" onclick="panelSiparisDurum(' + s.id + ',\'yolda\')">Yola Çıktı</button>';
            } else {
              sonrakiButon = '<button class="btn-accept" onclick="panelSiparisDurum(' + s.id + ',\'tamamlandi\')">Tamamlandı</button>';
            }
          } else if (s.durum === 'yolda' || s.durum === 'kurye_atandi') {
            sonrakiButon = '<button class="btn-accept" onclick="panelSiparisDurum(' + s.id + ',\'tamamlandi\')">Tamamlandı</button>';
          }
        }
        return '<div class="order-card">' +
          '<div class="order-header">' +
            '<span class="order-id">#' + s.id + '</span>' +
            '<span class="order-badge" style="background:' + (durumRenk[s.durum] || '#888') + ';color:#fff;border-radius:6px;padding:2px 7px;font-size:.68rem;font-weight:700">' + (durumMetin[s.durum] || s.durum) + '</span>' +
          '</div>' +
          '<div class="order-items">' + urunText +
            '<br><small>' + (s.teslimat_turu === 'kurye' ? '🛵 Kurye' : '🚶 Gel-Al') + (s.adres ? ' — ' + temizle(s.adres) : '') + '</small>' +
          '</div>' +
          '<div class="order-footer">' +
            '<span class="order-price">₺' + (parseFloat(s.genel_toplam) || 0) + '</span>' +
            sonrakiButon +
          '</div></div>';
      }).join('');
    })
    .catch(function() { con.innerHTML = '<div class="hata">Baglanamadi.</div>'; });

  panelUrunleriYukle(esnafId);
  calismaSaatleriYukle(esnafId);
  kampanyalariYukle(esnafId);
  panelIstatistikYukle();
  panelProfilFormYukle(esnafId);
  randevuAyarlariniYukle(esnafId);
  hizmetleriYukle(esnafId);
  randevulariYukle();
  panelIlanlarYukle();
}

function panelIstatistikYukle() {
  var esnafId = durum.panelEsnafId;
  if (!esnafId) return;
  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/istatistik', { headers: authHeader() })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) return;
      var v = data.veri;

      // Özet sayılar
      document.getElementById('stat-hafta-sayi').textContent   = v.hafta.sayi;
      document.getElementById('stat-hafta-tutar').textContent  = '₺' + Math.round(v.hafta.tutar);
      document.getElementById('stat-ay-sayi').textContent      = v.ay.sayi;
      document.getElementById('stat-ay-tutar').textContent     = '₺' + Math.round(v.ay.tutar);
      document.getElementById('stat-toplam-sayi').textContent  = v.toplam.sayi;
      document.getElementById('stat-toplam-tutar').textContent = '₺' + Math.round(v.toplam.tutar);
      document.getElementById('panel-goruntuleme').textContent  = v.goruntuleme;

      var enCok = document.getElementById('stat-en-cok');
      enCok.style.display = '';

      // ── En çok satanlar ──────────────────────────────────
      var enCokHtml = '';
      if (v.en_cok_satanlar.length) {
        enCokHtml += '<div style="font-size:.72rem;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">En Çok Satan Ürünler</div>' +
          v.en_cok_satanlar.map(function(u, i) {
            var madalya = ['🥇','🥈','🥉','4.','5.'][i] || '';
            var maxAdet = v.en_cok_satanlar[0].adet || 1;
            var yuzde = Math.round((u.adet / maxAdet) * 100);
            return '<div style="margin-bottom:8px">' +
              '<div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:3px">' +
                '<span>' + madalya + ' ' + temizle(u.ad) + '</span>' +
                '<span style="font-weight:800;color:#ff6b35">' + u.adet + ' adet</span>' +
              '</div>' +
              '<div style="background:#f0f0f0;border-radius:6px;height:5px">' +
                '<div style="background:#ff6b35;height:5px;border-radius:6px;width:' + yuzde + '%;transition:width .5s"></div>' +
              '</div>' +
            '</div>';
          }).join('');
      }

      // ── Ek istatistikler: ort tutar, tekrar müşteri, teslimat ──
      var kurye = v.teslimat_dagilim['kurye'] || 0;
      var gelal = v.teslimat_dagilim['gel-al'] || 0;
      var topTeslimat = kurye + gelal || 1;
      enCokHtml += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px">' +
        _statMiniKart('💰', 'Ort. Sipariş', '₺' + (v.ay.ort_tutar || 0), '#ff6b35') +
        _statMiniKart('🔄', 'Sadık Müşteri', v.tekrar_musteri + ' kişi', '#2e7d32') +
        _statMiniKart('🛵', 'Kurye', Math.round(kurye/topTeslimat*100) + '%', '#6a1b9a') +
        _statMiniKart('🚶', 'Gel-Al', Math.round(gelal/topTeslimat*100) + '%', '#1565c0') +
      '</div>';

      // ── Son 7 gün mini bar chart ──────────────────────────
      if (v.yedi_gun && v.yedi_gun.length) {
        var maxSayi = Math.max.apply(null, v.yedi_gun.map(function(g) { return g.sayi; })) || 1;
        enCokHtml += '<div style="margin-top:14px">' +
          '<div style="font-size:.72rem;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Son 7 Gün</div>' +
          '<div style="display:flex;align-items:flex-end;gap:4px;height:60px">' +
          v.yedi_gun.map(function(g) {
            var yuzde = Math.max(4, Math.round((g.sayi / maxSayi) * 100));
            var gun = new Date(g.gun).toLocaleDateString('tr-TR', { weekday: 'short' });
            return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">' +
              '<div style="font-size:.6rem;color:#888;font-weight:700">' + (g.sayi || '') + '</div>' +
              '<div style="width:100%;background:' + (g.sayi ? '#ff6b35' : '#f0f0f0') + ';border-radius:4px 4px 0 0;height:' + yuzde + '%;min-height:4px;transition:height .5s"></div>' +
              '<div style="font-size:.6rem;color:#aaa">' + gun + '</div>' +
            '</div>';
          }).join('') +
          '</div></div>';
      }

      // ── Saatlik yoğunluk (sadece aktif saatler) ────────────
      var aktifSaatler = (v.saatlik_dagilim || []).filter(function(s) { return s.sayi > 0; });
      if (aktifSaatler.length) {
        var maxSaatSayi = Math.max.apply(null, aktifSaatler.map(function(s) { return s.sayi; })) || 1;
        var zirve = aktifSaatler.reduce(function(a, b) { return a.sayi >= b.sayi ? a : b; });
        enCokHtml += '<div style="margin-top:14px">' +
          '<div style="font-size:.72rem;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Zirve Saatler <span style="font-weight:400;color:#ff6b35">(en yoğun: ' + zirve.saat + ':00)</span></div>' +
          '<div style="display:flex;align-items:flex-end;gap:2px;height:40px;overflow-x:auto">' +
          (v.saatlik_dagilim || []).filter(function(s) { return s.saat >= 7 && s.saat <= 23; }).map(function(s) {
            var yuzde = Math.max(4, Math.round((s.sayi / maxSaatSayi) * 100));
            return '<div style="flex:1;min-width:10px;display:flex;flex-direction:column;align-items:center;gap:2px">' +
              '<div style="width:100%;background:' + (s.sayi ? '#1565c0' : '#f0f0f0') + ';border-radius:2px 2px 0 0;height:' + yuzde + '%;min-height:2px"></div>' +
              '<div style="font-size:.52rem;color:#bbb">' + s.saat + '</div>' +
            '</div>';
          }).join('') +
          '</div></div>';
      }

      enCok.innerHTML = enCokHtml;
    })
    .catch(function() {});
}

function _statMiniKart(ikon, baslik, deger, renk) {
  return '<div style="background:#f9f9f9;border-radius:10px;padding:10px;border-left:3px solid ' + renk + '">' +
    '<div style="font-size:1rem;margin-bottom:2px">' + ikon + '</div>' +
    '<div style="font-size:.68rem;color:#888;font-weight:600">' + baslik + '</div>' +
    '<div style="font-size:.95rem;font-weight:800;color:#1a1a2e">' + deger + '</div>' +
  '</div>';
}

function panelProfilFormYukle(esnafId) {
  fetch(API_URL + '/api/esnaflar/' + esnafId)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) return;
      var e = data.veri;
      var adEl = document.getElementById('panel-profil-ad');
      var telEl = document.getElementById('panel-profil-telefon');
      var adrEl = document.getElementById('panel-profil-adres');
      var katEl = document.getElementById('panel-profil-kategori');
      var igEl  = document.getElementById('panel-profil-instagram');
      var gmEl  = document.getElementById('panel-profil-gmaps');
      if (adEl)  adEl.value  = e.ad || '';
      if (telEl) telEl.value = e.telefon || '';
      if (adrEl) adrEl.value = e.adres || '';
      if (katEl) katEl.value = e.kategori || 'yemek';
      if (igEl)  igEl.value  = e.instagram_url || '';
      if (gmEl)  gmEl.value  = e.google_maps_url || '';

      // Kapak fotoğrafı önizleme
      var preview = document.getElementById('kapak-foto-preview');
      if (preview) {
        if (e.kapak_foto) {
          preview.innerHTML = '<img src="' + e.kapak_foto + '" style="width:100%;height:100%;object-fit:cover;border-radius:10px">';
          preview.style.display = 'block';
        } else {
          preview.innerHTML = '';
          preview.style.display = 'none';
        }
      }

      // İlan bildirimi toggle
      var ilanToggle  = document.getElementById('ilan-bildirimi-toggle');
      var ilanSlider  = document.getElementById('ilan-bildirimi-slider');
      var ilanKnob    = document.getElementById('ilan-bildirimi-knob');
      var aktif = e.ilan_bildirimi !== false; // varsayılan true
      if (ilanToggle) ilanToggle.checked = aktif;
      if (ilanSlider) ilanSlider.style.background = aktif ? '#ff6b35' : '#ccc';
      if (ilanKnob)   ilanKnob.style.transform = aktif ? 'translateX(20px)' : 'translateX(0)';

      // Onay durumu banneri
      var bannerEl = document.getElementById('panel-onay-banner');
      if (bannerEl) {
        if (!e.onaylandi) {
          bannerEl.style.display = 'block';
          fetch(API_URL + '/api/config').then(function(r){return r.json();}).then(function(cfg){
            var waBtn = document.getElementById('panel-onay-wa-btn');
            if (waBtn && cfg.admin_wa) {
              var msg = encodeURIComponent('Merhaba! Yakinda Ne Var uygulamasindaki ' + e.ad + ' isletmemi onaylar misiniz? Kayit ID: ' + esnafId);
              waBtn.href = cfg.admin_wa + '?text=' + msg;
            }
          }).catch(function(){});
        } else {
          bannerEl.style.display = 'none';
        }
      }
    })
    .catch(function() {});
}

function panelProfilKaydet() {
  var esnafId = durum.panelEsnafId;
  if (!esnafId) { bildirim('Esnaf ID bulunamadı.', 'uyari'); return; }
  var ad       = document.getElementById('panel-profil-ad').value.trim();
  var telefon  = document.getElementById('panel-profil-telefon').value.trim();
  var adres    = document.getElementById('panel-profil-adres').value.trim();
  var kategori = document.getElementById('panel-profil-kategori').value;
  var instagram_url   = document.getElementById('panel-profil-instagram').value.trim();
  var google_maps_url = document.getElementById('panel-profil-gmaps').value.trim();
  if (!ad || !telefon) { bildirim('Ad ve telefon zorunludur.', 'uyari'); return; }
  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/profil', {
    method: 'PUT',
    headers: jsonAuthHeader(),
    body: JSON.stringify({ ad: ad, telefon: telefon, adres: adres, kategori: kategori, instagram_url: instagram_url, google_maps_url: google_maps_url })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      bildirim(data.mesaj || (data.basari ? 'Profil kaydedildi.' : 'Hata oluştu.'), data.basari ? 'basari' : 'hata');
    })
    .catch(function() { bildirim('Bağlanamadı.', 'hata'); });
}

function kapakFotoYukle(input) {
  if (!input.files || !input.files[0]) return;
  var esnafId = durum.panelEsnafId;
  if (!esnafId) { bildirim('Esnaf ID bulunamadı.', 'uyari'); return; }
  var btn = document.getElementById('kapak-foto-btn');
  if (btn) btn.textContent = '⏳ Yükleniyor...';
  var fd = new FormData();
  fd.append('kapak_foto', input.files[0]);
  fetch(API_URL + '/api/esnaflar/' + esnafId + '/kapak-foto', { method: 'POST', body: fd })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (btn) btn.textContent = '📷 Kapak Fotoğrafı Yükle';
      if (!data.basari) { bildirim(data.mesaj || 'Yükleme başarısız.', 'hata'); return; }
      bildirim('Kapak fotoğrafı güncellendi!', 'basari');
      var preview = document.getElementById('kapak-foto-preview');
      if (preview) {
        preview.innerHTML = '<img src="' + data.url + '" style="width:100%;height:100%;object-fit:cover;border-radius:10px">';
        preview.style.display = 'block';
      }
    })
    .catch(function() {
      if (btn) btn.textContent = '📷 Kapak Fotoğrafı Yükle';
      bildirim('Bağlanamadı.', 'hata');
    });
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
  if (!esnafId) { bildirim('Önce Esnaf ID girin.', 'uyari'); return; }
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
    headers: jsonAuthHeader(),
    body: JSON.stringify({ calisma_saatleri: saatler })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      bildirim(data.mesaj || (data.basari ? 'Kaydedildi.' : 'Hata.'), data.basari ? 'basari' : 'hata');
    })
    .catch(function() { bildirim('Bağlanamadı.', 'hata'); });
}

// Ürün Yönetimi
function panelUrunleriYukle(esnafId) {
  var con = document.getElementById('panel-urunler');
  con.innerHTML = '<div class="yukleniyor"></div>';
  fetch(API_URL + '/api/esnaflar/' + esnafId)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) { con.innerHTML = '<div class="hata">Yüklenemedi.</div>'; return; }
      var urunler = data.veri.urunler || [];
      if (!urunler.length) { con.innerHTML = '<div style="color:#aaa;font-size:.82rem;padding:6px 0">Henüz ürün eklenmemiş.</div>'; return; }
      con.innerHTML = urunler.map(function(u) {
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0">' +
          '<div style="flex:1">' +
            '<div style="font-size:.84rem;font-weight:700">' + temizle(u.ad) + '</div>' +
            (u.aciklama ? '<div style="font-size:.72rem;color:#888">' + temizle(u.aciklama) + '</div>' : '') +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            '<span style="font-weight:800;color:#ff6b35;font-size:.88rem">₺' + parseFloat(u.fiyat || 0).toFixed(2) + '</span>' +
            '<button onclick="urunSil(' + esnafId + ',' + u.id + ')" style="background:#ffebee;color:#c62828;border:none;border-radius:6px;padding:4px 8px;font-size:.72rem;cursor:pointer">Sil</button>' +
          '</div>' +
        '</div>';
      }).join('');
    });
}

function urunFormAc() {
  document.getElementById('urun-ekle-form').style.display = '';
  document.getElementById('urun-ekle-btn').style.display = 'none';
  document.getElementById('urun-ad').focus();
}

function urunFormKapat() {
  document.getElementById('urun-ekle-form').style.display = 'none';
  document.getElementById('urun-ekle-btn').style.display = '';
  document.getElementById('urun-ad').value = '';
  document.getElementById('urun-fiyat').value = '';
  document.getElementById('urun-aciklama').value = '';
}

function urunEkle() {
  var esnafId = durum.panelEsnafId;
  if (!esnafId) return;
  var ad = document.getElementById('urun-ad').value.trim();
  var fiyat = document.getElementById('urun-fiyat').value;
  var aciklama = document.getElementById('urun-aciklama').value.trim();
  if (!ad) { bildirim('Ürün adı zorunlu.', 'uyari'); return; }
  fetch(API_URL + '/api/esnaflar/' + esnafId + '/urunler', {
    method: 'POST',
    headers: jsonAuthHeader(),
    body: JSON.stringify({ ad: ad, fiyat: fiyat, aciklama: aciklama })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) { bildirim(data.mesaj, 'hata'); return; }
      bildirim('Ürün eklendi!', 'basari');
      urunFormKapat();
      panelUrunleriYukle(esnafId);
    })
    .catch(function() { bildirim('Bağlanamadı.', 'hata'); });
}

function urunSil(esnafId, urunId) {
  if (!confirm('Ürün silinecek. Emin misiniz?')) return;
  fetch(API_URL + '/api/esnaflar/' + esnafId + '/urunler/' + urunId, { method: 'DELETE', headers: authHeader() })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.basari) { bildirim('Ürün silindi.', 'basari'); panelUrunleriYukle(esnafId); }
      else bildirim(data.mesaj, 'hata');
    });
}

function kampanyalariYukle(esnafId) {
  fetch(API_URL + '/api/esnaflar/' + esnafId)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) return;
      var liste = data.veri.kampanyalar || [];
      var con = document.getElementById('panel-kampanyalar-liste');
      if (!liste.length) { con.innerHTML = '<div style="color:#aaa;font-size:.82rem;padding:6px 0">Aktif kampanya yok.</div>'; return; }
      con.innerHTML = liste.map(function(k) {
        var bitis = k.bitis_tarihi ? new Date(k.bitis_tarihi).toLocaleDateString('tr-TR') : '—';
        return '<div class="kampanya-satir">' +
          '<div class="kampanya-satir-bilgi">' +
            '<b>' + temizle(k.baslik) + '</b>' +
            (k.indirim_orani ? ' <span class="kampanya-rozet">%' + k.indirim_orani + '</span>' : '') +
            '<div style="font-size:.72rem;color:#888">' + temizle(k.aciklama || '') + ' · Son: ' + temizle(bitis) + '</div>' +
          '</div>' +
          '<button class="kampanya-sil-btn" onclick="kampanyaSil(' + esnafId + ',' + k.id + ')">🗑</button>' +
        '</div>';
      }).join('');
    });
}

function kampanyaEkle() {
  var esnafId = durum.panelEsnafId;
  if (!esnafId) { bildirim('Önce Esnaf ID yükleyin.', 'uyari'); return; }
  var baslik = document.getElementById('kamp-baslik').value.trim();
  var aciklama = document.getElementById('kamp-aciklama').value.trim();
  var oran = document.getElementById('kamp-oran').value;
  var bitis = document.getElementById('kamp-bitis').value;
  if (!baslik) { bildirim('Başlık zorunlu.', 'uyari'); return; }
  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/kampanya', {
    method: 'POST',
    headers: jsonAuthHeader(),
    body: JSON.stringify({ baslik: baslik, aciklama: aciklama, indirim_orani: oran, bitis_tarihi: bitis || null })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) { bildirim(data.mesaj, 'hata'); return; }
      document.getElementById('kamp-baslik').value = '';
      document.getElementById('kamp-aciklama').value = '';
      document.getElementById('kamp-oran').value = '';
      document.getElementById('kamp-bitis').value = '';
      kampanyalariYukle(esnafId);
    })
    .catch(function() { bildirim('Bağlanamadı.', 'hata'); });
}

function kampanyaSil(esnafId, kampanyaId) {
  if (!confirm('Kampanya silinecek. Emin misiniz?')) return;
  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/kampanya/' + kampanyaId, { method: 'DELETE', headers: authHeader() })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.basari) kampanyalariYukle(esnafId);
      else bildirim(data.mesaj, 'hata');
    });
}

function siparisKabul(id) {
  panelSiparisDurum(id, 'tamamlandi');
}

function panelSiparisDurum(id, yeniDurum) {
  fetch(API_URL + '/api/siparisler/' + id + '/durum', {
    method: 'PUT',
    headers: jsonAuthHeader(),
    body: JSON.stringify({ durum: yeniDurum })
  })
    .then(function(r) { return r.json(); })
    .then(function() { panelYukle(); });
}

// =============================================================
// RANDEVU SİSTEMİ — ESNAF PANELİ
// =============================================================

// Global indirimli saatler state
var _indirimliSaatler = {};

function _indirimSaatleriniGoster() {
  var liste = document.getElementById('indirimli-saatler-liste');
  if (!liste) return;
  var anahtarlar = Object.keys(_indirimliSaatler).sort(function(a, b) { return parseInt(a) - parseInt(b); });
  if (!anahtarlar.length) {
    liste.innerHTML = '<span style="font-size:.7rem;color:#aaa">Henüz indirim saati eklenmedi</span>';
    return;
  }
  liste.innerHTML = anahtarlar.map(function(s) {
    return '<div style="display:flex;align-items:center;gap:4px;background:#fff;border:1px solid #ffd5c2;border-radius:6px;padding:3px 8px">' +
      '<span style="font-size:.75rem;font-weight:700">' + s + ':00</span>' +
      '<span style="font-size:.72rem;color:#ff6b35;font-weight:800">%' + _indirimliSaatler[s] + '</span>' +
      '<button onclick="indirimSaatSil(\'' + s + '\')" style="background:none;border:none;color:#ccc;cursor:pointer;font-size:.8rem;padding:0 2px;line-height:1">✕</button>' +
    '</div>';
  }).join('');
}

function indirimSaatEkle() {
  var saat = document.getElementById('indirim-saat').value;
  var oran = parseInt(document.getElementById('indirim-oran').value);
  if (!saat) { bildirim('Saat seçin.', 'uyari'); return; }
  if (!oran || oran < 5 || oran > 50) { bildirim('İndirim %5 ile %50 arasında olmalı.', 'uyari'); return; }
  _indirimliSaatler[saat] = oran;
  document.getElementById('indirim-oran').value = '';
  document.getElementById('indirim-saat').value = '';
  _indirimSaatleriniGoster();
}

function indirimSaatSil(saat) {
  delete _indirimliSaatler[saat];
  _indirimSaatleriniGoster();
}

function panelIlanlarYukle() {
  var esnafId = durum.panelEsnafId;
  if (!esnafId) return;
  var con = document.getElementById('panel-ilanlar-liste');
  if (!con) return;
  // Esnaf kategorisini al — aynı kategorideki ilanları göster
  fetch(API_URL + '/api/esnaflar/' + esnafId)
    .then(function(r) { return r.json(); })
    .then(function(esnafData) {
      var kategori = esnafData.basari && esnafData.veri ? esnafData.veri.kategori : '';
      var url = API_URL + '/api/is-ilanlari' + (kategori ? '?kategori=' + encodeURIComponent(kategori) : '');
      return fetch(url).then(function(r) { return r.json(); });
    })
    .then(function(data) {
      var ilanlar = data.basari ? data.veri : [];
      if (!ilanlar.length) { con.innerHTML = '<div style="color:#aaa;font-size:.82rem;text-align:center;padding:10px">Kategorinizde açık ilan yok.</div>'; return; }
      con.innerHTML = ilanlar.map(function(ilan) {
        var fotoHTML = ilan.fotograf_url
          ? '<div style="margin:6px 0;border-radius:8px;overflow:hidden;height:90px"><img src="' + ilan.fotograf_url + '" style="width:100%;height:100%;object-fit:cover"></div>'
          : '';
        return '<div style="border:1px solid #f0f0f0;border-radius:12px;padding:10px;margin-bottom:8px;background:#fff">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">' +
            '<div style="font-weight:700;font-size:.82rem;flex:1;padding-right:8px">' + temizle(ilan.baslik) + '</div>' +
            '<span style="font-size:.66rem;color:#888;white-space:nowrap;background:#f5f5f5;padding:2px 6px;border-radius:6px">👥 ' + ilan.teklif_sayisi + '</span>' +
          '</div>' +
          fotoHTML +
          (ilan.aciklama ? '<div style="font-size:.72rem;color:#666;margin-bottom:4px">' + temizle(ilan.aciklama.slice(0,80)) + (ilan.aciklama.length > 80 ? '...' : '') + '</div>' : '') +
          (ilan.butce_min ? '<div style="font-size:.72rem;color:#2e7d32;font-weight:700;margin-bottom:6px">₺' + ilan.butce_min + (ilan.butce_max ? '–₺' + ilan.butce_max : '+') + '</div>' : '') +
          '<button onclick="panelTeklifModal(' + ilan.id + ',\'' + temizle(ilan.baslik||'').replace(/'/g, '') + '\')" style="width:100%;background:#ff6b35;color:#fff;border:none;border-radius:8px;padding:9px;font-size:.76rem;font-weight:700;cursor:pointer">🙋 İlgileniyorum</button>' +
        '</div>';
      }).join('');
    }).catch(function() { con.innerHTML = '<div class="hata">Yüklenemedi.</div>'; });
}

function panelTeklifModal(ilanId, ilanBaslik) {
  var html = '<div style="padding:4px">' +
    '<h3 style="font-size:.9rem;margin:0 0 4px">🙋 İlgileniyorum</h3>' +
    '<div style="font-size:.78rem;color:#888;margin-bottom:14px;line-height:1.5">' + ilanBaslik + '</div>' +
    '<textarea id="teklif-aciklama" class="form-input" placeholder="Müşteriye mesajınız — kendinizi tanıtın, ne sunabileceğinizi yazın..." rows="4" style="resize:none;margin-bottom:8px"></textarea>' +
    '<div style="display:flex;gap:8px;margin-bottom:14px">' +
      '<div style="flex:1">' +
        '<div style="font-size:.72rem;color:#888;margin-bottom:4px">Fiyat teklifi (opsiyonel)</div>' +
        '<input id="teklif-fiyat" type="number" class="form-input" placeholder="₺" min="0" style="margin:0">' +
      '</div>' +
    '</div>' +
    '<div style="background:#fff8f5;border-radius:10px;padding:10px;margin-bottom:14px;font-size:.72rem;color:#888">📲 Müşteri bildirim alacak ve sizinle iletişime geçebilecek.</div>' +
    '<button onclick="panelTeklifGonder(' + ilanId + ')" style="width:100%;background:#ff6b35;color:#fff;border:none;border-radius:12px;padding:13px;font-size:.88rem;font-weight:700;cursor:pointer">Yanıt Gönder</button>' +
  '</div>';
  adminModalAc(html);
}

function panelTeklifGonder(ilanId) {
  var esnafId = durum.panelEsnafId;
  if (!esnafId) return;
  var aciklama = document.getElementById('teklif-aciklama').value.trim();
  if (!aciklama) { bildirim('Müşteriye bir mesaj yazın.', 'uyari'); return; }
  var fiyat = document.getElementById('teklif-fiyat').value;
  fetch(API_URL + '/api/is-ilani/' + ilanId + '/teklif', {
    method: 'POST',
    headers: jsonAuthHeader(),
    body: JSON.stringify({
      esnaf_id: esnafId,
      fiyat: fiyat ? parseFloat(fiyat) : null,
      aciklama: aciklama
    })
  }).then(function(r) { return r.json(); })
  .then(function(data) {
    bildirim(data.mesaj || (data.basari ? 'Yanıt gönderildi!' : 'Hata.'), data.basari ? 'basari' : 'hata');
    if (data.basari) { adminModalKapat(); panelIlanlarYukle(); }
  });
}

function randevuAyarlariniYukle(esnafId) {
  // Saat seçeneklerini doldur (7-23)
  var saatSel = document.getElementById('indirim-saat');
  if (saatSel && saatSel.options.length <= 1) {
    for (var s = 7; s <= 22; s++) {
      var opt = document.createElement('option');
      opt.value = String(s);
      opt.textContent = (s < 10 ? '0' : '') + s + ':00';
      saatSel.appendChild(opt);
    }
  }

  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/randevu-ayar', { headers: authHeader() })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) return;
      var v = data.veri;
      var toggle = document.getElementById('randevu-modu-toggle');
      var slider = document.getElementById('randevu-toggle-slider');
      var knob = document.getElementById('randevu-toggle-knob');
      if (toggle) {
        toggle.checked = !!v.randevu_modu;
        slider.style.background = v.randevu_modu ? '#ff6b35' : '#ccc';
        knob.style.transform = v.randevu_modu ? 'translateX(20px)' : 'translateX(0)';
      }
      var slotEl = document.getElementById('randevu-slot-suresi');
      if (slotEl) slotEl.value = v.slot_suresi || 30;
      _indirimliSaatler = v.indirimli_saatler || {};
      _indirimSaatleriniGoster();
    });
}

function ilanBildirimiToggle() {
  var esnafId = durum.panelEsnafId;
  if (!esnafId) return;
  var toggle = document.getElementById('ilan-bildirimi-toggle');
  var slider = document.getElementById('ilan-bildirimi-slider');
  var knob   = document.getElementById('ilan-bildirimi-knob');
  var aktif  = toggle.checked;
  slider.style.background = aktif ? '#ff6b35' : '#ccc';
  knob.style.transform    = aktif ? 'translateX(20px)' : 'translateX(0)';
  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/ilan-bildirimi', {
    method: 'PUT',
    headers: jsonAuthHeader(),
    body: JSON.stringify({ aktif: aktif })
  }).then(function(r) { return r.json(); })
  .then(function(data) { bildirim(data.mesaj, data.basari ? 'basari' : 'hata'); })
  .catch(function() { bildirim('Bağlantı hatası.', 'hata'); });
}

function randevuModuToggle() {
  var toggle = document.getElementById('randevu-modu-toggle');
  var slider = document.getElementById('randevu-toggle-slider');
  var knob = document.getElementById('randevu-toggle-knob');
  slider.style.background = toggle.checked ? '#ff6b35' : '#ccc';
  knob.style.transform = toggle.checked ? 'translateX(20px)' : 'translateX(0)';
}

function randevuAyarKaydet() {
  var esnafId = durum.panelEsnafId;
  if (!esnafId) return;
  var modu = document.getElementById('randevu-modu-toggle').checked;
  var sure = parseInt(document.getElementById('randevu-slot-suresi').value) || 30;
  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/randevu-ayar', {
    method: 'PUT',
    headers: jsonAuthHeader(),
    body: JSON.stringify({ randevu_modu: modu, slot_suresi: sure, indirimli_saatler: _indirimliSaatler })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) { bildirim(data.mesaj || (data.basari ? 'Kaydedildi.' : 'Hata.'), data.basari ? 'basari' : 'hata'); });
}

function hizmetleriYukle(esnafId) {
  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/hizmetler', { headers: authHeader() })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) return;
      var con = document.getElementById('panel-hizmetler-liste');
      if (!data.veri.length) { con.innerHTML = '<div style="color:#aaa;font-size:.82rem;padding:4px 0">Henüz hizmet eklenmedi.</div>'; return; }
      con.innerHTML = data.veri.map(function(h) {
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #f0f0f0">' +
          '<div>' +
            '<span style="font-size:.84rem;font-weight:700">' + temizle(h.ad) + '</span>' +
            '<span style="font-size:.75rem;color:#888;margin-left:6px">' + h.sure + ' dk · ₺' + h.fiyat + '</span>' +
          '</div>' +
          '<button onclick="hizmetSil(' + esnafId + ',' + h.id + ')" style="background:none;border:none;color:#ff4444;cursor:pointer;font-size:1rem">🗑</button>' +
        '</div>';
      }).join('');
    });
}

function hizmetEkle() {
  var esnafId = durum.panelEsnafId;
  if (!esnafId) return;
  var ad = document.getElementById('hiz-ad').value.trim();
  if (!ad) { bildirim('Hizmet adı zorunlu.', 'uyari'); return; }
  var sure = parseInt(document.getElementById('hiz-sure').value) || 30;
  var fiyat = parseFloat(document.getElementById('hiz-fiyat').value) || 0;
  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/hizmet', {
    method: 'POST',
    headers: jsonAuthHeader(),
    body: JSON.stringify({ ad: ad, sure: sure, fiyat: fiyat })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.basari) { bildirim(data.mesaj, 'hata'); return; }
      document.getElementById('hiz-ad').value = '';
      document.getElementById('hiz-sure').value = '30';
      document.getElementById('hiz-fiyat').value = '';
      hizmetleriYukle(esnafId);
    });
}

function hizmetSil(esnafId, hizmetId) {
  if (!confirm('Hizmet silinecek. Emin misiniz?')) return;
  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/hizmet/' + hizmetId, { method: 'DELETE', headers: authHeader() })
    .then(function(r) { return r.json(); })
    .then(function(data) { if (data.basari) hizmetleriYukle(esnafId); else bildirim(data.mesaj, 'hata'); });
}

function randevulariYukle() {
  var esnafId = durum.panelEsnafId;
  if (!esnafId) return;
  var tarih = document.getElementById('randevu-tarih-filtre') ? document.getElementById('randevu-tarih-filtre').value : '';
  var url = API_URL + '/api/esnaf-panel/' + esnafId + '/randevular' + (tarih ? '?tarih=' + tarih : '');
  fetch(url, { headers: authHeader() })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var con = document.getElementById('panel-randevular-liste');
      if (!data.basari || !data.veri.length) { con.innerHTML = '<div style="color:#aaa;font-size:.82rem">Randevu yok.</div>'; return; }
      var durumRenk = { bekliyor: '#ff6b35', onaylandi: '#2e7d32', tamamlandi: '#888', iptal: '#c62828' };
      var durumMetin = { bekliyor: 'Bekliyor', onaylandi: 'Onaylandı', tamamlandi: 'Tamamlandı', iptal: 'İptal' };
      con.innerHTML = data.veri.map(function(r) {
        var tarihStr = new Date(r.tarih).toLocaleDateString('tr-TR', { day:'numeric', month:'short' });
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0">' +
          '<div>' +
            '<div style="font-size:.84rem;font-weight:700">' + temizle(r.musteri_ad) + '</div>' +
            '<div style="font-size:.72rem;color:#888">' + tarihStr + ' · ' + (r.saat||'').slice(0,5) + ' · ' + (r.hizmet_adi||'Genel') + '</div>' +
            '<div style="font-size:.7rem;color:#aaa">' + temizle(r.musteri_telefon) + '</div>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">' +
            '<span style="font-size:.7rem;font-weight:700;color:' + (durumRenk[r.durum]||'#888') + '">' + (durumMetin[r.durum]||r.durum) + '</span>' +
            (r.durum === 'bekliyor' ? '<button onclick="panelRandevuOnayla(' + r.id + ')" style="font-size:.65rem;padding:3px 7px;background:#e8f5e9;color:#2e7d32;border:none;border-radius:6px;cursor:pointer">Onayla</button>' : '') +
            (r.durum !== 'iptal' && r.durum !== 'tamamlandi' ? '<button onclick="panelRandevuIptal(' + r.id + ')" style="font-size:.65rem;padding:3px 7px;background:#ffebee;color:#c62828;border:none;border-radius:6px;cursor:pointer">İptal</button>' : '') +
          '</div>' +
        '</div>';
      }).join('');
    });
}

function panelRandevuOnayla(randevuId) {
  var esnafId = durum.panelEsnafId;
  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/randevu/' + randevuId + '/durum', {
    method: 'PUT',
    headers: jsonAuthHeader(),
    body: JSON.stringify({ durum: 'onaylandi' })
  }).then(function() { randevulariYukle(); });
}

function panelRandevuIptal(randevuId) {
  if (!confirm('Randevu iptal edilecek. Emin misiniz?')) return;
  var esnafId = durum.panelEsnafId;
  fetch(API_URL + '/api/esnaf-panel/' + esnafId + '/randevu/' + randevuId + '/durum', {
    method: 'PUT',
    headers: jsonAuthHeader(),
    body: JSON.stringify({ durum: 'iptal' })
  }).then(function() { randevulariYukle(); });
}

