'use strict';

/**
 * 数据仓储层 - 基于 MySQL（mysql2/promise）。
 * 所有方法 async，返回 camelCase 字段对象。
 */

const { pool } = require('../db');
const { hashPassword } = require('../utils/password');

/* ----------------------------- 映射 ----------------------------- */

function mapUser(r) {
  if (!r) return null;
  return {
    id: r.id,
    username: r.username,
    name: r.name,
    role: r.role,
    department: r.department,
    status: r.status,
    createdAt: r.created_at,
  };
}

// 含密码哈希的内部映射，仅登录校验用，绝不直接返回给前端
function mapUserWithHash(r) {
  if (!r) return null;
  return { ...mapUser(r), passwordHash: r.password_hash };
}

function mapProject(r) {
  if (!r) return null;
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type,
    protectionLevel: r.protection_level,
    areaSqm: Number(r.area_sqm),
    address: r.address,
    district: r.district,
    peacetimeUse: r.peacetime_use,
    status: r.status,
    completedAt: r.completed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapEquipment(r) {
  if (!r) return null;
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    category: r.category,
    model: r.model,
    installDate: r.install_date,
    status: r.status,
    createdAt: r.created_at,
  };
}

function mapInspection(r) {
  if (!r) return null;
  return {
    id: r.id,
    projectId: r.project_id,
    inspectorId: r.inspector_id,
    inspectDate: r.inspect_date,
    type: r.type,
    result: r.result,
    issues: r.issues,
    createdAt: r.created_at,
  };
}

