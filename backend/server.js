'use strict';
require('dotenv').config();

// Crash koruması — unhandled rejection process'i öldürmesin
process.on('unhandledRejection', function(reason) {
  console.error('[UnhandledRejection]', reason && reason.message ? reason.message : reason);
});
process.on('uncaughtException', function(err) {
  console.error('[UncaughtException]', err.message);
});

const express = require('express');
const cors    = require('cors');

const app = express();
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json());

app.get('/',         (req, res) => res.json({ mesaj: 'Yakinda Ne Var API calisiyor!', versiyon: '5.1' }));
app.get('/api/ping', (req, res) => res.sendStatus(200));

app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/esnaflar'));
app.use('/api', require('./routes/panel'));
app.use('/api', require('./routes/siparisler'));
app.use('/api', require('./routes/kuryeler'));
app.use('/api', require('./routes/admin'));
app.use('/api', require('./routes/randevular'));
app.use('/api', require('./routes/ilanlar'));
app.use('/api', require('./routes/misc'));

app.use(require('./middleware/error'));

const { tablolarOlustur, randevuHatirlatmaCalistir } = require('./db/init');

tablolarOlustur().then(function() {
  require('./db/pool').pool.query(
    'ALTER TABLE randevular ADD COLUMN IF NOT EXISTS hatirlatma_gonderildi BOOLEAN DEFAULT false'
  ).catch(function() {});

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', function() {
    console.log('API calisiyor: http://0.0.0.0:' + PORT);
    setInterval(randevuHatirlatmaCalistir, 10 * 60 * 1000);
    randevuHatirlatmaCalistir().catch(function(e) {
      console.error('[Hatirlatma] Baslatma hatasi:', e.message);
    });
  });
}).catch(function(err) {
  console.error('[Veritabani] Baglanti hatasi:', err.message);
  process.exit(1);
});
