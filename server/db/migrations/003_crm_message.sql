-- Mess Ads/Page (crm.message) + lịch sử trạng thái + PII.
-- Tương ứng SpeeGo ERP: 20_marketing_crm, 24_crm_pain_attach, 35 (info), 73 (message_pii), 78 (đối tượng/hàng/phân loại/nhu cầu; không lấy mess_id).
-- Chạy sau 002_authz.sql. Idempotent.
--
-- Khóa ngoại sang hr.employee / crm.customer / mkt.campaign gắn khi bảng đích đã có.
-- RLS speego_* / api.messages nằm ở DB ERP; project này chỉ khoá bảng + revoke PUBLIC.

CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS crm;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

CREATE OR REPLACE FUNCTION app.jwt_claims()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  s text;
BEGIN
  s := current_setting('request.jwt.claims', true);
  IF s IS NULL OR btrim(s) = '' THEN
    RETURN '{}'::jsonb;
  END IF;
  RETURN s::jsonb;
EXCEPTION
  WHEN others THEN
    RETURN '{}'::jsonb;
END $$;

CREATE OR REPLACE FUNCTION app.current_employee_id()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(
           coalesce(
             app.jwt_claims() ->> 'employee_id',
             app.jwt_claims() ->> 'employeeId',
             app.jwt_claims() ->> 'sub'
           ),
           ''
         )::bigint
$$;

CREATE OR REPLACE FUNCTION app.system_mode()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(current_setting('speego.system', true), '') = 'on'
$$;

CREATE OR REPLACE FUNCTION app.actor_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
           nullif(app.jwt_claims() ->> 'role', ''),
           nullif(current_setting('role', true), 'none'),
           session_user
         )
$$;

