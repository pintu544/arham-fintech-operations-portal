const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../app');
const { createSeededDatabase, createCoordinatorStub } = require('./helpers');

function setup(tradeCount = 2) {
  const db = createSeededDatabase(tradeCount);
  const syncCoordinator = createCoordinatorStub();
  const app = createApp({ db, syncCoordinator, clientDistPath: '__missing_dist__' });
  return { app, db, syncCoordinator };
}

test('publishes health, sync state, and minimal demo identities', async () => {
  const { app, db } = setup();
  const health = await request(app).get('/api/health').expect(200);
  assert.equal(health.body.data.trades, 2);
  const users = await request(app).get('/api/demo/users').expect(200);
  assert.deepEqual(Object.keys(users.body.data[0]).sort(), ['employeeId', 'name', 'role']);
  await request(app).get('/api/sync/status').expect(200);
  db.close();
});

test('rejects missing and unknown identities', async () => {
  const { app, db } = setup();
  const missing = await request(app).get('/api/clients').expect(401);
  assert.equal(missing.body.error.code, 'IDENTITY_REQUIRED');
  const unknown = await request(app).get('/api/clients').set('X-Employee-Id', 'EMP999').expect(401);
  assert.equal(unknown.body.error.code, 'UNKNOWN_IDENTITY');
  db.close();
});

test('derives relationship-manager and management scope on the server', async () => {
  const { app, db } = setup();
  const ownClients = await request(app).get('/api/my-clients').set('X-Employee-Id', 'EMP004').expect(200);
  assert.equal(ownClients.body.count, 2);
  await request(app).get('/api/my-clients').set('X-Employee-Id', 'EMP001').expect(403);

  const ownIncentives = await request(app).get('/api/incentives').set('X-Employee-Id', 'EMP004').expect(200);
  assert.equal(ownIncentives.body.count, 1);
  assert.equal(ownIncentives.body.data[0].employeeId, 'EMP004');
  const allIncentives = await request(app).get('/api/incentives').set('X-Employee-Id', 'EMP001').expect(200);
  assert.equal(allIncentives.body.count, 1);
  db.close();
});

test('restricts manual sync and reports active-sync conflicts', async () => {
  const { app, db, syncCoordinator } = setup();
  await request(app).post('/api/sync/trigger').set('X-Employee-Id', 'EMP004').expect(403);
  await request(app).post('/api/sync/trigger').set('X-Employee-Id', 'EMP001').expect(202);
  assert.equal(syncCoordinator.triggerCalls, 1);
  syncCoordinator.accepted = false;
  const conflict = await request(app).post('/api/sync/trigger').set('X-Employee-Id', 'EMP001').expect(409);
  assert.equal(conflict.body.error.code, 'SYNC_IN_PROGRESS');
  db.close();
});

test('validates trade dates and serves the seeded cached dataset in under one second', async () => {
  const { app, db } = setup(5000);
  await request(app)
    .get('/api/trades?startDate=2026-07-02&endDate=2026-07-01')
    .set('X-Employee-Id', 'EMP001')
    .expect(400);

  const startedAt = performance.now();
  const trades = await request(app).get('/api/trades').set('X-Employee-Id', 'EMP001').expect(200);
  const elapsed = performance.now() - startedAt;
  assert.equal(trades.body.count, 5000);
  assert.ok(elapsed < 1000, `cached trade response took ${elapsed.toFixed(1)}ms`);
  db.close();
});
