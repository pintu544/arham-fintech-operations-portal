require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');

function parseInteger(value, fallback, name, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function parseRate(value, fallback, name) {
  const parsed = value == null || value === '' ? fallback : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`${name} must be a number between 0 and 1`);
  }
  return parsed;
}

// ─── Configuration ───────────────────────────────────────────────

// ─── Seeded Random Number Generator (LCG, seed=42) ──────────────
let _seed = 42;
function seededRandom() {
  _seed = (_seed * 1664525 + 1013904223) & 0x7fffffff;
  return _seed / 0x7fffffff;
}
function pick(arr) { return arr[Math.floor(seededRandom() * arr.length)]; }
function randInt(min, max) { return Math.floor(seededRandom() * (max - min + 1)) + min; }
function padNum(n, len) { return String(n).padStart(len, '0'); }

// ─── Reference Data ──────────────────────────────────────────────
const FIRST_NAMES = [
  'Rajesh','Priya','Amit','Sunita','Vikram','Neha','Suresh','Kavita','Rahul','Anjali',
  'Deepak','Pooja','Manoj','Rekha','Sanjay','Meena','Arun','Swati','Vikas','Nisha',
  'Ashok','Ritu','Ajay','Seema','Nitin','Geeta','Pankaj','Jyoti','Mukesh','Anita',
  'Rohit','Sapna','Gaurav','Shilpa','Pramod','Usha','Rakesh','Pallavi','Sachin','Divya',
  'Harish','Kiran','Naveen','Asha','Tarun','Radha','Vivek','Lata','Mohan','Bhavna'
];
const LAST_NAMES = [
  'Sharma','Patel','Gupta','Singh','Kumar','Mehta','Joshi','Verma','Agarwal','Shah',
  'Reddy','Nair','Pillai','Iyer','Desai','Chopra','Malhotra','Bhatia','Kapoor','Rao',
  'Chauhan','Yadav','Mishra','Pandey','Tiwari','Saxena','Srivastava','Rastogi','Bansal','Goel'
];
const CITIES_STATES = [
  ['Mumbai','Maharashtra'],['Delhi','Delhi'],['Bangalore','Karnataka'],['Chennai','Tamil Nadu'],
  ['Kolkata','West Bengal'],['Pune','Maharashtra'],['Hyderabad','Telangana'],['Ahmedabad','Gujarat'],
  ['Jaipur','Rajasthan'],['Lucknow','Uttar Pradesh'],['Surat','Gujarat'],['Indore','Madhya Pradesh'],
  ['Nagpur','Maharashtra'],['Vadodara','Gujarat'],['Coimbatore','Tamil Nadu'],['Kochi','Kerala'],
  ['Chandigarh','Punjab'],['Bhopal','Madhya Pradesh'],['Visakhapatnam','Andhra Pradesh'],
  ['Noida','Uttar Pradesh']
];
const ACCOUNT_TYPES = ['Individual','Individual','Individual','Corporate','HUF'];
const BSE_SYMBOLS = [
  { symbol: 'RELIANCE', minPrice: 2200, maxPrice: 2800 },
  { symbol: 'TCS', minPrice: 3400, maxPrice: 4200 },
  { symbol: 'INFY', minPrice: 1400, maxPrice: 1900 },
  { symbol: 'HDFCBANK', minPrice: 1500, maxPrice: 1800 },
  { symbol: 'ICICIBANK', minPrice: 900, maxPrice: 1200 },
  { symbol: 'SBIN', minPrice: 550, maxPrice: 800 },
  { symbol: 'BHARTIARTL', minPrice: 1100, maxPrice: 1500 },
  { symbol: 'HINDUNILVR', minPrice: 2300, maxPrice: 2700 },
  { symbol: 'ITC', minPrice: 400, maxPrice: 500 },
  { symbol: 'KOTAKBANK', minPrice: 1700, maxPrice: 2100 },
  { symbol: 'LT', minPrice: 2800, maxPrice: 3500 },
  { symbol: 'AXISBANK', minPrice: 950, maxPrice: 1200 },
  { symbol: 'BAJFINANCE', minPrice: 6500, maxPrice: 8000 },
  { symbol: 'MARUTI', minPrice: 9500, maxPrice: 12000 },
  { symbol: 'TITAN', minPrice: 3000, maxPrice: 3600 },
  { symbol: 'ASIANPAINT', minPrice: 2800, maxPrice: 3300 },
  { symbol: 'SUNPHARMA', minPrice: 1100, maxPrice: 1400 },
  { symbol: 'WIPRO', minPrice: 400, maxPrice: 550 },
  { symbol: 'HCLTECH', minPrice: 1200, maxPrice: 1600 },
  { symbol: 'ULTRACEMCO', minPrice: 7500, maxPrice: 9000 },
  { symbol: 'NESTLEIND', minPrice: 22000, maxPrice: 26000 },
  { symbol: 'TATAMOTORS', minPrice: 600, maxPrice: 900 },
  { symbol: 'TATASTEEL', minPrice: 120, maxPrice: 160 },
  { symbol: 'POWERGRID', minPrice: 230, maxPrice: 300 },
  { symbol: 'NTPC', minPrice: 250, maxPrice: 350 },
  { symbol: 'ONGC', minPrice: 180, maxPrice: 260 },
  { symbol: 'COALINDIA', minPrice: 350, maxPrice: 450 },
  { symbol: 'ADANIGREEN', minPrice: 1200, maxPrice: 1800 },
  { symbol: 'DRREDDY', minPrice: 5000, maxPrice: 6000 },
  { symbol: 'CIPLA', minPrice: 1100, maxPrice: 1400 },
  { symbol: 'DIVISLAB', minPrice: 3500, maxPrice: 4200 },
  { symbol: 'BAJAJFINSV', minPrice: 1400, maxPrice: 1800 },
  { symbol: 'TECHM', minPrice: 1100, maxPrice: 1500 },
  { symbol: 'HEROMOTOCO', minPrice: 4000, maxPrice: 5000 },
  { symbol: 'EICHERMOT', minPrice: 3500, maxPrice: 4500 }
];
const DEPARTMENTS = ['Equity Sales','Wealth Management','Client Relations','Portfolio Advisory','Institutional Sales'];
const EMP_FIRST = [
  'Arjun','Priyanka','Karthik','Sneha','Varun','Megha','Rohan','Aditi','Siddharth','Nandini',
  'Abhishek','Ishita','Dhruv','Tanvi','Kunal','Shruti','Akash','Ritika','Nikhil','Ananya'
];
const EMP_LAST = ['Deshmukh','Pillai','Kulkarni','Nambiar','Thakur','Bhatt','Menon','Kaur','Rajan','Choudhury',
  'Hegde','Shetty','Bose','Das','Jain','Agrawal','Khanna','Sethi','Chawla','Mohanty'];

