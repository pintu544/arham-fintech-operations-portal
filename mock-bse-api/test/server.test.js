const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp, defaultData } = require('../server');

const silentLogger = { log() {}, warn() {}, error() {} };

test('serves validated, deterministic pagination and trade filters', async () => {
  const app = createApp({ pageDelayMs: 0, failureRate: 0, logger: silentLogger });
  const clients = await request(app).get('/api/bse/clients?page=2&pageSize=25').expect(200);
  assert.equal(clients.body.page, 2);
  assert.equal(clients.body.pageSize, 25);
  assert.equal(clients.body.totalCount, 200);
  assert.equal(clients.body.data.length, 25);

  const sample = defaultData.trades[0];
  const trades = await request(app)
    .get('/api/bse/trades')
    .query({ clientId: sample.clientId, startDate: sample.tradeDate, endDate: sample.tradeDate, pageSize: 100 })
    .expect(200);
  assert.ok(trades.body.data.length > 0);
  assert.ok(trades.body.data.every(trade => trade.clientId === sample.clientId && trade.tradeDate === sample.tradeDate));
});

test('rejects invalid pagination and date ranges', async () => {
  const app = createApp({ pageDelayMs: 0, failureRate: 0, logger: silentLogger });
  const page = await request(app).get('/api/bse/clients?page=0').expect(400);
  assert.equal(page.body.error.code, 'INVALID_QUERY');

  const dates = await request(app)
    .get('/api/bse/trades?startDate=2026-07-02&endDate=2026-07-01')
    .expect(400);
  assert.equal(dates.body.error.code, 'INVALID_QUERY');
});

test('keeps internal endpoints reliable while BSE requests fail deterministically', async () => {
  const app = createApp({ pageDelayMs: 0, failureRate: 1, random: () => 0, logger: silentLogger });
  const employees = await request(app).get('/api/internal/employees').expect(200);
  assert.equal(employees.body.data.length, 20);
  await request(app).get('/api/internal/mappings').expect(200);

  const failure = await request(app).get('/api/bse/clients').expect(500);
  assert.equal(failure.body.error, 'BSE_PULL_FAILED');
});

test('exposes health counts without the simulated BSE delay', async () => {
  const app = createApp({ pageDelayMs: 100, failureRate: 1, logger: silentLogger });
  const health = await request(app).get('/api/health').expect(200);
  assert.deepEqual(health.body.data, { clients: 200, trades: 5000, employees: 20, mappings: 200 });
});
