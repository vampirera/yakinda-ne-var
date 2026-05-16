'use strict';
const bcrypt = require('bcrypt');
const { pool } = require('../db/pool');

// SESSION STORE (in-memory, 7 gun TTL)
// =============================================================
var _sessions = {};
var SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

function generateToken() {
  return require('crypto').randomBytes(64).toString('hex');
}

function sessionOlustur(kullanici) {
  var token = generateToken();
  _sessions[token] = {
    kullanici_id: kullanici.kullanici_id || kullanici.id || 0,
    esnaf_id: kullanici.esnaf_id || null,
    kurye_id: kullanici.kurye_id || null,
    tip: kullanici.tip,
    telefon: kullanici.telefon,
    exp: Date.now() + SESSION_TTL
  };
  return token;
}

function sessionDogrula(token) {
  if (!token) return null;
  var s = _sessions[token];
  if (!s) return null;
  if (Date.now() > s.exp) { delete _sessions[token]; return null; }
  return s;
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
  var urlId = (req.params && req.params.id) ? parseInt(req.params.id) : null;
  if (urlId && session.esnaf_id !== urlId) {
    return res.status(403).json({ basari: false, mesaj: 'Bu islem icin yetkiniz yok.' });
  }
  req.sessionData = session;
  next();
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

module.exports = { bcrypt, sessionOlustur, sessionDogrula, esnafAuth, adminAuth };
