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

// OTP gonderme — SMS abuse koruması
const otpLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { basari: false, mesaj: 'Cok fazla OTP istegi. 1 saat sonra tekrar deneyin.' }
});

// Esnaf listesi — scraping koruması
const listeLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { basari: false, mesaj: 'Cok fazla istek. Lutfen bekleyin.' }
});

module.exports = { genelLimit, girisLimit, otpLimit, listeLimit };
