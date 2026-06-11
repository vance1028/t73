'use strict';

const express = require('express');
const scheduleService = require('../services/inspectionScheduleService');
const { authRequired, requireRole } = require('../auth');
const { sendError, toPositiveInt } = require('../utils/http');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(authRequired);

router.get('/', wrap(async (req, res) => {
  const filters = {};
  if (req.query.inspectionType) filters.inspectionType = req.query.inspectionType;
  if (req.query.enabled !== undefined) filters.enabled = req.query.enabled === 'true';
  const list = await scheduleService.listRules(filters);
  res.json({ data: list, total: list.length });
}));

router.get('/:id', wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的规则 ID');
  const rule = await scheduleService.getRule(id);
  if (!rule) return sendError(res, 404, '规则不存在');
  res.json({ data: rule });
}));

router.post('/', requireRole('ADMIN', 'MANAGER'), wrap(async (req, res) => {
  const b = req.body || {};
  try {
    const rule = await scheduleService.createRule({
      inspectionType: b.inspectionType,
      projectType: b.projectType,
      protectionLevel: b.protectionLevel,
      cycleDays: toPositiveInt(b.cycleDays),
      warningDays: b.warningDays !== undefined ? toPositiveInt(b.warningDays) : 7,
      enabled: b.enabled !== false,
    });
    res.status(201).json({ data: rule });
  } catch (err) {
    return sendError(res, 400, err.message);
  }
}));

router.put('/:id', requireRole('ADMIN', 'MANAGER'), wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的规则 ID');
  const b = req.body || {};
  try {
    const patch = {};
    if (b.inspectionType !== undefined) patch.inspectionType = b.inspectionType;
    if (b.projectType !== undefined) patch.projectType = b.projectType;
    if (b.protectionLevel !== undefined) patch.protectionLevel = b.protectionLevel;
    if (b.cycleDays !== undefined) patch.cycleDays = toPositiveInt(b.cycleDays);
    if (b.warningDays !== undefined) patch.warningDays = toPositiveInt(b.warningDays);
    if (b.enabled !== undefined) patch.enabled = b.enabled;
    const rule = await scheduleService.updateRule(id, patch);
    res.json({ data: rule });
  } catch (err) {
    return sendError(res, 400, err.message);
  }
}));

router.delete('/:id', requireRole('ADMIN'), wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的规则 ID');
  try {
    const ok = await scheduleService.deleteRule(id);
    res.json({ success: ok });
  } catch (err) {
    return sendError(res, 400, err.message);
  }
}));

module.exports = router;
