'use strict';
const { pool } = require('../db/pool');
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');

// JWT tabanlı stateless session
// Secret: JWT_SECRET env var'ından gelir. Yoksa startup'ta uyarı verir.
// =============================================================

var JWT_SECRET  = process.env.JWT_SECRET || null;
var SESSION_TTL = 7 * 24 * 60 * 60; // saniye cinsinden (7 gün)

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[Auth] HATA: JWT_SECRET env var production ortaminda tanimsiz. Sunucu durduruluyor.');
    process.exit(1);
  }
  console.warn('[Auth] UYARI: JWT_SECRET tanimsiz — gecici secret uretildi. Her restart oturum kapatir.');
  JWT_SECRET = require('crypto').randomBytes(64).toString('hex');
}

function sessionOlustur(kullanici) {
  var payload = {
    kullanici_id  : kullanici.kullanici_id || kullanici.id || 0,
    esnaf_id      : kullanici.esnaf_id  || null,
    kurye_id      : kullanici.kurye_id  || null,
    tip           : kullanici.tip,
    telefon       : kullanici.telefon   || null,
    tokenVersion  : kullanici.token_version || 1
  };
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: SESSION_TTL });
}

function sessionDogrula(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch (e) {
    return null; // süresi dolmuş veya geçersiz
  }
}

// AUTH MIDDLEWARE
// =============================================================

function esnafAuth(req, res, next) {
  var auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ basari: false, mesaj: 'Oturum gerekli. Lutfen tekrar giris yapin.' });
  }
  var session = sessionDogrula(auth.slice(7));
  if (!session) {
    return res.status(401).json({ basari: false, mesaj: 'Oturum suresi dolmus. Tekrar giris yapin.' });
  }
  // token_version doğrulaması — revoke/logout kontrolü
  tokenVersionKontrol(session).then(function(gecerli) {
    if (!gecerli) {
      return res.status(401).json({ basari: false, mesaj: 'Oturum iptal edilmis. Tekrar giris yapin.' });
    }
    // Yetki kontrolü: params, body ve query'den esnaf_id'yi al
    var hedef = null;
    if (req.params && req.params.id) hedef = parseInt(req.params.id);
    else if (req.body && req.body.esnaf_id) hedef = parseInt(req.body.esnaf_id);
    else if (req.query && req.query.esnaf_id) hedef = parseInt(req.query.esnaf_id);

    if (hedef && session.esnaf_id !== hedef) {
      return res.status(403).json({ basari: false, mesaj: 'Bu islem icin yetkiniz yok.' });
    }
    req.sessionData = session;
    next();
  }).catch(function() { next(); }); // DB hatası durumunda bloklama
}

function adminAuth(req, res, next) {
  var auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    var session = sessionDogrula(auth.slice(7));
    if (session && session.tip === 'admin') { req.sessionData = session; return next(); }
  }
  return res.status(401).json({ basari: false, mesaj: 'Yetkisiz' });
}

// =============================================================

// Token versiyon doğrulaması — revoke desteği
// Sadece kullanici tipi için kontrol edilir (admin/esnaf admin kendi versiyonunu takip etmez)
async function tokenVersionKontrol(session) {
  if (!session || !session.kullanici_id || session.kullanici_id === 0) return true; // admin
  try {
    var r = await pool.query('SELECT token_version FROM kullanicilar WHERE id=$1', [session.kullanici_id]);
    if (!r.rows.length) return false;
    return (session.tokenVersion || 1) === r.rows[0].token_version;
  } catch(e) {
    return true; // DB hatasında bloklamayı önle
  }
}

module.exports = { bcrypt, sessionOlustur, sessionDogrula, tokenVersionKontrol, esnafAuth, adminAuth };
