'use strict';

const store = require('../data/store');
const scheduleService = require('./inspectionScheduleService');

async function listTasks(filters = {}) {
  return store.listInspectionTasks(filters);
}

async function listTasksWithProject(filters = {}) {
  return store.listInspectionTasksWithProject(filters);
}

async function getTask(id) {
  return store.getInspectionTask(id);
}

async function generateTaskForProjectAndType(project, inspectionType) {
  const existing = await store.findPendingTask(project.id, inspectionType);
  if (existing) return existing;

  const result = await scheduleService.calculateNextDueDate(project, inspectionType);
  if (!result) return null;

  const { dueDate, rule, lastInspection } = result;

  return store.createInspectionTask({
    projectId: project.id,
    inspectionType,
    scheduleRuleId: rule.id,
    lastInspectionId: lastInspection ? lastInspection.id : null,
    lastInspectDate: lastInspection ? lastInspection.inspectDate : null,
    dueDate,
    status: 'PENDING',
  });
}

async function generateTasksForProject(project) {
  const types = ['ROUTINE', 'QUARTERLY', 'ANNUAL'];
  const tasks = [];
  for (const type of types) {
    const task = await generateTaskForProjectAndType(project, type);
    if (task) tasks.push(task);
  }
  return tasks;
}

async function generateAllTasks() {
  const projects = await store.listProjects();
  const allTasks = [];
  for (const project of projects) {
    const tasks = await generateTasksForProject(project);
    allTasks.push(...tasks);
  }
  return allTasks;
}

async function generateFutureTasks(project, inspectionType, monthsAhead = 3) {
  const tasks = [];
  let currentProject = { ...project };
  let lastDate = null;
  let lastInspection = await store.getLastInspectionByType(project.id, inspectionType);

  for (let i = 0; i < monthsAhead * 2; i += 1) {
    const result = await scheduleService.calculateNextDueDate(currentProject, inspectionType);
    if (!result) break;

    const { dueDate, rule } = result;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() + monthsAhead);
    if (new Date(dueDate) > cutoff) break;

    if (lastDate && dueDate === lastDate) break;

    tasks.push({
      projectId: project.id,
      projectName: project.name,
      inspectionType,
      dueDate,
      cycleDays: rule.cycleDays,
      warningDays: rule.warningDays,
    });

    lastDate = dueDate;
    lastInspection = { inspectDate: dueDate };
    currentProject = { ...project, completedAt: dueDate };
  }

  return tasks;
}

async function getPlanCalendar(startDate, endDate) {
  const tasks = await store.listInspectionTasksWithProject({
    status: 'PENDING',
    dueFrom: startDate,
    dueTo: endDate,
  });

  const calendar = {};
  const s = new Date(startDate);
  const e = new Date(endDate);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split('T')[0];
    calendar[key] = [];
  }

  for (const task of tasks) {
    if (calendar[task.dueDate]) {
      calendar[task.dueDate].push(task);
    }
  }

  return calendar;
}

async function completeTask(taskId, inspectionId) {
  const task = await store.getInspectionTask(taskId);
  if (!task) throw new Error('检查任务不存在');

  await store.updateInspectionTask(taskId, {
    status: 'COMPLETED',
    currentInspectionId: inspectionId,
    completedAt: new Date(),
  });

  await store.clearAlertsForTask(taskId, 'INSPECTION_COMPLETED');

  const project = await store.getProject(task.projectId);
  if (project) {
    await generateTaskForProjectAndType(project, task.inspectionType);
  }

  return store.getInspectionTask(taskId);
}

module.exports = {
  listTasks,
  listTasksWithProject,
  getTask,
  generateTaskForProjectAndType,
  generateTasksForProject,
  generateAllTasks,
  generateFutureTasks,
  getPlanCalendar,
  completeTask,
};
