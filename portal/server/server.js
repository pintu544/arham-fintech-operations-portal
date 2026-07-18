require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { configureApp } = require('./app');
const { createDatabase } = require('./db');
const { createSyncCoordinator } = require('./sync');

function integerConfig(value, fallback, name, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function rateConfig(value, fallback, name) {
  const parsed = value == null || value === '' ? fallback : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) throw new Error(`${name} must be between 0 and 1`);
  return parsed;
}

function startServer(options = {}) {
  const port = options.port ?? integerConfig(process.env.PORTAL_PORT || process.env.PORT, 3000, 'PORTAL_PORT', { max: 65535 });
  const syncIntervalMs = options.syncIntervalMs ?? integerConfig(process.env.SYNC_INTERVAL_MS, 60000, 'SYNC_INTERVAL_MS');
  const initialSyncDelayMs = options.initialSyncDelayMs ?? 2000;
  const incentiveRate = options.incentiveRate ?? rateConfig(process.env.INCENTIVE_RATE, 0.10, 'INCENTIVE_RATE');

  const db = options.db || createDatabase({ databasePath: options.databasePath });
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: process.env.CORS_ORIGIN || '*', methods: ['GET', 'POST'] }
  });
  const syncCoordinator = options.syncCoordinator || createSyncCoordinator({
    db,
    eventSink: io,
    baseUrl: options.bseApiUrl || process.env.BSE_API_URL || 'http://localhost:3001',
    requestTimeoutMs: options.requestTimeoutMs,
    maxRetries: options.maxRetries,
    fetchImpl: options.fetchImpl,
    sleepFn: options.sleepFn,
    logger: options.logger || console
  });

  syncCoordinator.setEventSink(io);
  configureApp(app, {
    db,
    syncCoordinator,
    incentiveRate,
    clientDistPath: options.clientDistPath,
    corsOrigin: options.corsOrigin
  });

  io.on('connection', socket => {
    console.log(`[Socket] Client connected: ${socket.id}`);
    socket.on('disconnect', () => console.log(`[Socket] Client disconnected: ${socket.id}`));
  });

  let initialTimer;
  let periodicTimer;
  server.listen(port, () => {
    const address = server.address();
    const listeningPort = typeof address === 'object' ? address.port : port;
    console.log(`Portal server listening on http://localhost:${listeningPort}`);
    console.log(`BSE API: ${options.bseApiUrl || process.env.BSE_API_URL || 'http://localhost:3001'}`);

    initialTimer = setTimeout(() => syncCoordinator.trigger('initial'), initialSyncDelayMs);
    periodicTimer = setInterval(() => syncCoordinator.trigger('scheduled'), syncIntervalMs);
  });

  async function close() {
    clearTimeout(initialTimer);
    clearInterval(periodicTimer);
    const activeSync = syncCoordinator.getInFlight();
    if (activeSync) await activeSync;
    await new Promise(resolve => io.close(resolve));
    if (server.listening) await new Promise(resolve => server.close(resolve));
    db.close();
  }

  return { app, server, io, db, syncCoordinator, close };
}

if (require.main === module) {
  const running = startServer();
  let closing = false;
  const shutdown = async signal => {
    if (closing) return;
    closing = true;
    console.log(`Received ${signal}; shutting down`);
    try {
      await running.close();
      process.exit(0);
    } catch (error) {
      console.error('Shutdown failed:', error);
      process.exit(1);
    }
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = { startServer };
