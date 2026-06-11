-- 人防工程管理平台 - 表结构（MySQL）

-- 用户（登录与角色）
CREATE TABLE IF NOT EXISTS users (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    username      VARCHAR(64)  NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(64)  NOT NULL DEFAULT '',
    role          VARCHAR(16)  NOT NULL DEFAULT 'INSPECTOR',
    department    VARCHAR(128) NOT NULL DEFAULT '',
    status        VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',
    created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 人防工程档案
CREATE TABLE IF NOT EXISTS projects (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    code            VARCHAR(48)  NOT NULL,
    name            VARCHAR(128) NOT NULL,
    type            VARCHAR(32)  NOT NULL DEFAULT 'COMBINED',
    protection_level VARCHAR(16) NOT NULL DEFAULT '6',
    area_sqm        DECIMAL(12,2) NOT NULL DEFAULT 0,
    address         VARCHAR(255) NOT NULL DEFAULT '',
    district        VARCHAR(64)  NOT NULL DEFAULT '',
    peacetime_use   VARCHAR(128) NOT NULL DEFAULT '',
    status          VARCHAR(16)  NOT NULL DEFAULT 'NORMAL',
    completed_at    DATE         NULL,
    created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_projects_code (code),
    KEY idx_projects_status (status),
    KEY idx_projects_district (district)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 工程内的设备设施
CREATE TABLE IF NOT EXISTS equipments (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    project_id  BIGINT       NOT NULL,
    name        VARCHAR(128) NOT NULL,
    category    VARCHAR(32)  NOT NULL DEFAULT 'OTHER',
    model       VARCHAR(64)  NOT NULL DEFAULT '',
    install_date DATE        NULL,
    status      VARCHAR(16)  NOT NULL DEFAULT 'NORMAL',
    created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_equip_project (project_id),
    CONSTRAINT fk_equip_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 检查/维护记录
CREATE TABLE IF NOT EXISTS inspections (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    project_id   BIGINT       NOT NULL,
    inspector_id BIGINT       NULL,
    inspect_date DATE         NOT NULL,
    type         VARCHAR(16)  NOT NULL DEFAULT 'ROUTINE',
    result       VARCHAR(16)  NOT NULL DEFAULT 'PASS',
    issues       VARCHAR(1000) NOT NULL DEFAULT '',
    created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_insp_project (project_id),
    KEY idx_insp_date (inspect_date),
    CONSTRAINT fk_insp_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT fk_insp_user FOREIGN KEY (inspector_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 检查计划规则
CREATE TABLE IF NOT EXISTS inspection_schedule_rules (
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    inspection_type   VARCHAR(16)  NOT NULL,
    project_type      VARCHAR(32)  NULL,
    protection_level  VARCHAR(16)  NULL,
    cycle_days        INT          NOT NULL,
    warning_days      INT          NOT NULL DEFAULT 7,
    enabled           TINYINT(1)   NOT NULL DEFAULT 1,
    created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_rule_type_level (inspection_type, project_type, protection_level),
    KEY idx_rule_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 检查任务
CREATE TABLE IF NOT EXISTS inspection_tasks (
    id                  BIGINT       NOT NULL AUTO_INCREMENT,
    project_id          BIGINT       NOT NULL,
    inspection_type     VARCHAR(16)  NOT NULL,
    schedule_rule_id    BIGINT       NULL,
    last_inspection_id  BIGINT       NULL,
    last_inspect_date   DATE         NULL,
    due_date            DATE         NOT NULL,
    status              VARCHAR(16)  NOT NULL DEFAULT 'PENDING',
    assigned_to         BIGINT       NULL,
    current_inspection_id BIGINT     NULL,
    generated_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    completed_at        DATETIME(3)  NULL,
    PRIMARY KEY (id),
    KEY idx_task_project (project_id),
    KEY idx_task_due_date (due_date),
    KEY idx_task_status (status),
    KEY idx_task_type (inspection_type),
    CONSTRAINT fk_task_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT fk_task_rule FOREIGN KEY (schedule_rule_id) REFERENCES inspection_schedule_rules (id),
    CONSTRAINT fk_task_last_insp FOREIGN KEY (last_inspection_id) REFERENCES inspections (id),
    CONSTRAINT fk_task_current_insp FOREIGN KEY (current_inspection_id) REFERENCES inspections (id),
    CONSTRAINT fk_task_assign FOREIGN KEY (assigned_to) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 检查预警
CREATE TABLE IF NOT EXISTS inspection_alerts (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    task_id          BIGINT       NOT NULL,
    project_id       BIGINT       NOT NULL,
    inspection_type  VARCHAR(16)  NOT NULL,
    due_date         DATE         NOT NULL,
    alert_level      VARCHAR(16)  NOT NULL,
    alert_date       DATE         NOT NULL,
    status           VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',
    acknowledged_by  BIGINT       NULL,
    acknowledged_at  DATETIME(3)  NULL,
    cleared_at       DATETIME(3)  NULL,
    cleared_reason   VARCHAR(64)  NULL,
    created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_alert_task_level_date (task_id, alert_level, alert_date),
    KEY idx_alert_project (project_id),
    KEY idx_alert_status (status),
    KEY idx_alert_level (alert_level),
    KEY idx_alert_due_date (due_date),
    CONSTRAINT fk_alert_task FOREIGN KEY (task_id) REFERENCES inspection_tasks (id) ON DELETE CASCADE,
    CONSTRAINT fk_alert_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT fk_alert_ack FOREIGN KEY (acknowledged_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
