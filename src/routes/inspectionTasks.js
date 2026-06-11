'use strict';

const express = require('express');
const store = require('../data/store');
const taskService = require('../services/inspectionTaskService');
const scheduleService = require('../services/inspectionScheduleService');
const { authRequired, requireRole } = require('../auth');
const { sendError, toPositiveInt, isValidDate } = require('../utils/http');

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
  if (req.query.inspectionType) filters.inspectionType = req.query.inspectionType;
  if (req.query.dueFrom) {
    if (!isValidDate(req.query.dueFrom)) return sendError(res, 400, '起始日期格式必须为 YYYY-MM-DD');
    filters.dueFrom = req.query.dueFrom;
  }
  if (req.query.dueTo) {
    if (!isValidDate(req.query.dueTo)) return sendError(res, 400, '结束日期格式必须为 YYYY-MM-DD');
    filters.dueTo = req.query.dueTo;
  }

  const list = await taskService.listTasksWithProject(filters);
  res.json({ data: list, total: list.length });
}));

router.get('/calendar', wrap(async (req, res) => {
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;
  if (!startDate || !isValidDate(startDate)) return sendError(res, 400, '起始日期格式必须为 YYYY-MM-DD');
  if (!endDate || !isValidDate(endDate)) return sendError(res, 400, '结束日期格式必须为 YYYY-MM-DD');

  const calendar = await taskService.getPlanCalendar(startDate, endDate);
  res.json({ data: calendar });
}));

router.get('/future/:projectId/:inspectionType', wrap(async (req, res) => {
  const projectId = toPositiveInt(req.params.projectId);
  if (projectId === null) return sendError(res, 400, '无效的工程 ID');
  const inspectionType = req.params.inspectionType;
  if (!scheduleService.VALID_INSPECTION_TYPES.includes(inspectionType)) {
    return sendError(res, 400, `检查类型必须是 ${scheduleService.VALID_INSPECTION_TYPES.join(' / ')}`);
  }
  const monthsAhead = toPositiveInt(req.query.monthsAhead) || 3;

  const project = await store.getProject(projectId);
  if (!project) return sendError(res, 404, '人防工程不存在');

  const tasks = await taskService.generateFutureTasks(project, inspectionType, monthsAhead);
  res.json({ data: tasks, total: tasks.length });
}));

router.get('/:id', wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的任务 ID');
  const task = await taskService.getTask(id);
  if (!task) return sendError(res, 404, '任务不存在');
  res.json({ data: task });
}));

router.post('/generate', requireRole('ADMIN', 'MANAGER'), wrap(async (req, res) => {
  const tasks = await taskService.generateAllTasks();
  res.json({ data: tasks, total: tasks.length });
}));

router.put('/:id/assign', requireRole('ADMIN', 'MANAGER'), wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的任务 ID');
  const assignedTo = toPositiveInt(req.body.assignedTo);
  if (assignedTo === null) return sendError(res, 400, '必须指定有效的负责人 ID');

  const task = await taskService.getTask(id);
  if (!task) return sendError(res, 404, '任务不存在');
  if (task.status !== 'PENDING') return sendError(res, 400, '只能分配待办状态的任务');

  const user = await store.getUser(assignedTo);
  if (!user) return sendError(res, 400, '用户不存在');

  const updated = await store.updateInspectionTask(id, { assignedTo });
  res.json({ data: updated });
}));

module.exports = router;
