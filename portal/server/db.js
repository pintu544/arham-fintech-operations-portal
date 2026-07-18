const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const CORE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS clients (
    clientId TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    pan TEXT,
    email TEXT,
    phone TEXT,
    city TEXT,
    state TEXT,
    accountType TEXT,
    status TEXT,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS employees (
    employeeId TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL CHECK (role IN ('management', 'relationship_manager')),
    department TEXT,
    phone TEXT
  );

  CREATE TABLE IF NOT EXISTS trades (
    tradeId TEXT PRIMARY KEY,
    clientId TEXT NOT NULL,
    symbol TEXT,
    exchange TEXT,
    tradeType TEXT,
    quantity INTEGER,
    price REAL,
    brokerage REAL,
    tradeDate TEXT,
    settlementDate TEXT,
    status TEXT,
    FOREIGN KEY (clientId) REFERENCES clients(clientId) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS mappings (
    employeeId TEXT NOT NULL,
    clientId TEXT NOT NULL,
    PRIMARY KEY (employeeId, clientId),
    FOREIGN KEY (employeeId) REFERENCES employees(employeeId) ON DELETE CASCADE,
    FOREIGN KEY (clientId) REFERENCES clients(clientId) ON DELETE CASCADE
  );
`;

const SUPPORT_SCHEMA = `
  CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    startedAt TEXT NOT NULL,
    completedAt TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT NOT NULL,
    clientCount INTEGER DEFAULT 0,
    tradeCount INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_trades_clientId ON trades(clientId);
  CREATE INDEX IF NOT EXISTS idx_trades_tradeDate ON trades(tradeDate);
  CREATE INDEX IF NOT EXISTS idx_mappings_employeeId ON mappings(employeeId);
  CREATE INDEX IF NOT EXISTS idx_mappings_clientId ON mappings(clientId);
`;

function tableExists(db, name) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

function coreSchemaHasForeignKeys(db) {
  return tableExists(db, 'trades') && db.pragma('foreign_key_list(trades)').length > 0;
}

function migrateLegacyCoreSchema(db) {
  if (!tableExists(db, 'clients') || coreSchemaHasForeignKeys(db)) return;

  db.pragma('foreign_keys = OFF');
  const migrate = db.transaction(() => {
    db.exec(`
      ALTER TABLE mappings RENAME TO mappings_legacy;
      ALTER TABLE trades RENAME TO trades_legacy;
      ALTER TABLE clients RENAME TO clients_legacy;
      ALTER TABLE employees RENAME TO employees_legacy;
    `);

    db.exec(CORE_SCHEMA);
    db.exec(`
      INSERT INTO clients
      SELECT clientId, name, pan, email, phone, city, state, accountType, status, createdAt
      FROM clients_legacy;

      INSERT INTO employees
      SELECT employeeId, name, email, role, department, phone
      FROM employees_legacy
      WHERE role IN ('management', 'relationship_manager');

      INSERT INTO trades
      SELECT t.tradeId, t.clientId, t.symbol, t.exchange, t.tradeType, t.quantity, t.price,
             t.brokerage, t.tradeDate, t.settlementDate, t.status
      FROM trades_legacy t
      INNER JOIN clients c ON c.clientId = t.clientId;

      INSERT OR IGNORE INTO mappings
      SELECT m.employeeId, m.clientId
      FROM mappings_legacy m
      INNER JOIN employees e ON e.employeeId = m.employeeId
      INNER JOIN clients c ON c.clientId = m.clientId;

      DROP TABLE mappings_legacy;
      DROP TABLE trades_legacy;
      DROP TABLE clients_legacy;
      DROP TABLE employees_legacy;
    `);
  });

  migrate();
  db.pragma('foreign_keys = ON');
}

function createDatabase({ databasePath = process.env.DATABASE_PATH || path.join(__dirname, 'portal.db') } = {}) {
  const resolvedPath = databasePath === ':memory:' ? databasePath : path.resolve(databasePath);
  if (resolvedPath !== ':memory:') fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  const db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  migrateLegacyCoreSchema(db);
  db.exec(CORE_SCHEMA);
  db.exec(SUPPORT_SCHEMA);

  const insertClient = db.prepare(`
    INSERT INTO clients (clientId, name, pan, email, phone, city, state, accountType, status, createdAt)
    VALUES (@clientId, @name, @pan, @email, @phone, @city, @state, @accountType, @status, @createdAt)
  `);
  const insertTrade = db.prepare(`
    INSERT INTO trades (tradeId, clientId, symbol, exchange, tradeType, quantity, price, brokerage, tradeDate, settlementDate, status)
    VALUES (@tradeId, @clientId, @symbol, @exchange, @tradeType, @quantity, @price, @brokerage, @tradeDate, @settlementDate, @status)
  `);
  const insertEmployee = db.prepare(`
    INSERT INTO employees (employeeId, name, email, role, department, phone)
    VALUES (@employeeId, @name, @email, @role, @department, @phone)
  `);
  const insertMapping = db.prepare(`
    INSERT INTO mappings (employeeId, clientId)
    VALUES (@employeeId, @clientId)
  `);
  const insertSyncLog = db.prepare(`
    INSERT INTO sync_log (startedAt, completedAt, status, message, clientCount, tradeCount)
    VALUES (@startedAt, @completedAt, @status, @message, @clientCount, @tradeCount)
  `);

  const replaceSnapshot = db.transaction(({ snapshot, syncLog }) => {
    const { clients, trades, employees, mappings } = snapshot;
    db.exec('DELETE FROM mappings; DELETE FROM trades; DELETE FROM employees; DELETE FROM clients;');
    for (const client of clients) insertClient.run(client);
    for (const employee of employees) insertEmployee.run(employee);
    for (const trade of trades) insertTrade.run(trade);
    for (const mapping of mappings) insertMapping.run(mapping);
    if (syncLog) insertSyncLog.run(syncLog);
  });

  function updateAll(snapshotOrClients, optionsOrTrades, employees, mappings) {
    const snapshot = Array.isArray(snapshotOrClients)
      ? { clients: snapshotOrClients, trades: optionsOrTrades, employees, mappings }
      : snapshotOrClients;
    const syncLog = Array.isArray(snapshotOrClients) ? null : optionsOrTrades?.syncLog || null;
    replaceSnapshot({ snapshot, syncLog });
  }

  function getAllClients() {
    return db.prepare('SELECT * FROM clients ORDER BY clientId').all();
  }

  function getFilteredTrades({ clientId, startDate, endDate } = {}) {
    let sql = 'SELECT * FROM trades WHERE 1=1';
    const params = {};
    if (clientId) {
      sql += ' AND clientId = @clientId';
      params.clientId = clientId;
    }
    if (startDate) {
      sql += ' AND tradeDate >= @startDate';
      params.startDate = startDate;
    }
    if (endDate) {
      sql += ' AND tradeDate <= @endDate';
      params.endDate = endDate;
    }
    sql += ' ORDER BY tradeDate DESC, tradeId DESC';
    return db.prepare(sql).all(params);
  }

  function getAllEmployees() {
    return db.prepare('SELECT * FROM employees ORDER BY employeeId').all();
  }

  function getDemoUsers() {
    return db.prepare('SELECT employeeId, name, role FROM employees ORDER BY role, employeeId').all();
  }

  function getEmployeeById(employeeId) {
    return db.prepare('SELECT * FROM employees WHERE employeeId = ?').get(employeeId) || null;
  }

  function getClientsByEmployee(employeeId) {
    return db.prepare(`
      SELECT c.* FROM clients c
      INNER JOIN mappings m ON c.clientId = m.clientId
      WHERE m.employeeId = @employeeId
      ORDER BY c.clientId
    `).all({ employeeId });
  }

  function getIncentives(employeeId, incentiveRate) {
    let sql = `
      SELECT
        e.employeeId,
        e.name AS employeeName,
        COALESCE(SUM(t.brokerage), 0) AS totalBrokerage,
        @incentiveRate AS incentiveRate,
        COALESCE(SUM(t.brokerage), 0) * @incentiveRate AS incentiveAmount,
        COUNT(DISTINCT t.tradeId) AS tradeCount,
        COUNT(DISTINCT m.clientId) AS clientCount
      FROM employees e
      LEFT JOIN mappings m ON e.employeeId = m.employeeId
      LEFT JOIN trades t ON m.clientId = t.clientId
      WHERE e.role = 'relationship_manager'
    `;
    const params = { incentiveRate };
    if (employeeId) {
      sql += ' AND e.employeeId = @employeeId';
      params.employeeId = employeeId;
    }
    sql += ' GROUP BY e.employeeId, e.name ORDER BY incentiveAmount DESC, e.employeeId';
    return db.prepare(sql).all(params);
  }

  function getLatestSync() {
    return db.prepare('SELECT * FROM sync_log ORDER BY id DESC LIMIT 1').get() || null;
  }

  function getLatestSuccessfulSync() {
    return db.prepare("SELECT * FROM sync_log WHERE status = 'success' ORDER BY id DESC LIMIT 1").get() || null;
  }

  function logSync({ startedAt, completedAt, status, message, clientCount = 0, tradeCount = 0 }) {
    insertSyncLog.run({ startedAt, completedAt, status, message, clientCount, tradeCount });
  }

  function getCounts() {
    const row = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM clients) AS clients,
        (SELECT COUNT(*) FROM trades) AS trades,
        (SELECT COUNT(*) FROM employees) AS employees,
        (SELECT COUNT(*) FROM mappings) AS mappings
    `).get();
    return row;
  }

  return {
    db,
    databasePath: resolvedPath,
    updateAll,
    getAllClients,
    getFilteredTrades,
    getAllEmployees,
    getDemoUsers,
    getEmployeeById,
    getClientsByEmployee,
    getIncentives,
    getLatestSync,
    getLatestSuccessfulSync,
    logSync,
    getCounts,
    close: () => db.close()
  };
}

module.exports = { createDatabase };
