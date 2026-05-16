'use strict';
const rateLimit = require('express-rate-limit');

// Genel API limiti — tüm endpoint'ler
const genelLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { basari: false, mesaj: 'Cok fazla istek. 15 dakika sonra tekrar deneyin.' }
});

// Giris / OTP — brute-force koruması
const girisLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { basari: false, mesaj: 'Cok fazla giris denemesi. 15 dakika sonra tekrar deneyin.' }
});

// OTP gonderme — SMS abuse koruması (IP + telefon kombinasyonu, VPN rotasyonuna karşı)
const otpLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: function(req) {
    var telefon = (req.body && req.body.telefon) ? String(req.body.telefon) : 'bilinmiyor';
    return req.ip + ':' + telefon;
  },
  message: { basari: false, mesaj: 'Cok fazla OTP istegi. 1 saat sonra tekrar deneyin.' }
});

// OTP dogrulama — telefon bazli brute-force koruması
const otpDogrulaLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: function(req) {
    var telefon = (req.body && req.body.telefon) ? String(req.body.telefon) : 'bilinmiyor';
    return req.ip + ':' + telefon;
  },
  message: { basari: false, mesaj: 'Cok fazla deneme. 1 saat sonra tekrar deneyin.' }
});

// Esnaf listesi — scraping koruması
const listeLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { basari: false, mesaj: 'Cok fazla istek. Lutfen bekleyin.' }
});

module.exports = { genelLimit, girisLimit, otpLimit, otpDogrulaLimit, listeLimit };
