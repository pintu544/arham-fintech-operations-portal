const DEFAULT_TIMEOUT_MS = 25000;
const DEFAULT_MAX_RETRIES = 5;
const MAX_PAGES = 10000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(logger, method, message) {
  if (logger && typeof logger[method] === 'function') logger[method](message);
}

async function fetchJsonWithRetry(url, {
  fetchImpl = global.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_MAX_RETRIES,
  sleepFn = sleep,
  logger = console
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required');

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      if (!response || typeof response.ok !== 'boolean') throw new Error('Invalid HTTP response');
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText || 'Request failed'}`);
      return await response.json();
    } catch (error) {
      const timeoutMessage = error && error.name === 'AbortError'
        ? `Request timed out after ${timeoutMs}ms`
        : error.message;
      const isLast = attempt === retries;
      log(logger, 'warn', `[Sync] Attempt ${attempt}/${retries} for ${url}: ${timeoutMessage}${isLast ? ' (giving up)' : ''}`);
      if (isLast) throw new Error(`Failed after ${retries} attempts: ${timeoutMessage}`);
      const backoff = Math.min(1000 * (2 ** (attempt - 1)), 16000);
      await sleepFn(backoff);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error('Retry loop exited unexpectedly');
}

function assertArrayPayload(result, label) {
  if (!result || typeof result !== 'object' || !Array.isArray(result.data)) {
    throw new Error(`${label} returned an invalid data payload`);
  }
  return result.data;
}

function assertUnique(items, keySelector, label) {
  const seen = new Set();
  for (const item of items) {
    const key = keySelector(item);
    if (!key || typeof key !== 'string') throw new Error(`${label} contains a record without a valid identifier`);
    if (seen.has(key)) throw new Error(`${label} contains duplicate identifier ${key}`);
    seen.add(key);
  }
  return seen;
}

function validatePage(result, { endpoint, requestedPage, expectedPageSize, expectedMeta }) {
  const data = assertArrayPayload(result, endpoint);
  const numericFields = ['page', 'pageSize', 'totalCount', 'totalPages'];
  for (const field of numericFields) {
    if (!Number.isInteger(result[field])) throw new Error(`${endpoint} page metadata ${field} must be an integer`);
  }
  if (result.page !== requestedPage) throw new Error(`${endpoint} returned page ${result.page}; expected ${requestedPage}`);
  if (result.pageSize !== expectedPageSize) throw new Error(`${endpoint} returned pageSize ${result.pageSize}; expected ${expectedPageSize}`);
  if (result.totalCount < 0 || result.totalPages < 1 || result.totalPages > MAX_PAGES) {
    throw new Error(`${endpoint} returned invalid pagination totals`);
  }
  const calculatedPages = Math.ceil(result.totalCount / expectedPageSize) || 1;
  if (result.totalPages !== calculatedPages) {
    throw new Error(`${endpoint} totalPages ${result.totalPages} does not match totalCount ${result.totalCount}`);
  }
  if (data.length > expectedPageSize) throw new Error(`${endpoint} returned more records than pageSize`);
  if (expectedMeta && (result.totalCount !== expectedMeta.totalCount || result.totalPages !== expectedMeta.totalPages)) {
    throw new Error(`${endpoint} pagination totals changed during the pull`);
  }
  return { data, totalCount: result.totalCount, totalPages: result.totalPages };
}

async function fetchAllPages(endpoint, pageSize, idField, options) {
  const allData = [];
  const seen = new Set();
  let page = 1;
  let expectedMeta = null;

  do {
    const url = new URL(endpoint, `${options.baseUrl.replace(/\/$/, '')}/`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(pageSize));
    log(options.logger, 'log', `[Sync] Fetching ${endpoint} page ${page}${expectedMeta ? `/${expectedMeta.totalPages}` : ''}`);

    const result = await fetchJsonWithRetry(url.toString(), options);
    const pageResult = validatePage(result, {
      endpoint,
      requestedPage: page,
      expectedPageSize: pageSize,
      expectedMeta
    });
    if (!expectedMeta) expectedMeta = { totalCount: pageResult.totalCount, totalPages: pageResult.totalPages };

    for (const item of pageResult.data) {
      const id = item && item[idField];
      if (!id || typeof id !== 'string') throw new Error(`${endpoint} contains a record without ${idField}`);
      if (seen.has(id)) throw new Error(`${endpoint} contains duplicate ${idField} ${id}`);
      seen.add(id);
      allData.push(item);
    }
    page += 1;
  } while (page <= expectedMeta.totalPages);

  if (allData.length !== expectedMeta.totalCount) {
    throw new Error(`${endpoint} returned ${allData.length} records; expected ${expectedMeta.totalCount}`);
  }
  return allData;
}

async function fetchInternal(endpoint, options) {
  const url = new URL(endpoint, `${options.baseUrl.replace(/\/$/, '')}/`);
  const result = await fetchJsonWithRetry(url.toString(), { ...options, retries: 3 });
  return assertArrayPayload(result, endpoint);
}

function validateSnapshot({ clients, trades, employees, mappings }) {
  const clientIds = assertUnique(clients, item => item.clientId, 'clients');
  const employeeIds = assertUnique(employees, item => item.employeeId, 'employees');
  assertUnique(trades, item => item.tradeId, 'trades');
  assertUnique(mappings, item => `${item.employeeId || ''}:${item.clientId || ''}`, 'mappings');

  for (const employee of employees) {
    if (!['management', 'relationship_manager'].includes(employee.role)) {
      throw new Error(`Employee ${employee.employeeId} has invalid role ${employee.role}`);
    }
  }
  for (const trade of trades) {
    if (!clientIds.has(trade.clientId)) throw new Error(`Trade ${trade.tradeId} references unknown client ${trade.clientId}`);
  }
  for (const mapping of mappings) {
    if (!employeeIds.has(mapping.employeeId)) throw new Error(`Mapping references unknown employee ${mapping.employeeId}`);
    if (!clientIds.has(mapping.clientId)) throw new Error(`Mapping references unknown client ${mapping.clientId}`);
  }
}

function createSyncCoordinator({
  db,
  eventSink = { emit() {} },
  baseUrl = process.env.BSE_API_URL || 'http://localhost:3001',
  requestTimeoutMs = Number(process.env.BSE_REQUEST_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  maxRetries = Number(process.env.BSE_MAX_RETRIES || DEFAULT_MAX_RETRIES),
  fetchImpl = global.fetch,
  sleepFn = sleep,
  logger = console
} = {}) {
  if (!db || typeof db.updateAll !== 'function') throw new Error('A database instance is required');
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1) throw new Error('requestTimeoutMs must be a positive integer');
  if (!Number.isInteger(maxRetries) || maxRetries < 1 || maxRetries > 10) throw new Error('maxRetries must be between 1 and 10');

  let sink = eventSink;
  let currentStatus = 'idle';
  let currentMessage = '';
  let inFlight = null;

  const options = { baseUrl, timeoutMs: requestTimeoutMs, retries: maxRetries, fetchImpl, sleepFn, logger };

  function emit(event, payload) {
    if (sink && typeof sink.emit === 'function') sink.emit(event, payload);
  }

  async function runSync(startedAt, reason) {
    try {
      currentMessage = 'Fetching employees';
      emit('sync-status', { status: 'syncing', message: currentMessage, startedAt, reason });
      const employees = await fetchInternal('/api/internal/employees', options);

      currentMessage = 'Fetching employee-client mappings';
      emit('sync-status', { status: 'syncing', message: currentMessage, startedAt, reason });
      const mappings = await fetchInternal('/api/internal/mappings', options);

      currentMessage = 'Fetching clients from BSE';
      emit('sync-status', { status: 'syncing', message: currentMessage, startedAt, reason });
      const clients = await fetchAllPages('/api/bse/clients', 50, 'clientId', options);

      currentMessage = 'Fetching trades from BSE';
      emit('sync-status', { status: 'syncing', message: currentMessage, startedAt, reason });
      const trades = await fetchAllPages('/api/bse/trades', 100, 'tradeId', options);

      const snapshot = { clients, trades, employees, mappings };
      validateSnapshot(snapshot);

      currentMessage = 'Updating cached snapshot';
      emit('sync-status', { status: 'syncing', message: currentMessage, startedAt, reason });
      const completedAt = new Date().toISOString();
      db.updateAll(snapshot, {
        syncLog: {
          startedAt,
          completedAt,
          status: 'success',
          message: `Synced ${clients.length} clients, ${trades.length} trades`,
          clientCount: clients.length,
          tradeCount: trades.length
        }
      });

      currentStatus = 'idle';
      currentMessage = 'Sync completed successfully';
      emit('sync-status', { status: 'idle', message: currentMessage, completedAt, reason });
      emit('data-updated', { timestamp: completedAt });
      log(logger, 'log', `[Sync] Completed successfully at ${completedAt}`);
      return { status: 'success', completedAt, clientCount: clients.length, tradeCount: trades.length };
    } catch (error) {
      const completedAt = new Date().toISOString();
      currentStatus = 'error';
      currentMessage = `Sync failed: ${error.message}`;
      try {
        db.logSync({ startedAt, completedAt, status: 'failed', message: error.message });
      } catch (logError) {
        log(logger, 'error', `[Sync] Could not record failed sync: ${logError.message}`);
      }
      emit('sync-status', { status: 'error', message: currentMessage, completedAt, reason });
      log(logger, 'error', `[Sync] ${currentMessage}`);
      return { status: 'failed', completedAt, error: error.message };
    }
  }

  function trigger(reason = 'manual') {
    if (inFlight) return { accepted: false, status: currentStatus, promise: inFlight };

    const startedAt = new Date().toISOString();
    currentStatus = 'syncing';
    currentMessage = 'Starting sync';
    emit('sync-status', { status: 'syncing', message: currentMessage, startedAt, reason });
    inFlight = runSync(startedAt, reason).finally(() => {
      inFlight = null;
    });
    return { accepted: true, status: currentStatus, promise: inFlight };
  }

  return {
    trigger,
    getCurrentStatus: () => currentStatus,
    getCurrentMessage: () => currentMessage,
    getInFlight: () => inFlight,
    setEventSink: nextSink => { sink = nextSink || { emit() {} }; }
  };
}

module.exports = {
  createSyncCoordinator,
  fetchJsonWithRetry,
  fetchAllPages,
  validateSnapshot
};
