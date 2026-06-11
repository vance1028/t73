'use strict';

const express = require('express');
const alertService = require('../services/inspectionAlertService');
const scheduler = require('../scheduler');
const { authRequired, requireRole } = require('../auth');
const { sendError, toPositiveInt } = require('../utils/http');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(authRequired);

router.get('/', wrap(async (req, res) => {
  const filters = {};
  if (req.query.projectId !== undefined) {
    const pid = toPositiveInt(req.query.projectId);
    if (pid === null) return sendError(res, 400, '无效的工程 ID');
    filters.projectId = pid;
  }
  if (req.query.status) filters.status = req.query.status;
  if (req.query.alertLevel) filters.alertLevel = req.query.alertLevel;
  if (req.query.onlyUnacknowledged === 'true') filters.onlyUnacknowledged = true;

  const list = await alertService.listAlertsWithProject(filters);
  res.json({ data: list, total: list.length });
}));

router.get('/:id', wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的预警 ID');
  const alert = await alertService.getAlert(id);
  if (!alert) return sendError(res, 404, '预警不存在');
  res.json({ data: alert });
}));

router.put('/:id/acknowledge', wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的预警 ID');
  try {
    const alert = await alertService.acknowledgeAlert(id, req.user.id);
    res.json({ data: alert });
  } catch (err) {
    return sendError(res, 400, err.message);
  }
}));

router.put('/:id/clear', requireRole('ADMIN', 'MANAGER'), wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的预警 ID');
  const reason = req.body.reason || 'MANUAL_CLEAR';
  try {
    const count = await alertService.clearAlert(id, reason);
    res.json({ success: true, clearedCount: count });
  } catch (err) {
    return sendError(res, 400, err.message);
  }
}));

router.post('/scan', requireRole('ADMIN'), wrap(async (req, res) => {
  const result = await scheduler.runAlertScan();
  res.json({ data: result });
}));

router.get('/scheduler/status', requireRole('ADMIN', 'MANAGER'), wrap(async (req, res) => {
  const status = await scheduler.getStatus();
  res.json({ data: status });
}));

module.exports = router;
