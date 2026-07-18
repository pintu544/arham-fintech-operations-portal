const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { createRouter } = require('./routes');

function configureApp(app, {
  db,
  syncCoordinator,
  incentiveRate,
  clientDistPath = path.join(__dirname, '..', 'client', 'dist'),
  corsOrigin = process.env.CORS_ORIGIN || '*'
}) {
  app.disable('x-powered-by');
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: '100kb' }));
  app.use(createRouter({ db, syncCoordinator, incentiveRate }));

  app.use('/api', (req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: `Unknown API route ${req.method} ${req.originalUrl}` } });
  });

  const indexPath = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    app.use(express.static(clientDistPath, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => res.sendFile(indexPath));
  }

  app.use((req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: `Unknown route ${req.method} ${req.originalUrl}` } });
  });

  app.use((error, _req, res, _next) => {
    console.error('[Portal] Unhandled request error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } });
  });

  return app;
}

function createApp(options) {
  return configureApp(express(), options);
}

module.exports = { createApp, configureApp };
