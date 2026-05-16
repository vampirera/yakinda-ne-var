'use strict';
const multer = require('multer');

module.exports = function errorHandler(err, req, res, next) {
  // Multer hataları (dosya tipi, boyut vb.)
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ basari: false, mesaj: 'Dosya boyutu 5MB limitini asiyor.' });
    }
    return res.status(400).json({ basari: false, mesaj: 'Dosya yukleme hatasi: ' + err.message });
  }
  // Gorsel filtresi hatasi
  if (err && err.message && err.message.includes('gorsel dosyasi')) {
    return res.status(400).json({ basari: false, mesaj: err.message });
  }
  console.error('[Global Hata]', err.message);
  res.status(err.status || 500).json({ basari: false, mesaj: 'Sunucu hatasi.' });
};
