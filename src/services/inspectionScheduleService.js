'use strict';

const store = require('../data/store');

const VALID_INSPECTION_TYPES = ['ROUTINE', 'QUARTERLY', 'ANNUAL', 'SPECIAL'];

function validateRule(r) {
  if (!VALID_INSPECTION_TYPES.includes(r.inspectionType)) {
    throw new Error(`检查类型必须是 ${VALID_INSPECTION_TYPES.join(' / ')}`);
  }
  if (!Number.isInteger(r.cycleDays) || r.cycleDays <= 0) {
    throw new Error('检查周期必须是正整数天数');
  }
  if (r.warningDays !== undefined && (!Number.isInteger(r.warningDays) || r.warningDays < 0)) {
    throw new Error('预警提前天数必须是非负整数');
  }
  if (r.projectType === '') r.projectType = null;
  if (r.protectionLevel === '') r.protectionLevel = null;
}

async function listRules(filters = {}) {
  return store.listScheduleRules(filters);
}

async function getRule(id) {
  return store.getScheduleRule(id);
}

async function createRule(r) {
  validateRule(r);
  return store.createScheduleRule(r);
}

async function updateRule(id, patch) {
  const existing = await store.getScheduleRule(id);
  if (!existing) throw new Error('规则不存在');
  if (patch.inspectionType !== undefined) {
    if (!VALID_INSPECTION_TYPES.includes(patch.inspectionType)) {
      throw new Error(`检查类型必须是 ${VALID_INSPECTION_TYPES.join(' / ')}`);
    }
  }
  if (patch.cycleDays !== undefined && (!Number.isInteger(patch.cycleDays) || patch.cycleDays <= 0)) {
    throw new Error('检查周期必须是正整数天数');
  }
  if (patch.warningDays !== undefined && (!Number.isInteger(patch.warningDays) || patch.warningDays < 0)) {
    throw new Error('预警提前天数必须是非负整数');
  }
  return store.updateScheduleRule(id, patch);
}

async function deleteRule(id) {
  const existing = await store.getScheduleRule(id);
  if (!existing) throw new Error('规则不存在');
  return store.deleteScheduleRule(id);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function calculateNextDueDate(project, inspectionType) {
  const rule = await store.findMatchingScheduleRule(
    inspectionType,
    project.type,
    project.protectionLevel,
  );
  if (!rule) return null;

  const lastInspection = await store.getLastInspectionByType(project.id, inspectionType);
  const baseDate = lastInspection ? lastInspection.inspectDate : project.completedAt;

  if (!baseDate) return null;

  return {
    dueDate: addDays(baseDate, rule.cycleDays),
    rule,
    lastInspection,
  };
}

module.exports = {
  VALID_INSPECTION_TYPES,
  listRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  calculateNextDueDate,
  addDays,
};
