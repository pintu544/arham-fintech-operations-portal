const { createDatabase } = require('../db');

function createFixtures(tradeCount = 2) {
  const clients = [
    { clientId: 'CL001', name: 'Client One', pan: 'AAAAA0001A', email: 'one@example.com', phone: '9000000001', city: 'Mumbai', state: 'Maharashtra', accountType: 'Individual', status: 'Active', createdAt: '2026-01-01' },
    { clientId: 'CL002', name: 'Client Two', pan: 'AAAAA0002A', email: 'two@example.com', phone: '9000000002', city: 'Pune', state: 'Maharashtra', accountType: 'Corporate', status: 'Active', createdAt: '2026-01-02' }
  ];
  const employees = [
    { employeeId: 'EMP001', name: 'Manager One', email: 'manager@example.com', role: 'management', department: 'Management', phone: '9111111111' },
    { employeeId: 'EMP004', name: 'RM One', email: 'rm@example.com', role: 'relationship_manager', department: 'Equity Sales', phone: '9222222222' }
  ];
  const trades = Array.from({ length: tradeCount }, (_, index) => ({
    tradeId: `TR${String(index + 1).padStart(5, '0')}`,
    clientId: index % 2 === 0 ? 'CL001' : 'CL002',
    symbol: index % 2 === 0 ? 'TCS' : 'INFY',
    exchange: 'BSE',
    tradeType: index % 2 === 0 ? 'BUY' : 'SELL',
    quantity: 10 + index,
    price: 100 + index,
    brokerage: 5 + index,
    tradeDate: index % 2 === 0 ? '2026-06-01' : '2026-06-02',
    settlementDate: '2026-06-04',
    status: 'Settled'
  }));
  const mappings = [
    { employeeId: 'EMP004', clientId: 'CL001' },
    { employeeId: 'EMP004', clientId: 'CL002' }
  ];
  return { clients, trades, employees, mappings };
}

function createSeededDatabase(tradeCount = 2) {
  const db = createDatabase({ databasePath: ':memory:' });
  db.updateAll(createFixtures(tradeCount));
  return db;
}

function createCoordinatorStub({ accepted = true } = {}) {
  return {
    accepted,
    triggerCalls: 0,
    getCurrentStatus: () => 'idle',
    getCurrentMessage: () => '',
    trigger() {
      this.triggerCalls += 1;
      return { accepted: this.accepted, status: this.accepted ? 'syncing' : 'idle' };
    }
  };
}

module.exports = { createFixtures, createSeededDatabase, createCoordinatorStub };
