'use strict';
require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app = express();
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

// Sağlık kontrolü
app.get('/',        (req, res) => res.json({ mesaj: 'Yakinda Ne Var API calisiyor!', versiyon: '5.0' }));
app.get('/api/ping', (req, res) => res.sendStatus(200));

// Route'ları yükle
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/esnaflar'));
app.use('/api', require('./routes/panel'));
app.use('/api', require('./routes/siparisler'));
app.use('/api', require('./routes/kuryeler'));
app.use('/api', require('./routes/admin'));
app.use('/api', require('./routes/randevular'));
app.use('/api', require('./routes/ilanlar'));
app.use('/api', require('./routes/misc'));

// Global hata yakalayıcı
app.use(require('./middleware/error'));

// Başlat
const { tablolarOlustur, randevuHatirlatmaCalistir } = require('./db/init');

tablolarOlustur().then(async function() {
  await require('pg').Pool && require('./db/pool').pool.query(
    'ALTER TABLE randevular ADD COLUMN IF NOT EXISTS hatirlatma_gonderildi BOOLEAN DEFAULT false'
  ).catch(function() {});
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, function() {
    console.log('API calisiyor: http://localhost:' + PORT);
    setInterval(randevuHatirlatmaCalistir, 10 * 60 * 1000);
    randevuHatirlatmaCalistir();
  });
}).catch(function(err) {
  console.error('Veritabani hatasi:', err);
  process.exit(1);
});
