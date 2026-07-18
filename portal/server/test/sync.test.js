const test = require('node:test');
const assert = require('node:assert/strict');
const { createSyncCoordinator, fetchJsonWithRetry, validateSnapshot } = require('../sync');
const { createFixtures } = require('./helpers');

const silentLogger = { log() {}, warn() {}, error() {} };

function jsonResponse(body, { ok = true, status = 200, statusText = 'OK' } = {}) {
  return { ok, status, statusText, json: async () => body };
}

function createFetch(fixtures, overrides = {}) {
  return async input => {
    const url = new URL(input);
    if (overrides[url.pathname]) return overrides[url.pathname](url);
    if (url.pathname === '/api/internal/employees') return jsonResponse({ data: fixtures.employees });
    if (url.pathname === '/api/internal/mappings') return jsonResponse({ data: fixtures.mappings });

    const source = url.pathname === '/api/bse/clients' ? fixtures.clients : fixtures.trades;
    const page = Number(url.searchParams.get('page'));
    const pageSize = Number(url.searchParams.get('pageSize'));
    const totalPages = Math.ceil(source.length / pageSize) || 1;
    return jsonResponse({
      data: source.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      totalCount: source.length,
      totalPages
    });
  };
}

function createDbStub() {
  return {
    snapshots: [],
    logs: [],
    updateAll(snapshot, options) {
      this.snapshots.push(snapshot);
      if (options?.syncLog) this.logs.push(options.syncLog);
    },
    logSync(entry) { this.logs.push(entry); }
  };
}

test('commits one validated snapshot and emits a live update', async () => {
  const fixtures = createFixtures();
  const db = createDbStub();
  const events = [];
  const coordinator = createSyncCoordinator({
    db,
    eventSink: { emit: (event, payload) => events.push({ event, payload }) },
    baseUrl: 'http://mock.test',
    fetchImpl: createFetch(fixtures),
    sleepFn: async () => {},
    logger: silentLogger
  });

  const trigger = coordinator.trigger('test');
  assert.equal(trigger.accepted, true);
  const result = await trigger.promise;
  assert.equal(result.status, 'success');
  assert.equal(db.snapshots.length, 1);
  assert.equal(db.logs[0].status, 'success');
  assert.equal(events.filter(item => item.event === 'data-updated').length, 1);
  assert.equal(coordinator.getCurrentStatus(), 'idle');
});

test('retries a transient request and rejects incomplete pulls without replacing cache', async () => {
  const fixtures = createFixtures();
  const db = createDbStub();
  let employeeAttempts = 0;
  const fetchImpl = createFetch(fixtures, {
    '/api/internal/employees': () => {
      employeeAttempts += 1;
      if (employeeAttempts === 1) return jsonResponse({}, { ok: false, status: 500, statusText: 'Failed' });
      return jsonResponse({ data: fixtures.employees });
    },
    '/api/bse/trades': url => {
      const page = Number(url.searchParams.get('page'));
      return jsonResponse({ data: fixtures.trades, page, pageSize: 100, totalCount: 3, totalPages: 1 });
    }
  });
  const coordinator = createSyncCoordinator({
    db,
    baseUrl: 'http://mock.test',
    fetchImpl,
    sleepFn: async () => {},
    logger: silentLogger
  });

  const result = await coordinator.trigger('test').promise;
  assert.equal(employeeAttempts, 2);
  assert.equal(result.status, 'failed');
  assert.match(result.error, /returned 2 records; expected 3/);
  assert.equal(db.snapshots.length, 0);
  assert.equal(db.logs[0].status, 'failed');
});

test('allows only one active synchronization', async () => {
  const fixtures = createFixtures();
  const db = createDbStub();
  let releaseEmployees;
  let firstEmployeeRequest = true;
  const normalFetch = createFetch(fixtures);
  const fetchImpl = input => {
    const path = new URL(input).pathname;
    if (path === '/api/internal/employees' && firstEmployeeRequest) {
      firstEmployeeRequest = false;
      return new Promise(resolve => { releaseEmployees = () => resolve(jsonResponse({ data: fixtures.employees })); });
    }
    return normalFetch(input);
  };
  const coordinator = createSyncCoordinator({ db, baseUrl: 'http://mock.test', fetchImpl, sleepFn: async () => {}, logger: silentLogger });

  const first = coordinator.trigger('manual');
  const overlapping = coordinator.trigger('manual');
  assert.equal(first.accepted, true);
  assert.equal(overlapping.accepted, false);
  releaseEmployees();
  assert.equal((await first.promise).status, 'success');
  assert.equal(db.snapshots.length, 1);
});

test('times out abortable requests and clears the retry loop', async () => {
  const hangingFetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
  await assert.rejects(
    fetchJsonWithRetry('http://mock.test/hang', {
      fetchImpl: hangingFetch,
      timeoutMs: 5,
      retries: 1,
      logger: silentLogger
    }),
    /Request timed out after 5ms/
  );
});

test('keeps the prior cache untouched when the upstream is unavailable', async () => {
  const db = createDbStub();
  const coordinator = createSyncCoordinator({
    db,
    baseUrl: 'http://mock.test',
    fetchImpl: async () => { throw new Error('BSE unavailable'); },
    maxRetries: 2,
    sleepFn: async () => {},
    logger: silentLogger
  });
  const result = await coordinator.trigger('test').promise;
  assert.equal(result.status, 'failed');
  assert.equal(db.snapshots.length, 0);
  assert.equal(coordinator.getCurrentStatus(), 'error');
});

test('rejects duplicate identifiers and invalid cross-record references', () => {
  const fixtures = createFixtures();
  assert.throws(
    () => validateSnapshot({ ...fixtures, clients: [fixtures.clients[0], fixtures.clients[0]] }),
    /duplicate identifier CL001/
  );
  assert.throws(
    () => validateSnapshot({ ...fixtures, trades: [{ ...fixtures.trades[0], clientId: 'UNKNOWN' }] }),
    /references unknown client UNKNOWN/
  );
});
