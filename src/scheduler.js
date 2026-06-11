'use strict';

const alertService = require('./services/inspectionAlertService');
const taskService = require('./services/inspectionTaskService');
const store = require('./data/store');

const ALERT_SCAN_INTERVAL_MS = 60 * 60 * 1000;
const TASK_GENERATE_INTERVAL_MS = 24 * 60 * 60 * 1000;

let alertScanTimer = null;
let taskGenerateTimer = null;
let isRunning = false;

async function runAlertScan() {
  if (isRunning) return;
  isRunning = true;
  const startTime = Date.now();

  try {
    const result = await alertService.scanAndGenerateAlerts();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[调度器] 预警扫描完成: 生成 ${result.summary.total} 条预警 ` +
                `(新: ${result.summary.new}, 升级: ${result.summary.escalated}) ` +
                `[严重: ${result.summary.critical}, 超期: ${result.summary.overdue}, ` +
                `到期: ${result.summary.due}, 临近: ${result.summary.upcoming}] ` +
                `耗时 ${duration}s`);
    return result;
  } catch (err) {
    console.error('[调度器] 预警扫描失败:', err);
    throw err;
  } finally {
    isRunning = false;
  }
}

async function runTaskGeneration() {
  const startTime = Date.now();
  try {
    const tasks = await taskService.generateAllTasks();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[调度器] 任务生成完成: 共 ${tasks.length} 个待办任务 耗时 ${duration}s`);
    return tasks;
  } catch (err) {
    console.error('[调度器] 任务生成失败:', err);
    throw err;
  }
}

async function runRecoveryScan() {
  console.log('[调度器] 服务启动，执行恢复扫描...');
  await runTaskGeneration();
  const result = await runAlertScan();
  console.log('[调度器] 恢复扫描完成，未处理的到期任务已重新生成预警');
  return result;
}

function start() {
  if (alertScanTimer || taskGenerateTimer) return;

  runRecoveryScan().catch((err) => {
    console.error('[调度器] 启动时恢复扫描失败:', err);
  });

  alertScanTimer = setInterval(() => {
    runAlertScan().catch((err) => {
      console.error('[调度器] 定时预警扫描失败:', err);
    });
  }, ALERT_SCAN_INTERVAL_MS);

  taskGenerateTimer = setInterval(() => {
    runTaskGeneration().catch((err) => {
      console.error('[调度器] 定时任务生成失败:', err);
    });
  }, TASK_GENERATE_INTERVAL_MS);

  console.log(`[调度器] 已启动 - 预警扫描每 ${ALERT_SCAN_INTERVAL_MS / 60000} 分钟，` +
              `任务生成每 ${TASK_GENERATE_INTERVAL_MS / 60000} 分钟`);
}

function stop() {
  if (alertScanTimer) {
    clearInterval(alertScanTimer);
    alertScanTimer = null;
  }
  if (taskGenerateTimer) {
    clearInterval(taskGenerateTimer);
    taskGenerateTimer = null;
  }
  console.log('[调度器] 已停止');
}

async function getStatus() {
  const pendingTasks = await store.listInspectionTasks({ status: 'PENDING' });
  const activeAlerts = await store.listAlerts({ status: 'ACTIVE' });

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const overdueTasks = pendingTasks.filter((t) => t.dueDate < todayStr);
  const dueTodayTasks = pendingTasks.filter((t) => t.dueDate === todayStr);
  const upcomingTasks = pendingTasks.filter((t) => {
    const diff = Math.ceil((new Date(t.dueDate) - today) / (1000 * 60 * 60 * 24));
    return diff > 0 && diff <= 7;
  });

  return {
    running: alertScanTimer !== null && taskGenerateTimer !== null,
    alertScanIntervalMs: ALERT_SCAN_INTERVAL_MS,
    taskGenerateIntervalMs: TASK_GENERATE_INTERVAL_MS,
    stats: {
      pendingTasks: pendingTasks.length,
      overdueTasks: overdueTasks.length,
      dueTodayTasks: dueTodayTasks.length,
      upcomingTasks: upcomingTasks.length,
      activeAlerts: activeAlerts.length,
      criticalAlerts: activeAlerts.filter((a) => a.alertLevel === 'CRITICAL').length,
      overdueAlerts: activeAlerts.filter((a) => a.alertLevel === 'OVERDUE').length,
    },
  };
}

module.exports = {
  start,
  stop,
  runAlertScan,
  runTaskGeneration,
  runRecoveryScan,
  getStatus,
};
