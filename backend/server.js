'use strict';
require('dotenv').config();

process.on('unhandledRejection', function(reason) {
  console.error('[UnhandledRejection]', reason && reason.message ? reason.message : reason);
});
process.on('uncaughtException', function(err) {
  console.error('[UncaughtException]', err.message, err.stack);
});

const express = require('express');
const cors    = require('cors');

const app = express();
var izinliOriginler = [
  'https://vampirera.github.io',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];
app.use(cors({
  origin: function(origin, callback) {
    // origin yoksa (curl, Postman, server-to-server) veya izinliyse geçir
    if (!origin || izinliOriginler.indexOf(origin) !== -1) return callback(null, true);
    return callback(new Error('CORS: izin verilmeyen origin: ' + origin));
  },
  methods: ['GET','POST','PUT','DELETE'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json());

// Rate limiting
const { genelLimit } = require('./middleware/rateLimit');
app.use('/api', genelLimit);

app.get('/',         (req, res) => res.json({ mesaj: 'Yakinda Ne Var API calisiyor!', versiyon: '5.1' }));
app.get('/api/ping', (req, res) => res.sendStatus(200));

var routelar = ['./routes/auth','./routes/esnaflar','./routes/panel','./routes/siparisler',
                './routes/kuryeler','./routes/admin','./routes/randevular','./routes/ilanlar','./routes/misc'];
routelar.forEach(function(r) {
  try {
    app.use('/api', require(r));
    console.log('[Route] OK:', r);
  } catch(e) {
    console.error('[Route] FAIL:', r, '-', e.message);
  }
});

app.use(require('./middleware/error'));

const { tablolarOlustur, randevuHatirlatmaCalistir } = require('./db/init');

tablolarOlustur().then(function() {
  require('./db/pool').pool.query(
    'ALTER TABLE randevular ADD COLUMN IF NOT EXISTS hatirlatma_gonderildi BOOLEAN DEFAULT false'
  ).catch(function() {});

  const PORT = parseInt(process.env.PORT) || 3000;
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