CREATE OR REPLACE FUNCTION app.has_role(VARIADIC p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app.actor_role() = ANY (p_roles)
$$;

CREATE OR REPLACE FUNCTION app.normalize_phone(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
           WHEN d = '' THEN NULL
           WHEN left(d, 2) = '84' AND length(d) BETWEEN 10 AND 11 THEN '0' || substr(d, 3)
           ELSE d
         END
  FROM (SELECT regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') AS d) s
$$;

CREATE TABLE IF NOT EXISTS app.code_counter (
  prefix     text   NOT NULL,
  period     text   NOT NULL,
  last_value bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (prefix, period)
);

CREATE OR REPLACE FUNCTION app.next_code(
  p_prefix text,
  p_period text DEFAULT to_char(now(), 'YYYYMMDD'),
  p_pad    int  DEFAULT 4
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v bigint;
BEGIN
  INSERT INTO app.code_counter (prefix, period, last_value)
  VALUES (p_prefix, p_period, 1)
  ON CONFLICT (prefix, period)
    DO UPDATE SET last_value = app.code_counter.last_value + 1
  RETURNING last_value INTO v;

  RETURN p_prefix || '-' || p_period || '-' || lpad(v::text, p_pad, '0');
END $$;

CREATE OR REPLACE FUNCTION app.lead_info_score(p_info jsonb)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    (CASE WHEN coalesce(p_info ->> 'contact_name', '') <> '' THEN 1 ELSE 0 END) +
    (CASE WHEN coalesce(p_info ->> 'phone', '') <> ''
            OR coalesce(p_info ->> 'email', '') <> '' THEN 1 ELSE 0 END) +
    (CASE WHEN coalesce(p_info ->> 'product', '') <> '' THEN 1 ELSE 0 END) +
    (CASE WHEN coalesce(p_info ->> 'quantity', '') <> '' THEN 1 ELSE 0 END) +
    (CASE WHEN coalesce(p_info ->> 'destination', '') <> '' THEN 1 ELSE 0 END) +
    (CASE WHEN coalesce(p_info ->> 'timeline', '') <> '' THEN 1 ELSE 0 END)
  )::smallint
$$;

DO $$ BEGIN
  CREATE TYPE crm.lead_source AS ENUM ('ADS', 'GG', 'OG', 'AF', 'REFERRAL', 'OUTBOUND');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE crm.temperature AS ENUM ('HOT', 'WARM', 'COLD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE crm.message_status AS ENUM (
    'NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST', 'DORMANT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE crm.customer_type AS ENUM ('INDIVIDUAL', 'PRINCIPAL', 'ENTERPRISE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE crm.message_classification AS ENUM ('HOT', 'WARM', 'COLD', 'DEAD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE crm.message_demand AS ENUM ('SHIPPING', 'SOURCING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE crm.customer_type IS
  'Đối tượng: INDIVIDUAL cá nhân, PRINCIPAL chủ nhiệm, ENTERPRISE doanh nghiệp.';
COMMENT ON TYPE crm.message_classification IS
  'Phân loại mess: HOT, WARM, COLD, DEAD.';
COMMENT ON TYPE crm.message_demand IS
  'Nhu cầu: SHIPPING vận chuyển, SOURCING tìm hàng.';

CREATE TABLE IF NOT EXISTS crm.message (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id            uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  mess_code            text NOT NULL UNIQUE DEFAULT app.next_code('M'),
  source               crm.lead_source NOT NULL DEFAULT 'ADS',
  campaign_id          bigint,
  received_at          timestamptz NOT NULL DEFAULT now(),
  customer_id          bigint,
  customer_name_raw    text,
  phone                text,
  phone_norm           text GENERATED ALWAYS AS (app.normalize_phone(phone)) STORED,
  email                text,
  market               text,
  origin_country       char(2),
  channel_detail       text,
  assigned_employee_id bigint,
  status               crm.message_status NOT NULL DEFAULT 'NEW',
  temperature          crm.temperature NOT NULL DEFAULT 'COLD',
  first_response_at    timestamptz,
  response_minutes     int GENERATED ALWAYS AS (
    CASE WHEN first_response_at IS NOT NULL
      THEN (extract(epoch FROM (first_response_at - received_at)) / 60)::int
    END
  ) STORED,
  sla_due_at           timestamptz NOT NULL,
  sla_breached         boolean GENERATED ALWAYS AS (
    first_response_at IS NOT NULL AND first_response_at > sla_due_at
  ) STORED,
  external_ref         text,
  raw                  jsonb,
  note                 text,
  pain_point_code      text,
  pain_point_note      text,
  page_source          text,
  info                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  info_score           smallint GENERATED ALWAYS AS (app.lead_info_score(info)) STORED,
  customer_type        crm.customer_type,
  goods                text,
  classification       crm.message_classification,
  demand               crm.message_demand,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Bổ sung cột nếu bảng đã tạo trước đó (CREATE TABLE IF NOT EXISTS không ALTER).
ALTER TABLE crm.message
  ADD COLUMN IF NOT EXISTS pain_point_code text,
  ADD COLUMN IF NOT EXISTS pain_point_note text,
  ADD COLUMN IF NOT EXISTS page_source text,
  ADD COLUMN IF NOT EXISTS info jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS customer_type crm.customer_type,
  ADD COLUMN IF NOT EXISTS goods text,
  ADD COLUMN IF NOT EXISTS classification crm.message_classification,
  ADD COLUMN IF NOT EXISTS demand crm.message_demand;

-- Không dùng cột mess_id: khóa nội bộ = id, mã nghiệp vụ = mess_code, ID ngoài = external_ref.
ALTER TABLE crm.message DROP CONSTRAINT IF EXISTS message_mess_id_chk;
DROP INDEX IF EXISTS crm.message_mess_id_uq;
ALTER TABLE crm.message DROP COLUMN IF EXISTS mess_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'crm' AND table_name = 'message' AND column_name = 'info_score'
  ) THEN
    ALTER TABLE crm.message
      ADD COLUMN info_score smallint
        GENERATED ALWAYS AS (app.lead_info_score(info)) STORED;
  END IF;
END $$;

COMMENT ON TABLE crm.message IS
  'Mess từ Ads/Page. mess_code cấp theo ngày; sla_due_at mặc định +10 phút.';
COMMENT ON COLUMN crm.message.source IS
  'Nguồn do quy trình gán; trigger chặn Sale đổi nguồn/campaign.';
COMMENT ON COLUMN crm.message.info IS
  '6 thông tin: contact_name, phone|email, product, quantity, destination, timeline.';
COMMENT ON COLUMN crm.message.pain_point_code IS
  'Mã PP_* từ cfg.lookup_item (FR-S03).';
COMMENT ON COLUMN crm.message.page_source IS
  'Nhóm page / kênh (cột NGUỒN cũ).';
COMMENT ON COLUMN crm.message.customer_type IS
  'Đối tượng: INDIVIDUAL / PRINCIPAL / ENTERPRISE.';
COMMENT ON COLUMN crm.message.goods IS
  'Hàng hóa, mô tả tự do.';
COMMENT ON COLUMN crm.message.classification IS
  'Phân loại HOT / WARM / COLD / DEAD. Không thay cột temperature.';
COMMENT ON COLUMN crm.message.demand IS
  'Nhu cầu: SHIPPING / SOURCING.';

CREATE INDEX IF NOT EXISTS message_status_idx
  ON crm.message(status, received_at DESC);
CREATE INDEX IF NOT EXISTS message_assigned_idx
  ON crm.message(assigned_employee_id, status);
CREATE INDEX IF NOT EXISTS message_campaign_idx
  ON crm.message(campaign_id, received_at DESC);
CREATE INDEX IF NOT EXISTS message_received_brin
  ON crm.message USING brin (received_at) WITH (pages_per_range = 32);
CREATE UNIQUE INDEX IF NOT EXISTS message_external_uq
  ON crm.message(source, external_ref)
  WHERE external_ref IS NOT NULL;

DROP TRIGGER IF EXISTS trg_message_touch ON crm.message;
CREATE TRIGGER trg_message_touch
  BEFORE UPDATE ON crm.message
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE OR REPLACE FUNCTION crm.fn_message_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_campaign_source crm.lead_source;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.sla_due_at IS NULL THEN
      NEW.sla_due_at := NEW.received_at + interval '10 minutes';
    END IF;

    IF NEW.campaign_id IS NOT NULL AND to_regclass('mkt.campaign') IS NOT NULL THEN
      EXECUTE
        'SELECT source FROM mkt.campaign WHERE id = $1'
        INTO v_campaign_source
        USING NEW.campaign_id;
      IF v_campaign_source IS NOT NULL
         AND v_campaign_source <> NEW.source
         AND NOT app.system_mode() THEN
        RAISE EXCEPTION 'Nguồn mess (%) không khớp nguồn campaign (%)',
          NEW.source, v_campaign_source
          USING ERRCODE = '23514';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF (NEW.source IS DISTINCT FROM OLD.source OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id)
     AND NOT app.system_mode()
     AND NOT app.has_role('speego_manager', 'speego_service') THEN
    RAISE EXCEPTION 'Nguồn/campaign của mess do quy trình gán, không được sửa'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.first_response_at IS NULL
     AND NEW.first_response_at IS NULL
     AND NEW.status <> 'NEW' THEN
    NEW.first_response_at := now();
  END IF;

  IF NEW.status = 'CONVERTED' AND NEW.first_response_at IS NULL THEN
    NEW.first_response_at := now();
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_message_guard ON crm.message;
CREATE TRIGGER trg_message_guard
  BEFORE INSERT OR UPDATE ON crm.message
  FOR EACH ROW EXECUTE FUNCTION crm.fn_message_guard();

CREATE OR REPLACE FUNCTION crm.fn_require_hot_info()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.temperature = 'HOT' AND NOT app.system_mode() THEN
    IF app.lead_info_score(coalesce(NEW.info, '{}'::jsonb)) < 6 THEN
      RAISE EXCEPTION 'Chỉ chuyển Hot khi đủ 6 thông tin (hiện %/6)',
        app.lead_info_score(coalesce(NEW.info, '{}'::jsonb))
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_message_require_hot_info ON crm.message;
CREATE TRIGGER trg_message_require_hot_info
  BEFORE INSERT OR UPDATE OF temperature, info ON crm.message
  FOR EACH ROW EXECUTE FUNCTION crm.fn_require_hot_info();

CREATE TABLE IF NOT EXISTS crm.message_status_history (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id  bigint NOT NULL REFERENCES crm.message(id) ON DELETE CASCADE,
  from_status crm.message_status,
  to_status   crm.message_status NOT NULL,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  changed_by  bigint,
  note        text
);

CREATE INDEX IF NOT EXISTS message_status_history_msg_idx
  ON crm.message_status_history(message_id, changed_at DESC);

CREATE OR REPLACE FUNCTION crm.fn_message_status_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO crm.message_status_history(message_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, app.current_employee_id());
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_message_status_history ON crm.message;
CREATE TRIGGER trg_message_status_history
  AFTER UPDATE OF status ON crm.message
  FOR EACH ROW EXECUTE FUNCTION crm.fn_message_status_history();

CREATE TABLE IF NOT EXISTS crm.message_pii (
  message_id         bigint PRIMARY KEY REFERENCES crm.message(id) ON DELETE CASCADE,
  customer_name_raw  text,
  phone              text,
  phone_norm         text GENERATED ALWAYS AS (app.normalize_phone(phone)) STORED,
  email              text,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE crm.message_pii IS 'PII mess thô – quyền riêng.';

CREATE OR REPLACE FUNCTION crm.fn_sync_message_pii()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = crm, app, public
AS $$
BEGIN
  INSERT INTO crm.message_pii(message_id, customer_name_raw, phone, email, updated_at)
  VALUES (NEW.id, NEW.customer_name_raw, NEW.phone, NEW.email, now())
  ON CONFLICT (message_id) DO UPDATE SET
    customer_name_raw = EXCLUDED.customer_name_raw,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    updated_at = now();
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_sync_message_pii ON crm.message;
CREATE TRIGGER trg_sync_message_pii
  AFTER INSERT OR UPDATE OF customer_name_raw, phone, email ON crm.message
  FOR EACH ROW EXECUTE FUNCTION crm.fn_sync_message_pii();

INSERT INTO crm.message_pii(message_id, customer_name_raw, phone, email)
SELECT id, customer_name_raw, phone, email FROM crm.message
ON CONFLICT (message_id) DO NOTHING;

-- Khóa ngoại sang bảng đích khi đã có (cùng kiểu deferred như 002_authz).
DO $$
BEGIN
  IF to_regclass('mkt.campaign') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'crm.message'::regclass
         AND contype = 'f'
         AND conname = 'message_campaign_id_fkey'
     ) THEN
    ALTER TABLE crm.message
      ADD CONSTRAINT message_campaign_id_fkey
      FOREIGN KEY (campaign_id) REFERENCES mkt.campaign(id);
  END IF;

  IF to_regclass('crm.customer') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'crm.message'::regclass
         AND contype = 'f'
         AND conname = 'message_customer_id_fkey'
     ) THEN
    ALTER TABLE crm.message
      ADD CONSTRAINT message_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES crm.customer(id);
  END IF;

  IF to_regclass('hr.employee') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'crm.message'::regclass
         AND contype = 'f'
         AND conname = 'message_assigned_employee_id_fkey'
     ) THEN
    ALTER TABLE crm.message
      ADD CONSTRAINT message_assigned_employee_id_fkey
      FOREIGN KEY (assigned_employee_id) REFERENCES hr.employee(id);
  END IF;

  IF to_regclass('hr.employee') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'crm.message_status_history'::regclass
         AND contype = 'f'
         AND conname = 'message_status_history_changed_by_fkey'
     ) THEN
    ALTER TABLE crm.message_status_history
      ADD CONSTRAINT message_status_history_changed_by_fkey
      FOREIGN KEY (changed_by) REFERENCES hr.employee(id);
  END IF;
END $$;

ALTER TABLE crm.message ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.message_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.message_pii ENABLE ROW LEVEL SECURITY;

ALTER TABLE crm.message FORCE ROW LEVEL SECURITY;
ALTER TABLE crm.message_status_history FORCE ROW LEVEL SECURITY;
ALTER TABLE crm.message_pii FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE crm.message FROM PUBLIC;
REVOKE ALL ON TABLE crm.message_status_history FROM PUBLIC;
REVOKE ALL ON TABLE crm.message_pii FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE crm.message FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE crm.message_status_history FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE crm.message_pii FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE crm.message FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE crm.message_status_history FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE crm.message_pii FROM authenticated';
  END IF;
END $$;