function mapScheduleRule(r) {
  if (!r) return null;
  return {
    id: r.id,
    inspectionType: r.inspection_type,
    projectType: r.project_type,
    protectionLevel: r.protection_level,
    cycleDays: r.cycle_days,
    warningDays: r.warning_days,
    enabled: Boolean(r.enabled),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapInspectionTask(r) {
  if (!r) return null;
  return {
    id: r.id,
    projectId: r.project_id,
    inspectionType: r.inspection_type,
    scheduleRuleId: r.schedule_rule_id,
    lastInspectionId: r.last_inspection_id,
    lastInspectDate: r.last_inspect_date,
    dueDate: r.due_date,
    status: r.status,
    assignedTo: r.assigned_to,
    currentInspectionId: r.current_inspection_id,
    generatedAt: r.generated_at,
    completedAt: r.completed_at,
  };
}

function mapInspectionAlert(r) {
  if (!r) return null;
  return {
    id: r.id,
    taskId: r.task_id,
    projectId: r.project_id,
    inspectionType: r.inspection_type,
    dueDate: r.due_date,
    alertLevel: r.alert_level,
    alertDate: r.alert_date,
    status: r.status,
    acknowledgedBy: r.acknowledged_by,
    acknowledgedAt: r.acknowledged_at,
    clearedAt: r.cleared_at,
    clearedReason: r.cleared_reason,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/* --------------------------- 初始化/重置 --------------------------- */

async function seed() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of ['inspection_alerts', 'inspection_tasks', 'inspection_schedule_rules', 'inspections', 'equipments', 'projects', 'users']) {
      await conn.query(`TRUNCATE TABLE ${t}`);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // 用户（密码运行时哈希）：admin/admin123, manager/manager123, inspector/inspect123
    await conn.query(
      `INSERT INTO users (id, username, password_hash, name, role, department) VALUES
        (1, 'admin', ?, '系统管理员', 'ADMIN', '人防办信息科'),
        (2, 'manager', ?, '张管理', 'MANAGER', '工程管理科'),
        (3, 'inspector', ?, '李巡检', 'INSPECTOR', '维护管理科')`,
      [hashPassword('admin123'), hashPassword('manager123'), hashPassword('inspect123')],
    );

    await conn.query(
      `INSERT INTO projects (id, code, name, type, protection_level, area_sqm, address, district, peacetime_use, status, completed_at) VALUES
        (1, 'RF-2024-001', '中心广场地下人防工程', 'COMBINED', '6', 8600.50, '人民中路1号地下', '城关区', '地下停车场', 'NORMAL', '2018-09-01'),
        (2, 'RF-2024-002', '滨江路防空地下室', 'BASEMENT', '6B', 3200.00, '滨江路88号', '江南区', '商业仓储', 'NORMAL', '2020-05-15'),
        (3, 'RF-2024-003', '老城区单建掘开式工程', 'SINGLE', '5', 5400.00, '解放街地下', '城关区', '暂未利用', 'MAINTENANCE', '2010-03-20'),
        (4, 'RF-2024-004', '科技园人员掩蔽所', 'SHELTER', '6', 2100.00, '科技大道12号地下', '高新区', '社区活动中心', 'NORMAL', '2021-11-30')`,
    );

    await conn.query(
      `INSERT INTO equipments (project_id, name, category, model, install_date, status) VALUES
        (1, '1号防护密闭门', 'PROTECTIVE_DOOR', 'HFM2030', '2018-08-01', 'NORMAL'),
        (1, '战时通风机', 'VENTILATION', 'F300', '2018-08-10', 'NORMAL'),
        (1, '柴油发电机组', 'POWER', '50GF', '2018-08-15', 'NORMAL'),
        (2, '防爆波活门', 'PROTECTIVE_DOOR', 'HK600', '2020-04-20', 'NORMAL'),
        (2, '给排水泵', 'WATER', 'WQ15', '2020-05-01', 'FAULT'),
        (3, '滤毒通风设备', 'VENTILATION', 'LD60', '2010-03-01', 'MAINTENANCE')`,
    );

    await conn.query(
      `INSERT INTO inspections (id, project_id, inspector_id, inspect_date, type, result, issues) VALUES
        (1, 1, 3, '2026-05-10', 'ROUTINE', 'PASS', ''),
        (2, 2, 3, '2026-05-12', 'ROUTINE', 'FAIL', '给排水泵故障，需更换'),
        (3, 3, 3, '2026-04-20', 'SPECIAL', 'FAIL', '滤毒设备老化，建议大修'),
        (4, 1, 3, '2026-06-01', 'ROUTINE', 'PASS', ''),
        (5, 3, 3, '2026-03-15', 'ROUTINE', 'PASS', ''),
        (6, 4, 3, '2026-05-20', 'ROUTINE', 'PASS', ''),
        (7, 1, 2, '2026-03-01', 'QUARTERLY', 'PASS', ''),
        (8, 2, 2, '2026-03-05', 'QUARTERLY', 'PASS', ''),
        (9, 1, 2, '2025-12-01', 'ANNUAL', 'PASS', '')`,
    );

    await conn.query(
      `INSERT INTO inspection_schedule_rules (id, inspection_type, project_type, protection_level, cycle_days, warning_days, enabled) VALUES
        (1, 'ROUTINE', NULL, NULL, 30, 7, 1),
        (2, 'ROUTINE', 'SINGLE', '5', 20, 10, 1),
        (3, 'ROUTINE', 'COMBINED', '6', 25, 7, 1),
        (4, 'QUARTERLY', NULL, NULL, 90, 15, 1),
        (5, 'QUARTERLY', NULL, '5', 60, 20, 1),
        (6, 'ANNUAL', NULL, NULL, 365, 30, 1),
        (7, 'ANNUAL', NULL, '5', 365, 45, 1),
        (8, 'SPECIAL', NULL, NULL, 180, 10, 1)`,
    );

    const today = new Date(2026, 5, 11);
    const fmt = (d) => d.toISOString().split('T')[0];
    const daysFromToday = (n) => { const d = new Date(today); d.setDate(today.getDate() + n); return fmt(d); };
    const daysAgo = (n) => { const d = new Date(today); d.setDate(today.getDate() - n); return fmt(d); };

    await conn.query(
      `INSERT INTO inspection_tasks (id, project_id, inspection_type, schedule_rule_id, last_inspection_id, last_inspect_date, due_date, status, assigned_to) VALUES
        (1, 1, 'ROUTINE', 3, 4, '2026-06-01', ?, 'PENDING', 3),
        (2, 2, 'ROUTINE', 1, 2, '2026-05-12', ?, 'PENDING', 3),
        (3, 3, 'ROUTINE', 2, 5, '2026-03-15', ?, 'PENDING', 3),
        (4, 4, 'ROUTINE', 1, 6, '2026-05-20', ?, 'PENDING', 3),
        (5, 1, 'QUARTERLY', 4, 7, '2026-03-01', ?, 'PENDING', 2),
        (6, 2, 'QUARTERLY', 4, 8, '2026-03-05', ?, 'PENDING', 2),
        (7, 3, 'QUARTERLY', 5, NULL, NULL, ?, 'PENDING', 2),
        (8, 1, 'ANNUAL', 7, 9, '2025-12-01', ?, 'PENDING', 2),
        (9, 4, 'QUARTERLY', 4, NULL, NULL, ?, 'PENDING', 2),
        (10, 3, 'ANNUAL', 7, NULL, NULL, ?, 'PENDING', 2),
        (11, 4, 'ANNUAL', 6, NULL, NULL, ?, 'PENDING', 2)`,
      [
        daysFromToday(20),
        daysAgo(30),
        daysAgo(15),
        daysFromToday(9),
        daysFromToday(19),
        daysAgo(7),
        daysFromToday(50),
        daysAgo(190),
        daysFromToday(60),
        daysFromToday(80),
        daysFromToday(200),
      ],
    );

    await conn.query(
      `INSERT INTO inspection_alerts (task_id, project_id, inspection_type, due_date, alert_level, alert_date, status) VALUES
        (2, 2, 'ROUTINE', ?, 'OVERDUE', ?, 'ACTIVE'),
        (3, 3, 'ROUTINE', ?, 'OVERDUE', ?, 'ACTIVE'),
        (6, 2, 'QUARTERLY', ?, 'OVERDUE', ?, 'ACTIVE'),
        (8, 1, 'ANNUAL', ?, 'CRITICAL', ?, 'ACTIVE'),
        (4, 4, 'ROUTINE', ?, 'UPCOMING', ?, 'ACTIVE'),
        (1, 1, 'ROUTINE', ?, 'UPCOMING', ?, 'ACTIVE')`,
      [
        daysAgo(30), daysAgo(28),
        daysAgo(15), daysAgo(13),
        daysAgo(7), daysAgo(5),
        daysAgo(190), daysAgo(60),
        daysFromToday(9), daysFromToday(2),
        daysFromToday(20), daysFromToday(13),
      ],
    );
  } finally {
    conn.release();
  }
}

async function isEmpty() {
  const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM users');
  return rows[0].cnt === 0;
}

/* ----------------------------- 用户 ----------------------------- */

async function findUserByUsername(username) {
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  return mapUserWithHash(rows[0]);
}

async function getUser(id) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
  return mapUser(rows[0]);
}

async function listUsers() {
  const [rows] = await pool.query('SELECT * FROM users ORDER BY id');
  return rows.map(mapUser);
}

async function createUser({ username, password, name = '', role = 'INSPECTOR', department = '' }) {
  const [r] = await pool.query(
    'INSERT INTO users (username, password_hash, name, role, department) VALUES (?, ?, ?, ?, ?)',
    [username, hashPassword(password), name, role, department],
  );
  return getUser(r.insertId);
}

/* ----------------------------- 人防工程 ----------------------------- */

async function listProjects({ status, district, keyword } = {}) {
  const where = [];
  const params = [];
  if (status !== undefined) { where.push('status = ?'); params.push(status); }
  if (district !== undefined) { where.push('district = ?'); params.push(district); }
  if (keyword !== undefined && keyword !== '') {
    where.push('(name LIKE ? OR code LIKE ? OR address LIKE ?)');
    const like = `%${keyword}%`;
    params.push(like, like, like);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(`SELECT * FROM projects ${clause} ORDER BY id`, params);
  return rows.map(mapProject);
}

async function getProject(id) {
  const [rows] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
  return mapProject(rows[0]);
}

async function findProjectByCode(code) {
  const [rows] = await pool.query('SELECT * FROM projects WHERE code = ?', [code]);
  return mapProject(rows[0]);
}

async function createProject(p) {
  const [r] = await pool.query(
    `INSERT INTO projects (code, name, type, protection_level, area_sqm, address, district, peacetime_use, status, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.code, p.name, p.type || 'COMBINED', p.protectionLevel || '6', p.areaSqm || 0,
     p.address || '', p.district || '', p.peacetimeUse || '', p.status || 'NORMAL', p.completedAt || null],
  );
  return getProject(r.insertId);
}

async function updateProject(id, patch) {
  const map = {
    name: 'name', type: 'type', protectionLevel: 'protection_level', areaSqm: 'area_sqm',
    address: 'address', district: 'district', peacetimeUse: 'peacetime_use',
    status: 'status', completedAt: 'completed_at',
  };
  const sets = [];
  const params = [];
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) { sets.push(`${col} = ?`); params.push(patch[k]); }
  }
  if (sets.length) {
    sets.push('updated_at = CURRENT_TIMESTAMP(3)');
    params.push(id);
    await pool.query(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, params);
  }
  return getProject(id);
}

async function deleteProject(id) {
  const [r] = await pool.query('DELETE FROM projects WHERE id = ?', [id]);
  return r.affectedRows > 0;
}

/* ----------------------------- 设备设施 ----------------------------- */

async function listEquipments(projectId) {
  const [rows] = await pool.query(
    'SELECT * FROM equipments WHERE project_id = ? ORDER BY id', [projectId]);
  return rows.map(mapEquipment);
}

async function createEquipment(e) {
  const [r] = await pool.query(
    `INSERT INTO equipments (project_id, name, category, model, install_date, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [e.projectId, e.name, e.category || 'OTHER', e.model || '', e.installDate || null, e.status || 'NORMAL'],
  );
  const [rows] = await pool.query('SELECT * FROM equipments WHERE id = ?', [r.insertId]);
  return mapEquipment(rows[0]);
}

/* ----------------------------- 检查记录 ----------------------------- */

async function listInspections({ projectId } = {}) {
  if (projectId !== undefined) {
    const [rows] = await pool.query(
      'SELECT * FROM inspections WHERE project_id = ? ORDER BY inspect_date DESC, id DESC', [projectId]);
    return rows.map(mapInspection);
  }
  const [rows] = await pool.query('SELECT * FROM inspections ORDER BY inspect_date DESC, id DESC');
  return rows.map(mapInspection);
}

async function createInspection(i) {
  const [r] = await pool.query(
    `INSERT INTO inspections (project_id, inspector_id, inspect_date, type, result, issues)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [i.projectId, i.inspectorId || null, i.inspectDate, i.type || 'ROUTINE', i.result || 'PASS', i.issues || ''],
  );
  const [rows] = await pool.query('SELECT * FROM inspections WHERE id = ?', [r.insertId]);
  return mapInspection(rows[0]);
}

async function getLastInspectionByType(projectId, inspectionType) {
  const [rows] = await pool.query(
    'SELECT * FROM inspections WHERE project_id = ? AND type = ? ORDER BY inspect_date DESC, id DESC LIMIT 1',
    [projectId, inspectionType],
  );
  return mapInspection(rows[0]);
}

/* ----------------------------- 检查计划规则 ----------------------------- */

async function listScheduleRules({ inspectionType, enabled } = {}) {
  const where = [];
  const params = [];
  if (inspectionType !== undefined) { where.push('inspection_type = ?'); params.push(inspectionType); }
  if (enabled !== undefined) { where.push('enabled = ?'); params.push(enabled ? 1 : 0); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(`SELECT * FROM inspection_schedule_rules ${clause} ORDER BY id`, params);
  return rows.map(mapScheduleRule);
}

async function getScheduleRule(id) {
  const [rows] = await pool.query('SELECT * FROM inspection_schedule_rules WHERE id = ?', [id]);
  return mapScheduleRule(rows[0]);
}

async function findMatchingScheduleRule(inspectionType, projectType, protectionLevel) {
  const [rows] = await pool.query(
    `SELECT * FROM inspection_schedule_rules
     WHERE inspection_type = ? AND enabled = 1
     ORDER BY (project_type = ? AND protection_level = ?) DESC,
              (project_type = ?) DESC,
              (protection_level = ?) DESC,
              (project_type IS NULL AND protection_level IS NULL) DESC
     LIMIT 1`,
    [inspectionType, projectType, protectionLevel, projectType, protectionLevel],
  );
  return mapScheduleRule(rows[0]);
}

async function createScheduleRule(r) {
  const [res] = await pool.query(
    `INSERT INTO inspection_schedule_rules (inspection_type, project_type, protection_level, cycle_days, warning_days, enabled)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [r.inspectionType, r.projectType || null, r.protectionLevel || null, r.cycleDays, r.warningDays || 7, r.enabled !== false ? 1 : 0],
  );
  return getScheduleRule(res.insertId);
}

async function updateScheduleRule(id, patch) {
  const map = {
    inspectionType: 'inspection_type',
    projectType: 'project_type',
    protectionLevel: 'protection_level',
    cycleDays: 'cycle_days',
    warningDays: 'warning_days',
    enabled: 'enabled',
  };
  const sets = [];
  const params = [];
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) {
      sets.push(`${col} = ?`);
      params.push(col === 'enabled' ? (patch[k] ? 1 : 0) : patch[k]);
    }
  }
  if (sets.length) {
    sets.push('updated_at = CURRENT_TIMESTAMP(3)');
    params.push(id);
    await pool.query(`UPDATE inspection_schedule_rules SET ${sets.join(', ')} WHERE id = ?`, params);
  }
  return getScheduleRule(id);
}

async function deleteScheduleRule(id) {
  const [r] = await pool.query('DELETE FROM inspection_schedule_rules WHERE id = ?', [id]);
  return r.affectedRows > 0;
}

/* ----------------------------- 检查任务 ----------------------------- */

async function listInspectionTasks({ projectId, status, inspectionType, dueFrom, dueTo } = {}) {
  const where = [];
  const params = [];
  if (projectId !== undefined) { where.push('project_id = ?'); params.push(projectId); }
  if (status !== undefined) { where.push('status = ?'); params.push(status); }
  if (inspectionType !== undefined) { where.push('inspection_type = ?'); params.push(inspectionType); }
  if (dueFrom !== undefined) { where.push('due_date >= ?'); params.push(dueFrom); }
  if (dueTo !== undefined) { where.push('due_date <= ?'); params.push(dueTo); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(`SELECT * FROM inspection_tasks ${clause} ORDER BY due_date, id`, params);
  return rows.map(mapInspectionTask);
}

async function listInspectionTasksWithProject({ status, dueFrom, dueTo } = {}) {
  const where = ['t.status = ?'];
  const params = [status || 'PENDING'];
  if (dueFrom !== undefined) { where.push('t.due_date >= ?'); params.push(dueFrom); }
  if (dueTo !== undefined) { where.push('t.due_date <= ?'); params.push(dueTo); }
  const clause = `WHERE ${where.join(' AND ')}`;
  const [rows] = await pool.query(
    `SELECT t.*, p.name as project_name, p.code as project_code, p.protection_level, p.type as project_type
     FROM inspection_tasks t
     JOIN projects p ON t.project_id = p.id
     ${clause}
     ORDER BY t.due_date, t.id`,
    params,
  );
  return rows.map((r) => ({
    ...mapInspectionTask(r),
    projectName: r.project_name,
    projectCode: r.project_code,
    protectionLevel: r.protection_level,
    projectType: r.project_type,
  }));
}

async function getInspectionTask(id) {
  const [rows] = await pool.query('SELECT * FROM inspection_tasks WHERE id = ?', [id]);
  return mapInspectionTask(rows[0]);
}

async function findPendingTask(projectId, inspectionType) {
  const [rows] = await pool.query(
    `SELECT * FROM inspection_tasks
     WHERE project_id = ? AND inspection_type = ? AND status = 'PENDING'
     ORDER BY due_date DESC, id DESC
     LIMIT 1`,
    [projectId, inspectionType],
  );
  return mapInspectionTask(rows[0]);
}

async function createInspectionTask(t) {
  const [res] = await pool.query(
    `INSERT INTO inspection_tasks (project_id, inspection_type, schedule_rule_id, last_inspection_id, last_inspect_date, due_date, status, assigned_to)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [t.projectId, t.inspectionType, t.scheduleRuleId || null, t.lastInspectionId || null, t.lastInspectDate || null, t.dueDate, t.status || 'PENDING', t.assignedTo || null],
  );
  return getInspectionTask(res.insertId);
}

async function updateInspectionTask(id, patch) {
  const map = {
    status: 'status',
    assignedTo: 'assigned_to',
    currentInspectionId: 'current_inspection_id',
    completedAt: 'completed_at',
  };
  const sets = [];
  const params = [];
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) { sets.push(`${col} = ?`); params.push(patch[k]); }
  }
  if (sets.length) {
    params.push(id);
    await pool.query(`UPDATE inspection_tasks SET ${sets.join(', ')} WHERE id = ?`, params);
  }
  return getInspectionTask(id);
}

/* ----------------------------- 检查预警 ----------------------------- */

async function listAlerts({ projectId, status, alertLevel, onlyUnacknowledged } = {}) {
  const where = [];
  const params = [];
  if (projectId !== undefined) { where.push('project_id = ?'); params.push(projectId); }
  if (status !== undefined) { where.push('status = ?'); params.push(status); }
  if (alertLevel !== undefined) { where.push('alert_level = ?'); params.push(alertLevel); }
  if (onlyUnacknowledged) { where.push('acknowledged_by IS NULL'); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(`SELECT * FROM inspection_alerts ${clause} ORDER BY alert_date DESC, id DESC`, params);
  return rows.map(mapInspectionAlert);
}

async function listAlertsWithProject({ status, alertLevel } = {}) {
  const where = ['a.status = ?'];
  const params = [status || 'ACTIVE'];
  if (alertLevel !== undefined) { where.push('a.alert_level = ?'); params.push(alertLevel); }
  const clause = `WHERE ${where.join(' AND ')}`;
  const [rows] = await pool.query(
    `SELECT a.*, p.name as project_name, p.code as project_code, u.name as inspector_name
     FROM inspection_alerts a
     JOIN projects p ON a.project_id = p.id
     LEFT JOIN inspection_tasks t ON a.task_id = t.id
     LEFT JOIN users u ON t.assigned_to = u.id
     ${clause}
     ORDER BY a.alert_date DESC, a.id DESC`,
    params,
  );
  return rows.map((r) => ({
    ...mapInspectionAlert(r),
    projectName: r.project_name,
    projectCode: r.project_code,
    inspectorName: r.inspector_name,
  }));
}

async function getAlert(id) {
  const [rows] = await pool.query('SELECT * FROM inspection_alerts WHERE id = ?', [id]);
  return mapInspectionAlert(rows[0]);
}

async function findActiveAlertByTaskAndLevel(taskId, alertLevel, alertDate) {
  const [rows] = await pool.query(
    'SELECT * FROM inspection_alerts WHERE task_id = ? AND alert_level = ? AND alert_date = ? AND status = \'ACTIVE\'',
    [taskId, alertLevel, alertDate],
  );
  return mapInspectionAlert(rows[0]);
}

async function findHighestActiveAlertForTask(taskId) {
  const [rows] = await pool.query(
    `SELECT * FROM inspection_alerts
     WHERE task_id = ? AND status = 'ACTIVE'
     ORDER BY FIELD(alert_level, 'CRITICAL', 'OVERDUE', 'DUE', 'UPCOMING'), alert_date DESC
     LIMIT 1`,
    [taskId],
  );
  return mapInspectionAlert(rows[0]);
}

async function createAlert(a) {
  const [res] = await pool.query(
    `INSERT INTO inspection_alerts (task_id, project_id, inspection_type, due_date, alert_level, alert_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       alert_level = VALUES(alert_level),
       updated_at = CURRENT_TIMESTAMP(3)`,
    [a.taskId, a.projectId, a.inspectionType, a.dueDate, a.alertLevel, a.alertDate, a.status || 'ACTIVE'],
  );
  if (res.insertId) {
    return getAlert(res.insertId);
  }
  return findActiveAlertByTaskAndLevel(a.taskId, a.alertLevel, a.alertDate);
}

async function acknowledgeAlert(id, userId) {
  await pool.query(
    'UPDATE inspection_alerts SET acknowledged_by = ?, acknowledged_at = CURRENT_TIMESTAMP(3), updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?',
    [userId, id],
  );
  return getAlert(id);
}

async function clearAlertsForTask(taskId, reason = 'INSPECTION_COMPLETED') {
  const [r] = await pool.query(
    'UPDATE inspection_alerts SET status = \'CLEARED\', cleared_at = CURRENT_TIMESTAMP(3), cleared_reason = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE task_id = ? AND status = \'ACTIVE\'',
    [reason, taskId],
  );
  return r.affectedRows;
}

async function escalateAlert(id, newLevel) {
  await pool.query(
    'UPDATE inspection_alerts SET alert_level = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?',
    [newLevel, id],
  );
  return getAlert(id);
}

/* ----------------------------- 看板统计 ----------------------------- */

async function getMonthlyStats(year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];
  const [rows] = await pool.query(
    `SELECT
       SUM(CASE WHEN status = 'COMPLETED' AND completed_at BETWEEN ? AND ? THEN 1 ELSE 0 END) as completed,
       SUM(CASE WHEN status = 'PENDING' AND due_date BETWEEN ? AND ? THEN 1 ELSE 0 END) as due,
       SUM(CASE WHEN status = 'PENDING' AND due_date < ? THEN 1 ELSE 0 END) as overdue
     FROM inspection_tasks`,
    [startDate, endDate, startDate, endDate, startDate],
  );
  const r = rows[0];
  return {
    completed: Number(r.completed) || 0,
    due: Number(r.due) || 0,
    overdue: Number(r.overdue) || 0,
  };
}

async function getProjectTimelinessRank({ fromDate, toDate } = {}) {
  const where = ['status = \'COMPLETED\''];
  const params = [];
  if (fromDate) { where.push('completed_at >= ?'); params.push(fromDate); }
  if (toDate) { where.push('completed_at <= ?'); params.push(toDate); }
  const clause = `WHERE ${where.join(' AND ')}`;
  const [rows] = await pool.query(
    `SELECT
       p.id as project_id,
       p.name as project_name,
       p.code as project_code,
       COUNT(*) as total_tasks,
       SUM(CASE WHEN DATE(t.completed_at) <= t.due_date THEN 1 ELSE 0 END) as on_time_count,
       ROUND(
         SUM(CASE WHEN DATE(t.completed_at) <= t.due_date THEN 1 ELSE 0 END) * 100.0 / COUNT(*),
         2
       ) as timeliness_rate
     FROM inspection_tasks t
     JOIN projects p ON t.project_id = p.id
     ${clause}
     GROUP BY p.id, p.name, p.code
     ORDER BY timeliness_rate ASC, total_tasks DESC`,
    params,
  );
  return rows.map((r) => ({
    projectId: r.project_id,
    projectName: r.project_name,
    projectCode: r.project_code,
    totalTasks: Number(r.total_tasks),
    onTimeCount: Number(r.on_time_count),
    timelinessRate: Number(r.timeliness_rate),
  }));
}

module.exports = {
  seed, isEmpty,
  findUserByUsername, getUser, listUsers, createUser,
  listProjects, getProject, findProjectByCode, createProject, updateProject, deleteProject,
  listEquipments, createEquipment,
  listInspections, createInspection, getLastInspectionByType,
  listScheduleRules, getScheduleRule, findMatchingScheduleRule, createScheduleRule, updateScheduleRule, deleteScheduleRule,
  listInspectionTasks, listInspectionTasksWithProject, getInspectionTask, findPendingTask, createInspectionTask, updateInspectionTask,
  listAlerts, listAlertsWithProject, getAlert, findActiveAlertByTaskAndLevel, findHighestActiveAlertForTask, createAlert, acknowledgeAlert, clearAlertsForTask, escalateAlert,
  getMonthlyStats, getProjectTimelinessRank,
};
