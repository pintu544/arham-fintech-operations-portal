const test = require('node:test');
const assert = require('node:assert/strict');
const { createSeededDatabase, createFixtures } = require('./helpers');

test('snapshot replacement is atomic when a foreign-key insert fails', () => {
  const db = createSeededDatabase();
  const invalid = createFixtures();
  invalid.trades[0] = { ...invalid.trades[0], clientId: 'UNKNOWN' };

  assert.throws(() => db.updateAll(invalid), /FOREIGN KEY constraint failed/);
  assert.deepEqual(db.getCounts(), { clients: 2, trades: 2, employees: 2, mappings: 2 });
  assert.equal(db.getFilteredTrades()[0].clientId, 'CL002');
  db.close();
});

test('incentives aggregate only mapped relationship-manager trades', () => {
  const db = createSeededDatabase();
  const result = db.getIncentives('EMP004', 0.1);
  assert.equal(result.length, 1);
  assert.equal(result[0].clientCount, 2);
  assert.equal(result[0].tradeCount, 2);
  assert.equal(result[0].totalBrokerage, 11);
  assert.equal(result[0].incentiveAmount, 1.1);
  db.close();
});
