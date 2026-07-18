const express = require('express');

function errorResponse(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function validateDateRange(startDate, endDate) {
  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  if (startDate && !pattern.test(startDate)) return 'startDate must use YYYY-MM-DD';
  if (endDate && !pattern.test(endDate)) return 'endDate must use YYYY-MM-DD';
  if (startDate && endDate && startDate > endDate) return 'startDate cannot be after endDate';
  return null;
}

function createRouter({ db, syncCoordinator, incentiveRate = Number(process.env.INCENTIVE_RATE || 0.10) }) {
  if (!db || !syncCoordinator) throw new Error('Database and sync coordinator are required');
  if (!Number.isFinite(incentiveRate) || incentiveRate < 0 || incentiveRate > 1) {
    throw new Error('incentiveRate must be between 0 and 1');
  }

  const router = express.Router();

  function requireIdentity(req, res, next) {
    const employeeId = req.get('x-employee-id');
    if (!employeeId) return errorResponse(res, 401, 'IDENTITY_REQUIRED', 'X-Employee-Id header is required');
    const employee = db.getEmployeeById(employeeId);
    if (!employee) return errorResponse(res, 401, 'UNKNOWN_IDENTITY', 'The selected employee does not exist');
    req.identity = employee;
    return next();
  }

  function requireManagement(req, res, next) {
    if (req.identity.role !== 'management') {
      return errorResponse(res, 403, 'MANAGEMENT_REQUIRED', 'Management access is required');
    }
    return next();
  }

  router.get('/api/health', (_req, res) => {
    try {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        syncStatus: syncCoordinator.getCurrentStatus(),
        data: db.getCounts()
      });
    } catch (error) {
      return errorResponse(res, 503, 'DATABASE_UNAVAILABLE', error.message);
    }
  });

  router.get('/api/sync/status', (_req, res) => {
    try {
      res.json({
        currentStatus: syncCoordinator.getCurrentStatus(),
        message: syncCoordinator.getCurrentMessage(),
        lastSync: db.getLatestSync(),
        lastSuccessfulSync: db.getLatestSuccessfulSync()
      });
    } catch (error) {
      return errorResponse(res, 500, 'SYNC_STATUS_FAILED', error.message);
    }
  });

  router.get('/api/demo/users', (_req, res) => {
    try {
      const data = db.getDemoUsers();
      res.json({ data, count: data.length });
    } catch (error) {
      return errorResponse(res, 500, 'DEMO_USERS_FAILED', error.message);
    }
  });

  router.get('/api/clients', requireIdentity, (_req, res) => {
    try {
      const data = db.getAllClients();
      res.json({ data, count: data.length });
    } catch (error) {
      return errorResponse(res, 500, 'CLIENTS_FAILED', error.message);
    }
  });

  router.get('/api/trades', requireIdentity, (req, res) => {
    const { clientId, startDate, endDate } = req.query;
    const validationError = validateDateRange(startDate, endDate);
    if (validationError) return errorResponse(res, 400, 'INVALID_QUERY', validationError);
    try {
      const data = db.getFilteredTrades({ clientId, startDate, endDate });
      res.json({ data, count: data.length });
    } catch (error) {
      return errorResponse(res, 500, 'TRADES_FAILED', error.message);
    }
  });

  router.get('/api/employees', requireIdentity, (_req, res) => {
    try {
      const data = db.getAllEmployees();
      res.json({ data, count: data.length });
    } catch (error) {
      return errorResponse(res, 500, 'EMPLOYEES_FAILED', error.message);
    }
  });

  router.get('/api/my-clients', requireIdentity, (req, res) => {
    if (req.identity.role !== 'relationship_manager') {
      return errorResponse(res, 403, 'RELATIONSHIP_MANAGER_REQUIRED', 'Relationship-manager access is required');
    }
    try {
      const data = db.getClientsByEmployee(req.identity.employeeId);
      res.json({ data, count: data.length });
    } catch (error) {
      return errorResponse(res, 500, 'CLIENT_MAPPINGS_FAILED', error.message);
    }
  });

  router.get('/api/incentives', requireIdentity, (req, res) => {
    try {
      const employeeId = req.identity.role === 'management' ? undefined : req.identity.employeeId;
      const data = db.getIncentives(employeeId, incentiveRate);
      res.json({ data, count: data.length });
    } catch (error) {
      return errorResponse(res, 500, 'INCENTIVES_FAILED', error.message);
    }
  });

  router.post('/api/sync/trigger', requireIdentity, requireManagement, (_req, res) => {
    const result = syncCoordinator.trigger('manual');
    if (!result.accepted) {
      return errorResponse(res, 409, 'SYNC_IN_PROGRESS', 'A synchronization is already running');
    }
    return res.status(202).json({ message: 'Sync accepted', status: result.status });
  });

  return router;
}

module.exports = { createRouter };
