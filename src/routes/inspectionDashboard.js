'use strict';

const express = require('express');
const store = require('../data/store');
const taskService = require('../services/inspectionTaskService');
const { authRequired } = require('../auth');
const { sendError, toPositiveInt, isValidDate } = require('../utils/http');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(authRequired);

router.get('/stats/monthly', wrap(async (req, res) => {
  const year = toPositiveInt(req.query.year);
  const month = toPositiveInt(req.query.month);
  const now = new Date();

  const y = year || now.getFullYear();
  const m = month || (now.getMonth() + 1);

  if (m < 1 || m > 12) return sendError(res, 400, '月份必须在 1-12 之间');

  const stats = await store.getMonthlyStats(y, m);
  const total = stats.due + stats.overdue;
  const completionRate = total > 0 ? Math.round((stats.completed / total) * 100) : 0;

  res.json({
    data: {
      year: y,
      month: m,
      ...stats,
      total,
      completionRate,
    },
  });
}));

router.get('/stats/overview', wrap(async (req, res) => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];
  const nextMonth = new Date(now);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextMonthStr = nextMonth.toISOString().split('T')[0];

  const pendingTasks = await store.listInspectionTasks({ status: 'PENDING' });
  const activeAlerts = await store.listAlerts({ status: 'ACTIVE' });

  const overdue = pendingTasks.filter((t) => t.dueDate < today);
  const todayTasks = pendingTasks.filter((t) => t.dueDate === today);
  const thisWeek = pendingTasks.filter((t) => t.dueDate > today && t.dueDate <= nextWeekStr);
  const thisMonth = pendingTasks.filter((t) => t.dueDate > nextWeekStr && t.dueDate <= nextMonthStr);

  const typeCounts = pendingTasks.reduce((acc, t) => {
    acc[t.inspectionType] = (acc[t.inspectionType] || 0) + 1;
    return acc;
  }, {});

  const alertCounts = activeAlerts.reduce((acc, a) => {
    acc[a.alertLevel] = (acc[a.alertLevel] || 0) + 1;
    return acc;
  }, {});

  res.json({
    data: {
      pendingTasks: pendingTasks.length,
      activeAlerts: activeAlerts.length,
      breakdown: {
        overdue: overdue.length,
        today: todayTasks.length,
        thisWeek: thisWeek.length,
        thisMonth: thisMonth.length,
        later: pendingTasks.length - overdue.length - todayTasks.length - thisWeek.length - thisMonth.length,
      },
      byType: typeCounts,
      byAlertLevel: alertCounts,
    },
  });
}));

router.get('/ranking/timeliness', wrap(async (req, res) => {
  const fromDate = req.query.fromDate;
  const toDate = req.query.toDate;
  const filters = {};

  if (fromDate) {
    if (!isValidDate(fromDate)) return sendError(res, 400, '起始日期格式必须为 YYYY-MM-DD');
    filters.fromDate = fromDate;
  }
  if (toDate) {
    if (!isValidDate(toDate)) return sendError(res, 400, '结束日期格式必须为 YYYY-MM-DD');
    filters.toDate = toDate;
  }

  const ranking = await store.getProjectTimelinessRank(filters);
  res.json({ data: ranking, total: ranking.length });
}));

router.get('/calendar', wrap(async (req, res) => {
  let startDate = req.query.startDate;
  let endDate = req.query.endDate;

  if (!startDate || !isValidDate(startDate)) {
    const s = new Date();
    s.setDate(1);
    startDate = s.toISOString().split('T')[0];
  }
  if (!endDate || !isValidDate(endDate)) {
    const e = new Date(startDate);
    e.setMonth(e.getMonth() + 1);
    e.setDate(0);
    endDate = e.toISOString().split('T')[0];
  }

  const calendar = await taskService.getPlanCalendar(startDate, endDate);
  res.json({
    data: {
      startDate,
      endDate,
      calendar,
    },
  });
}));

router.get('/list', wrap(async (req, res) => {
  const filters = {};
  if (req.query.projectId !== undefined) {
    const pid = toPositiveInt(req.query.projectId);
    if (pid === null) return sendError(res, 400, '无效的工程 ID');
    filters.projectId = pid;
  }
  if (req.query.status) filters.status = req.query.status;
  if (req.query.inspectionType) filters.inspectionType = req.query.inspectionType;

  let startDate = req.query.startDate;
  let endDate = req.query.endDate;

  if (!startDate || !isValidDate(startDate)) {
    const s = new Date();
    s.setDate(1);
    startDate = s.toISOString().split('T')[0];
  }
  if (!endDate || !isValidDate(endDate)) {
    const e = new Date(startDate);
    e.setMonth(e.getMonth() + 2);
    e.setDate(0);
    endDate = e.toISOString().split('T')[0];
  }

  filters.dueFrom = startDate;
  filters.dueTo = endDate;

  const list = await taskService.listTasksWithProject(filters);
  const grouped = list.reduce((acc, task) => {
    const date = task.dueDate;
    if (!acc[date]) acc[date] = [];
    acc[date].push(task);
    return acc;
  }, {});

  res.json({
    data: {
      startDate,
      endDate,
      list,
      groupedByDate: grouped,
    },
    total: list.length,
  });
}));

module.exports = router;