// ─── Generate Seed Data ──────────────────────────────────────────
function generateClients(count) {
  const clients = [];
  for (let i = 1; i <= count; i++) {
    const [city, state] = pick(CITIES_STATES);
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const panLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const pan = Array.from({ length: 5 }, () => panLetters[randInt(0, 25)]).join('') +
                padNum(randInt(1000, 9999), 4) +
                panLetters[randInt(0, 25)];
    // Random date in last 3 years
    const now = new Date('2026-07-01');
    const created = new Date(now.getTime() - randInt(0, 3 * 365 * 24 * 60 * 60 * 1000));

    clients.push({
      clientId: `CL${padNum(i, 3)}`,
      name: `${firstName} ${lastName}`,
      pan,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@email.com`,
      phone: `${randInt(70, 99)}${padNum(randInt(0, 99999999), 8)}`,
      city,
      state,
      accountType: pick(ACCOUNT_TYPES),
      status: seededRandom() > 0.15 ? 'Active' : 'Inactive',
      createdAt: created.toISOString().split('T')[0]
    });
  }
  return clients;
}

function generateTrades(count, clients) {
  const trades = [];
  const now = new Date('2026-07-01');
  for (let i = 1; i <= count; i++) {
    const client = pick(clients);
    const stock = pick(BSE_SYMBOLS);
    const price = +(stock.minPrice + seededRandom() * (stock.maxPrice - stock.minPrice)).toFixed(2);
    const quantity = randInt(1, 500);
    const brokerage = +(quantity * price * 0.0005).toFixed(2);
    const tradeDateMs = now.getTime() - randInt(0, 365 * 24 * 60 * 60 * 1000);
    const tradeDate = new Date(tradeDateMs);
    const settlementDate = new Date(tradeDateMs + 2 * 24 * 60 * 60 * 1000);

    trades.push({
      tradeId: `TR${padNum(i, 5)}`,
      clientId: client.clientId,
      symbol: stock.symbol,
      exchange: 'BSE',
      tradeType: seededRandom() > 0.5 ? 'BUY' : 'SELL',
      quantity,
      price,
      brokerage,
      tradeDate: tradeDate.toISOString().split('T')[0],
      settlementDate: settlementDate.toISOString().split('T')[0],
      status: seededRandom() > 0.3 ? 'Settled' : 'Executed'
    });
  }
  return trades;
}

function generateEmployees(count) {
  const employees = [];
  for (let i = 1; i <= count; i++) {
    const isManagement = i <= 3;
    employees.push({
      employeeId: `EMP${padNum(i, 3)}`,
      name: `${EMP_FIRST[i - 1]} ${EMP_LAST[i - 1]}`,
      email: `${EMP_FIRST[i - 1].toLowerCase()}.${EMP_LAST[i - 1].toLowerCase()}@arhamfintech.com`,
      role: isManagement ? 'management' : 'relationship_manager',
      department: isManagement ? 'Management' : pick(DEPARTMENTS),
      phone: `${randInt(70, 99)}${padNum(randInt(0, 99999999), 8)}`
    });
  }
  return employees;
}

function generateMappings(employees, clients) {
  const rms = employees.filter(e => e.role === 'relationship_manager');
  const mappings = [];
  clients.forEach((client, idx) => {
    const rm = rms[idx % rms.length];
    mappings.push({ employeeId: rm.employeeId, clientId: client.clientId });
  });
  return mappings;
}

// ─── Initialize Data ─────────────────────────────────────────────
const clients = generateClients(200);
const trades = generateTrades(5000, clients);
const employees = generateEmployees(20);
const mappings = generateMappings(employees, clients);

const defaultData = { clients, trades, employees, mappings };

function createApp({
  pageDelayMs = 500,
  failureRate = 0.2,
  random = Math.random,
  data = defaultData,
  logger = console
} = {}) {
  const app = express();
  app.locals.bse = {
    pageDelayMs: parseInteger(pageDelayMs, 500, 'pageDelayMs', { min: 0, max: 600000 }),
    failureRate: parseRate(failureRate, 0.2, 'failureRate'),
    random,
    data,
    logger
  };
  app.use(cors());
  app.use(express.json());
  registerRoutes(app);
  return app;
}

// ─── BSE Middleware (delay + random failure) ─────────────────────
function bseMiddleware(req, res, next) {
  const { pageDelayMs, failureRate, random, logger } = req.app.locals.bse;
  const startTime = Date.now();
  if (random() < failureRate) {
    const failDelay = Math.floor(random() * pageDelayMs * 0.8);
    setTimeout(() => {
      const elapsed = Date.now() - startTime;
      logger.log(`[BSE] ${req.method} ${req.originalUrl} → FAILED (${elapsed}ms)`);
      res.status(500).json({
        error: 'BSE_PULL_FAILED',
        message: 'Connection terminated mid-pull',
        timestamp: new Date().toISOString()
      });
    }, failDelay);
    return;
  }
  setTimeout(() => {
    const elapsed = Date.now() - startTime;
    logger.log(`[BSE] ${req.method} ${req.originalUrl} → OK (${elapsed}ms)`);
    next();
  }, pageDelayMs);
}

// ─── Helper: Paginate ────────────────────────────────────────────
function getPagination(query, defaultPageSize) {
  return {
    page: parseInteger(query.page, 1, 'page', { min: 1, max: 100000 }),
    pageSize: parseInteger(query.pageSize, defaultPageSize, 'pageSize', { min: 1, max: 500 })
  };
}

function paginate(data, { page, pageSize }) {
  const totalCount = data.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const start = (page - 1) * pageSize;
  return {
    data: data.slice(start, start + pageSize),
    page,
    pageSize,
    totalCount,
    totalPages
  };
}

function validateDateRange(startDate, endDate) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (startDate && !datePattern.test(startDate)) throw new Error('startDate must use YYYY-MM-DD');
  if (endDate && !datePattern.test(endDate)) throw new Error('endDate must use YYYY-MM-DD');
  if (startDate && endDate && startDate > endDate) throw new Error('startDate cannot be after endDate');
}

function sendValidationError(res, error) {
  return res.status(400).json({
    error: { code: 'INVALID_QUERY', message: error.message }
  });
}

// ─── BSE Endpoints (slow, unreliable) ────────────────────────────
function registerRoutes(app) {
app.get('/api/bse/clients', bseMiddleware, (req, res) => {
  try {
    const { clients: clientData } = req.app.locals.bse.data;
    res.json(paginate(clientData, getPagination(req.query, 50)));
  } catch (error) {
    sendValidationError(res, error);
  }
});

app.get('/api/bse/trades', bseMiddleware, (req, res) => {
  try {
    validateDateRange(req.query.startDate, req.query.endDate);
    let filtered = req.app.locals.bse.data.trades;
    if (req.query.clientId) filtered = filtered.filter(t => t.clientId === req.query.clientId);
    if (req.query.startDate) filtered = filtered.filter(t => t.tradeDate >= req.query.startDate);
    if (req.query.endDate) filtered = filtered.filter(t => t.tradeDate <= req.query.endDate);
    res.json(paginate(filtered, getPagination(req.query, 100)));
  } catch (error) {
    sendValidationError(res, error);
  }
});

// ─── Internal Endpoints (instant, reliable) ──────────────────────
app.get('/api/internal/employees', (req, res) => {
  res.json({ data: req.app.locals.bse.data.employees });
});

app.get('/api/internal/mappings', (req, res) => {
  res.json({ data: req.app.locals.bse.data.mappings });
});

// ─── Health Check ────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const currentData = req.app.locals.bse.data;
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    data: {
      clients: currentData.clients.length,
      trades: currentData.trades.length,
      employees: currentData.employees.length,
      mappings: currentData.mappings.length
    }
  });
});
}

// ─── Start Server ────────────────────────────────────────────────
if (require.main === module) {
  const PORT = parseInteger(process.env.BSE_API_PORT || process.env.PORT, 3001, 'BSE_API_PORT', { min: 1, max: 65535 });
  const PAGE_DELAY_MS = parseInteger(process.env.BSE_PAGE_DELAY_MS, 500, 'BSE_PAGE_DELAY_MS', { min: 0, max: 600000 });
  const FAILURE_RATE = parseRate(process.env.BSE_FAILURE_RATE, 0.2, 'BSE_FAILURE_RATE');
  const app = createApp({ pageDelayMs: PAGE_DELAY_MS, failureRate: FAILURE_RATE });

  app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║       Mock BSE API — Running on :${PORT}        ║`);
  console.log(`╠══════════════════════════════════════════════╣`);
  console.log(`║  Page Delay:    ${String(PAGE_DELAY_MS).padEnd(6)}ms                   ║`);
  console.log(`║  Failure Rate:  ${(FAILURE_RATE * 100).toFixed(0)}%                        ║`);
  console.log(`║  Clients:       ${String(clients.length).padEnd(6)}                      ║`);
  console.log(`║  Trades:        ${String(trades.length).padEnd(6)}                      ║`);
  console.log(`║  Employees:     ${String(employees.length).padEnd(6)}                      ║`);
  console.log(`║  Mappings:      ${String(mappings.length).padEnd(6)}                      ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);
  });
}

module.exports = {
  createApp,
  defaultData,
  generateClients,
  generateTrades,
  generateEmployees,
  generateMappings
};
