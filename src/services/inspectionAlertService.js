'use strict';

const store = require('../data/store');

const ALERT_LEVELS = {
  UPCOMING: 'UPCOMING',
  DUE: 'DUE',
  OVERDUE: 'OVERDUE',
  CRITICAL: 'CRITICAL',
};

const ALERT_LEVEL_ORDER = ['UPCOMING', 'DUE', 'OVERDUE', 'CRITICAL'];

function getAlertLevel(daysUntilDue, warningDays) {
  if (daysUntilDue < -30) return ALERT_LEVELS.CRITICAL;
  if (daysUntilDue < 0) return ALERT_LEVELS.OVERDUE;
  if (daysUntilDue === 0) return ALERT_LEVELS.DUE;
  if (daysUntilDue <= warningDays) return ALERT_LEVELS.UPCOMING;
  return null;
}

function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = d1.getTime() - d2.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

async function listAlerts(filters = {}) {
  return store.listAlerts(filters);
}

async function listAlertsWithProject(filters = {}) {
  return store.listAlertsWithProject(filters);
}

async function getAlert(id) {
  return store.getAlert(id);
}

async function acknowledgeAlert(id, userId) {
  const alert = await store.getAlert(id);
  if (!alert) throw new Error('预警不存在');
  if (alert.status !== 'ACTIVE') throw new Error('预警已处理');
  return store.acknowledgeAlert(id, userId);
}

async function clearAlert(id, reason = 'MANUAL_CLEAR') {
  const alert = await store.getAlert(id);
  if (!alert) throw new Error('预警不存在');
  return store.clearAlertsForTask(alert.taskId, reason);
}

async function processTaskForAlerts(task, today = null) {
  if (task.status !== 'PENDING') return null;

  const todayDate = today || new Date();
  const todayStr = todayDate.toISOString().split('T')[0];
  const daysUntilDue = daysBetween(task.dueDate, todayStr);

  const rule = task.scheduleRuleId
    ? await store.getScheduleRule(task.scheduleRuleId)
    : null;
  const warningDays = rule ? rule.warningDays : 7;

  const alertLevel = getAlertLevel(daysUntilDue, warningDays);
  if (!alertLevel) return null;

  const existingHighest = await store.findHighestActiveAlertForTask(task.id);

  if (existingHighest) {
    const existingRank = ALERT_LEVEL_ORDER.indexOf(existingHighest.alertLevel);
    const newRank = ALERT_LEVEL_ORDER.indexOf(alertLevel);

    if (newRank > existingRank) {
      await store.escalateAlert(existingHighest.id, alertLevel);
      return { ...existingHighest, alertLevel, escalated: true };
    }

    if (existingHighest.alertLevel === alertLevel) {
      return existingHighest;
    }
  }

  const alert = await store.createAlert({
    taskId: task.id,
    projectId: task.projectId,
    inspectionType: task.inspectionType,
    dueDate: task.dueDate,
    alertLevel,
    alertDate: todayStr,
    status: 'ACTIVE',
  });

  return { ...alert, isNew: true };
}

async function scanAndGenerateAlerts() {
  const today = new Date();
  const pendingTasks = await store.listInspectionTasks({ status: 'PENDING' });

  const results = [];
  for (const task of pendingTasks) {
    try {
      const result = await processTaskForAlerts(task, today);
      if (result) results.push(result);
    } catch (err) {
      console.error(`处理任务 ${task.id} 预警失败:`, err);
    }
  }

  const summary = {
    total: results.length,
    new: results.filter((r) => r.isNew).length,
    escalated: results.filter((r) => r.escalated).length,
    critical: results.filter((r) => r.alertLevel === 'CRITICAL').length,
    overdue: results.filter((r) => r.alertLevel === 'OVERDUE').length,
    due: results.filter((r) => r.alertLevel === 'DUE').length,
    upcoming: results.filter((r) => r.alertLevel === 'UPCOMING').length,
  };

  return { results, summary };
}

module.exports = {
  ALERT_LEVELS,
  ALERT_LEVEL_ORDER,
  getAlertLevel,
  daysBetween,
  listAlerts,
  listAlertsWithProject,
  getAlert,
  acknowledgeAlert,
  clearAlert,
  processTaskForAlerts,
  scanAndGenerateAlerts,
};
