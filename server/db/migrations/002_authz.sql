-- Tài khoản, đăng nhập và phân quyền.
-- Tương ứng SpeeGo ERP 13_auth_rbac.sql (schema authz).
-- Chạy sau 001_users.sql. Idempotent.
--
-- Khóa ngoại sang hr.employee / hr.department chỉ được gắn khi các bảng đó đã có.
-- Policy theo role speego_* nằm ở 91_rls.sql của DB ERP; project này chưa có các role đó.

CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS authz;

CREATE OR REPLACE FUNCTION app.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;

DO $$ BEGIN
  CREATE TYPE authz.account_status AS ENUM ('ACTIVE', 'LOCKED', 'DISABLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE authz.perm_action AS ENUM ('VIEW', 'CREATE', 'UPDATE', 'APPROVE', 'EXPORT', 'DELETE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS authz.app_role (
  id           smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code         text NOT NULL UNIQUE,
  name         text NOT NULL,
  pg_role      text,
  description  text,
  is_system    boolean NOT NULL DEFAULT false,
  sort_order   smallint NOT NULL DEFAULT 100,
  is_active    boolean NOT NULL DEFAULT true
);

COMMENT ON TABLE authz.app_role IS
  'Vai trò hệ thống. pg_role map sang role Postgres khi cấp JWT.';

CREATE TABLE IF NOT EXISTS authz.account (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  employee_id     bigint NOT NULL,
  login_email     text NOT NULL UNIQUE,
  password_hash   text,
  status          authz.account_status NOT NULL DEFAULT 'ACTIVE',
  failed_attempts smallint NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  last_login_at   timestamptz,
  must_reset_password boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_failed_chk CHECK (failed_attempts >= 0)
);

COMMENT ON TABLE authz.account IS
  'Tài khoản đăng nhập gắn 1 nhân sự.';

DROP TRIGGER IF EXISTS trg_account_touch ON authz.account;
CREATE TRIGGER trg_account_touch
  BEFORE UPDATE ON authz.account
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TABLE IF NOT EXISTS authz.account_role (
  account_id    bigint NOT NULL REFERENCES authz.account(id) ON DELETE CASCADE,
  role_id       smallint NOT NULL REFERENCES authz.app_role(id),
  department_id smallint,
  granted_at    timestamptz NOT NULL DEFAULT now(),
  granted_by    bigint,
  PRIMARY KEY (account_id, role_id)
);

CREATE TABLE IF NOT EXISTS authz.permission (
  id            int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code          text NOT NULL UNIQUE,
  module        text NOT NULL,
  resource      text NOT NULL,
  action        authz.perm_action NOT NULL,
  column_scope  text,
  description   text,
  UNIQUE (module, resource, action, column_scope)
);

CREATE TABLE IF NOT EXISTS authz.role_permission (
  role_id       smallint NOT NULL REFERENCES authz.app_role(id) ON DELETE CASCADE,
  permission_id int NOT NULL REFERENCES authz.permission(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS authz.access_log (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  account_id    bigint REFERENCES authz.account(id),
  employee_id   bigint,
  event         text NOT NULL,
  ip_address    text,
  user_agent    text,
  detail        jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS access_log_time_brin
  ON authz.access_log USING brin (occurred_at) WITH (pages_per_range = 32);
CREATE INDEX IF NOT EXISTS access_log_account_idx
  ON authz.access_log(account_id, occurred_at DESC);

-- Khóa ngoại sang nhân sự, cùng đích với 13_auth_rbac.sql.
DO $$
BEGIN
  IF to_regclass('hr.employee') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'authz.account'::regclass
         AND contype = 'f'
         AND conname = 'account_employee_id_fkey'
     ) THEN
    ALTER TABLE authz.account
      ADD CONSTRAINT account_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES hr.employee(id);
  END IF;

  IF to_regclass('hr.department') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'authz.account_role'::regclass
         AND contype = 'f'
         AND conname = 'account_role_department_id_fkey'
     ) THEN
    ALTER TABLE authz.account_role
      ADD CONSTRAINT account_role_department_id_fkey
      FOREIGN KEY (department_id) REFERENCES hr.department(id);
  END IF;

  IF to_regclass('hr.employee') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'authz.account_role'::regclass
         AND contype = 'f'
         AND conname = 'account_role_granted_by_fkey'
     ) THEN
    ALTER TABLE authz.account_role
      ADD CONSTRAINT account_role_granted_by_fkey
      FOREIGN KEY (granted_by) REFERENCES hr.employee(id);
  END IF;

  IF to_regclass('hr.employee') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'authz.access_log'::regclass
         AND contype = 'f'
         AND conname = 'access_log_employee_id_fkey'
     ) THEN
    ALTER TABLE authz.access_log
      ADD CONSTRAINT access_log_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES hr.employee(id);
  END IF;
END $$;

INSERT INTO authz.app_role (code, name, pg_role, is_system, sort_order)
SELECT v.code, v.name, v.pg_role, true, v.sort_order
FROM (VALUES
  ('BOARD',   'Ban GĐ',              'speego_board',     10),
  ('ADMIN',   'Admin dữ liệu',       'speego_service',   20),
  ('MANAGER', 'Trưởng phòng',        'speego_manager',   30),
  ('SALES',   'Nhân viên Sale',      'speego_sales',     40),
  ('OPS',     'Nhân viên Vận hành',  'speego_ops',       50),
  ('FINANCE', 'Kế toán',             'speego_finance',   60),
  ('HR',      'HCNS',                'speego_hr',        70),
  ('LEGAL',   'Pháp chế',            'speego_legal',     80),
  ('MKT',     'Marketing',           'speego_marketing', 90),
  ('INTERN',  'Trainee/Intern',      'speego_sales',    100),
  ('COA',     'COA',                 'speego_auth',     110)
) AS v(code, name, pg_role, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM authz.app_role r WHERE r.code = v.code);

ALTER TABLE authz.app_role ENABLE ROW LEVEL SECURITY;
ALTER TABLE authz.account ENABLE ROW LEVEL SECURITY;
ALTER TABLE authz.account_role ENABLE ROW LEVEL SECURITY;
ALTER TABLE authz.permission ENABLE ROW LEVEL SECURITY;
ALTER TABLE authz.role_permission ENABLE ROW LEVEL SECURITY;
ALTER TABLE authz.access_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE authz.app_role FORCE ROW LEVEL SECURITY;
ALTER TABLE authz.account FORCE ROW LEVEL SECURITY;
ALTER TABLE authz.account_role FORCE ROW LEVEL SECURITY;
ALTER TABLE authz.permission FORCE ROW LEVEL SECURITY;
ALTER TABLE authz.role_permission FORCE ROW LEVEL SECURITY;
ALTER TABLE authz.access_log FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE authz.app_role FROM PUBLIC;
REVOKE ALL ON TABLE authz.account FROM PUBLIC;
REVOKE ALL ON TABLE authz.account_role FROM PUBLIC;
REVOKE ALL ON TABLE authz.permission FROM PUBLIC;
REVOKE ALL ON TABLE authz.role_permission FROM PUBLIC;
REVOKE ALL ON TABLE authz.access_log FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE authz.app_role FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE authz.account FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE authz.account_role FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE authz.permission FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE authz.role_permission FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE authz.access_log FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE authz.app_role FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE authz.account FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE authz.account_role FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE authz.permission FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE authz.role_permission FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE authz.access_log FROM authenticated';
  END IF;
END $$;
