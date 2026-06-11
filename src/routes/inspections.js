'use strict';

const express = require('express');
const store = require('../data/store');
const taskService = require('../services/inspectionTaskService');
const { authRequired, requireRole } = require('../auth');
const { sendError, toPositiveInt, isValidDate } = require('../utils/http');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const VALID_TYPE = ['ROUTINE', 'QUARTERLY', 'ANNUAL', 'SPECIAL'];
const VALID_RESULT = ['PASS', 'FAIL'];

router.use(authRequired);

// 检查记录列表（可按工程筛选）
router.get('/', wrap(async (req, res) => {
  const filters = {};
  if (req.query.projectId !== undefined) {
    const pid = toPositiveInt(req.query.projectId);
    if (pid === null) return sendError(res, 400, '无效的工程 ID');
    filters.projectId = pid;
  }
  const list = await store.listInspections(filters);
  res.json({ data: list, total: list.length });
}));

// 登记检查记录（管理员/工程管理员/巡检员都可以登记）
router.post('/', requireRole('ADMIN', 'MANAGER', 'INSPECTOR'), wrap(async (req, res) => {
  const b = req.body || {};
  const pid = toPositiveInt(b.projectId);
  if (pid === null) return sendError(res, 400, '必须指定有效的工程 ID');
  if (!(await store.getProject(pid))) return sendError(res, 400, '人防工程不存在');
  if (!isValidDate(b.inspectDate)) return sendError(res, 400, '检查日期格式必须为 YYYY-MM-DD');
  const inspectionType = b.type || 'ROUTINE';
  if (!VALID_TYPE.includes(inspectionType)) {
    return sendError(res, 400, `检查类型只能是 ${VALID_TYPE.join(' / ')}`);
  }
  if (b.result !== undefined && !VALID_RESULT.includes(b.result)) {
    return sendError(res, 400, `检查结果只能是 ${VALID_RESULT.join(' / ')}`);
  }
  const inspectorId = b.inspectorId ? toPositiveInt(b.inspectorId) : req.user.id;
  const rec = await store.createInspection({
    projectId: pid,
    inspectorId,
    inspectDate: b.inspectDate,
    type: inspectionType,
    result: b.result || 'PASS',
    issues: typeof b.issues === 'string' ? b.issues : '',
  });

  const pendingTask = await store.findPendingTask(pid, inspectionType);
  let completedTask = null;
  if (pendingTask) {
    completedTask = await taskService.completeTask(pendingTask.id, rec.id);
  }

  res.status(201).json({
    data: rec,
    taskCompleted: !!completedTask,
    nextTask: completedTask && (await store.findPendingTask(pid, inspectionType)),
  });
}));

module.exports = router;
