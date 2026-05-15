'use strict';
module.exports = function errorHandler(err, req, res, next) {
  console.error('[Global Hata]', err.message);
  res.status(err.status || 500).json({ basari: false, mesaj: 'Sunucu hatasi.' });
};
