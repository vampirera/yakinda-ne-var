'use strict';
const twilio = require('twilio');
const cloudinaryLib = require('cloudinary').v2;
const OpenAI = require('openai');
const multer = require('multer');
const fs = require('fs');
const { pool } = require('../db/pool');

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

cloudinaryLib.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({ dest: 'uploads/', limits: { fileSize: 5 * 1024 * 1024 } });

function telefonNormalize(telefon) {
  var t = telefon.replace(/\D/g, ''); // sadece rakam
  if (t.startsWith('90') && t.length === 12) return '+' + t;
  if (t.startsWith('0') && t.length === 11) return '+90' + t.slice(1);
  if (t.length === 10) return '+90' + t;
  return '+' + t;
}

function whatsappGonder(telefon, mesaj) {
  if (!telefon || !process.env.TWILIO_WHATSAPP_FROM) return Promise.resolve();
  var normalized = telefonNormalize(telefon);
  var to = normalized.startsWith('whatsapp:') ? normalized : 'whatsapp:' + normalized;
  return twilioClient.messages.create({ from: process.env.TWILIO_WHATSAPP_FROM, to: to, body: mesaj })
    .then(function(m) { console.log('[WhatsApp] Gönderildi:', m.sid); })
    .catch(function(e) { console.log('[WhatsApp] Hata:', e.message); throw e; });
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

function mesafeHesapla(lat1, lng1, lat2, lng2) {
  var R = 6371;
  var dLat = (lat2-lat1) * Math.PI/180;
  var dLng = (lng2-lng1) * Math.PI/180;
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}


async function esnafSil(id) {
  await pool.query('DELETE FROM kampanyalar WHERE esnaf_id=$1', [id]);
  await pool.query('DELETE FROM urunler WHERE esnaf_id=$1', [id]);
  await pool.query('DELETE FROM yorumlar WHERE esnaf_id=$1', [id]);
  await pool.query('UPDATE kullanicilar SET esnaf_id=NULL WHERE esnaf_id=$1', [id]);
  await pool.query('DELETE FROM esnaflar WHERE id=$1', [id]);
  cacheSil('esnaflar:'); cacheSil('esnaf_detay:' + id);
}

app.delete('/api/admin/reddet/:id', adminAuth, async function(req, res) {
  try {
    await esnafSil(req.params.id);
    res.json({ basari: true, mesaj: 'Esnaf reddedildi.' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

app.delete('/api/admin/sil/:id', adminAuth, async function(req, res) {
  try {
    await esnafSil(req.params.id);
    res.json({ basari: true, mesaj: 'Esnaf silindi.' });
  } catch(err) { console.error(err); res.status(500).json({ basari: false, mesaj: 'Sunucu hatasi.' }); }
});

// Kurye kayıt

module.exports = { twilioClient, openai, cloudinary: cloudinaryLib, upload, fs, telefonNormalize, whatsappGonder, mesafeHesapla, esnafSil };
