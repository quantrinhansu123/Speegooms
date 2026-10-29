-- Lead (crm.lead) + lịch sử trạng thái.
-- Tương ứng SpeeGo ERP: 20_marketing_crm, 24_crm_pain_attach, 79_lead_sheet_fields.
-- Chạy sau 003_crm_message.sql. Idempotent.
--
-- Khóa ngoại sang hr.employee / crm.customer / mkt.campaign / sales.lost_reason gắn khi bảng đích đã có.
-- mess_id trỏ crm.message.id (bảng message tạo ở 003).
-- RLS speego_* / api.leads nằm ở DB ERP; project này chỉ khoá bảng + revoke PUBLIC.

CREATE OR REPLACE FUNCTION app.normalize_email(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT nullif(lower(btrim(coalesce(p_email, ''))), '')
$$;

CREATE OR REPLACE FUNCTION app.lead_dedupe_hash(p_phone text, p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(
           md5(coalesce(app.normalize_phone(p_phone), '') || '|' || coalesce(app.normalize_email(p_email), '')),
           md5('|')
         )
$$;

DO $$ BEGIN
  CREATE TYPE crm.lead_status AS ENUM (
    'NEW', 'CONTACTED', 'QUALIFIED', 'ASSIGNED', 'ACCEPTED',
    'CONVERTED', 'LOST', 'DORMANT', 'DUPLICATE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE crm.lead_classification AS ENUM ('LCL', 'FCL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE crm.lead_brand AS ENUM (
    'SPEEGO_NAIL',
    'SPEEGO_US',
    'SPEEGO_CA',
    'SPEEGO_AU',
    'SPEEGO_BUSINESS',
    'SPEEGO_RETAIL',
    'SOURCING',
    'LOGISTICS'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE crm.potential_status AS ENUM (
    'POTENTIAL', 'CLOSING', 'DEPOSITED', 'NOT_ORDERED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE crm.customer_kind AS ENUM (
    'SOURCING', 'LOGISTICS', 'SOURCING_LOGISTICS'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE crm.customer_type AS ENUM ('INDIVIDUAL', 'PRINCIPAL', 'ENTERPRISE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE crm.lead_classification IS
  'Phân loại lead: LCL, FCL.';
COMMENT ON TYPE crm.lead_brand IS
  'Nguồn sheet: SPEEGO NAIL, SPEEGO US, SPEEGO CA, SPEEGO ÚC, SPEEGO BUSINESS, SPEEGO RETAIL, SOURCING, LOGISTICS.';
COMMENT ON TYPE crm.potential_status IS
  'Tiềm năng: POTENTIAL Tiềm năng, CLOSING Đang chốt, DEPOSITED Đã cọc, NOT_ORDERED Không đặt.';
COMMENT ON TYPE crm.customer_kind IS
  'Loại khách: SOURCING = 1 Thuần sourcing, LOGISTICS = 2 Thuần logistics, SOURCING_LOGISTICS = 3 Sourcing + Logistics.';
COMMENT ON TYPE crm.customer_type IS
  'Đối tượng: INDIVIDUAL cá nhân, PRINCIPAL chủ nhiệm, ENTERPRISE doanh nghiệp.';

CREATE TABLE IF NOT EXISTS crm.lead (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id         uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  lead_code         text NOT NULL UNIQUE DEFAULT app.next_code('LD'),
  source            crm.lead_source NOT NULL,
  campaign_id       bigint,
  customer_id       bigint,
  full_name         text,
  company_name      text,
  phone             text,
  phone_norm        text GENERATED ALWAYS AS (app.normalize_phone(phone)) STORED,
  email             text,
  email_norm        text GENERATED ALWAYS AS (app.normalize_email(email)) STORED,
  market            text,
  origin_country    char(2),
  product_interest  text,
  quantity_note     text,
  info              jsonb NOT NULL DEFAULT '{}'::jsonb,
  info_score        smallint GENERATED ALWAYS AS (app.lead_info_score(info)) STORED,
  dedupe_hash       text GENERATED ALWAYS AS (app.lead_dedupe_hash(phone, email)) STORED,
  temperature       crm.temperature NOT NULL DEFAULT 'COLD',
  status            crm.lead_status NOT NULL DEFAULT 'NEW',
  owner_employee_id bigint,
  assigned_at       timestamptz,
  accepted_at       timestamptz,
  first_contact_at  timestamptz,
  next_action_at    timestamptz,
  sla_due_at        timestamptz,
  lost_reason_id    smallint,
  lost_note         text,
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_term          text,
  utm_content       text,
  landing_page      text,
  external_id       text,
  raw               jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  pain_point_code   text,
  pain_point_note   text,
  sale              jsonb,
  customer          jsonb,
  classification    crm.lead_classification,
  brand             crm.lead_brand,
  potential         crm.potential_status,
  mess_id           bigint,
  customer_kind     crm.customer_kind,
  customer_type     crm.customer_type,
  address           text,
  care_channel      text,
  sale_note         text,
  pack_spec         text,
  weight_kg         numeric(18,3),
  logistics_class   text,
  ship_from_address text,
  ship_to_address   text,
  CONSTRAINT lead_contact_chk CHECK (coalesce(phone, email, '') <> ''),
  CONSTRAINT lead_lost_chk CHECK (status <> 'LOST' OR lost_reason_id IS NOT NULL OR lost_note IS NOT NULL)
);

ALTER TABLE crm.lead
  ADD COLUMN IF NOT EXISTS pain_point_code text,
  ADD COLUMN IF NOT EXISTS pain_point_note text,
  ADD COLUMN IF NOT EXISTS sale jsonb,
  ADD COLUMN IF NOT EXISTS customer jsonb,
  ADD COLUMN IF NOT EXISTS classification crm.lead_classification,
  ADD COLUMN IF NOT EXISTS brand crm.lead_brand,
  ADD COLUMN IF NOT EXISTS potential crm.potential_status,
  ADD COLUMN IF NOT EXISTS mess_id bigint,
  ADD COLUMN IF NOT EXISTS customer_kind crm.customer_kind,
  ADD COLUMN IF NOT EXISTS customer_type crm.customer_type,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS care_channel text,
  ADD COLUMN IF NOT EXISTS sale_note text,
  ADD COLUMN IF NOT EXISTS pack_spec text,
  ADD COLUMN IF NOT EXISTS weight_kg numeric(18,3),
  ADD COLUMN IF NOT EXISTS logistics_class text,
  ADD COLUMN IF NOT EXISTS ship_from_address text,
  ADD COLUMN IF NOT EXISTS ship_to_address text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'crm' AND table_name = 'lead' AND column_name = 'email_norm'
  ) THEN
    ALTER TABLE crm.lead
      ADD COLUMN email_norm text GENERATED ALWAYS AS (app.normalize_email(email)) STORED;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'crm' AND table_name = 'lead' AND column_name = 'dedupe_hash'
  ) THEN
    ALTER TABLE crm.lead
      ADD COLUMN dedupe_hash text GENERATED ALWAYS AS (app.lead_dedupe_hash(phone, email)) STORED;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'crm' AND table_name = 'lead' AND column_name = 'info_score'
  ) THEN
    ALTER TABLE crm.lead
      ADD COLUMN info_score smallint GENERATED ALWAYS AS (app.lead_info_score(info)) STORED;
  END IF;
END $$;

ALTER TABLE crm.lead DROP CONSTRAINT IF EXISTS lead_sale_chk;
ALTER TABLE crm.lead
  ADD CONSTRAINT lead_sale_chk CHECK (
    sale IS NULL
    OR (
      jsonb_typeof(sale) = 'object'
      AND coalesce(sale ->> 'id', '') ~ '^[0-9]+$'
      AND nullif(btrim(sale ->> 'name'), '') IS NOT NULL
    )
  );

ALTER TABLE crm.lead DROP CONSTRAINT IF EXISTS lead_customer_json_chk;
ALTER TABLE crm.lead
  ADD CONSTRAINT lead_customer_json_chk CHECK (
    customer IS NULL
    OR (
      jsonb_typeof(customer) = 'object'
      AND customer ? 'id'
      AND customer ? 'name'
      AND (
        customer ->> 'id' IS NULL
        OR (customer ->> 'id') ~ '^[0-9]+$'
      )
    )
  );

ALTER TABLE crm.lead DROP CONSTRAINT IF EXISTS lead_weight_chk;
ALTER TABLE crm.lead
  ADD CONSTRAINT lead_weight_chk CHECK (weight_kg IS NULL OR weight_kg >= 0);

DO $$
BEGIN
  IF to_regclass('crm.message') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'crm.lead'::regclass
         AND conname = 'lead_mess_id_fkey'
     ) THEN
    ALTER TABLE crm.lead
      ADD CONSTRAINT lead_mess_id_fkey
      FOREIGN KEY (mess_id) REFERENCES crm.message(id);
  END IF;
END $$;

COMMENT ON TABLE crm.lead IS
  'Lead. Đủ 6 thông tin trong info mới chuyển Hot. Cột sheet nằm cạnh source/temperature cũ.';
COMMENT ON COLUMN crm.lead.source IS
  'Nhóm nguồn ads: ADS, GG, OG, AF, REFERRAL, OUTBOUND. Khác brand.';
COMMENT ON COLUMN crm.lead.info IS
  '6 thông tin: contact_name, phone|email, product, quantity, destination, timeline.';
COMMENT ON COLUMN crm.lead.sale IS
  'Sale dạng {"id","name"}. id đồng bộ sang owner_employee_id.';
COMMENT ON COLUMN crm.lead.customer IS
  'Tên khách dạng {"id","name"}. id đồng bộ sang customer_id; name điền full_name khi full_name đang trống.';
COMMENT ON COLUMN crm.lead.classification IS
  'Phân loại LCL / FCL.';
COMMENT ON COLUMN crm.lead.brand IS
  'Nguồn sheet: SPEEGO NAIL, US, CA, ÚC, BUSINESS, RETAIL, SOURCING, LOGISTICS.';
COMMENT ON COLUMN crm.lead.potential IS
  'Tiềm năng: POTENTIAL, CLOSING, DEPOSITED, NOT_ORDERED.';
COMMENT ON COLUMN crm.lead.mess_id IS
  'Mess nguồn khi chuyển sang lead. Trỏ crm.message.id.';
COMMENT ON COLUMN crm.lead.customer_kind IS
  'Loại khách: 1 SOURCING, 2 LOGISTICS, 3 SOURCING_LOGISTICS.';
COMMENT ON COLUMN crm.lead.customer_type IS
  'Đối tượng: INDIVIDUAL / PRINCIPAL / ENTERPRISE.';
COMMENT ON COLUMN crm.lead.address IS
  'Địa chỉ khách.';
COMMENT ON COLUMN crm.lead.care_channel IS
  'Kênh chăm sóc.';
COMMENT ON COLUMN crm.lead.sale_note IS
  'Ghi chú Sale. Khác pain_point_note và lost_note.';
COMMENT ON COLUMN crm.lead.product_interest IS
  'Sản phẩm.';
COMMENT ON COLUMN crm.lead.quantity_note IS
  'Số lượng.';
COMMENT ON COLUMN crm.lead.pack_spec IS
  'Quy cách đóng gói, khách logistics.';
COMMENT ON COLUMN crm.lead.weight_kg IS
  'Trọng lượng (kg), khách logistics.';
COMMENT ON COLUMN crm.lead.logistics_class IS
  'Phân loại khách logistics. Khác classification (LCL/FCL).';
COMMENT ON COLUMN crm.lead.ship_from_address IS
  'Địa chỉ gửi hàng, khách logistics.';
COMMENT ON COLUMN crm.lead.ship_to_address IS
  'Địa chỉ nhận hàng, khách logistics.';

CREATE INDEX IF NOT EXISTS lead_status_idx
  ON crm.lead(status, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS lead_owner_idx
  ON crm.lead(owner_employee_id, status);
CREATE INDEX IF NOT EXISTS lead_campaign_idx
  ON crm.lead(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lead_dedupe_idx
  ON crm.lead(dedupe_hash)
  WHERE dedupe_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS lead_external_uq
  ON crm.lead(source, external_id)
  WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS lead_mess_idx
  ON crm.lead(mess_id)
  WHERE mess_id IS NOT NULL AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION crm.fn_lead_sheet_sync()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sale IS NOT NULL AND coalesce(NEW.sale ->> 'id', '') ~ '^[0-9]+$' THEN
    NEW.owner_employee_id := (NEW.sale ->> 'id')::bigint;
  END IF;

  IF NEW.customer IS NOT NULL AND coalesce(NEW.customer ->> 'id', '') ~ '^[0-9]+$' THEN
    NEW.customer_id := (NEW.customer ->> 'id')::bigint;
  END IF;

  IF NEW.customer IS NOT NULL
     AND nullif(btrim(NEW.customer ->> 'name'), '') IS NOT NULL
     AND coalesce(NEW.full_name, '') = '' THEN
    NEW.full_name := btrim(NEW.customer ->> 'name');
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_a_lead_sheet_sync ON crm.lead;
CREATE TRIGGER trg_a_lead_sheet_sync
  BEFORE INSERT OR UPDATE ON crm.lead
  FOR EACH ROW EXECUTE FUNCTION crm.fn_lead_sheet_sync();

DROP TRIGGER IF EXISTS trg_lead_touch ON crm.lead;
CREATE TRIGGER trg_lead_touch
  BEFORE UPDATE ON crm.lead
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE OR REPLACE FUNCTION crm.fn_lead_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_customer bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.customer_id IS NULL
       AND to_regprocedure('crm.fn_find_customer(text,text,text)') IS NOT NULL THEN
      EXECUTE 'SELECT crm.fn_find_customer($1, $2, NULL)'
        INTO v_customer
        USING NEW.phone, NEW.email;
      NEW.customer_id := v_customer;
    END IF;

    IF NEW.sla_due_at IS NULL THEN
      NEW.sla_due_at := now() + interval '30 minutes';
    END IF;

    IF NEW.status <> 'NEW' AND NEW.assigned_at IS NULL THEN
      NEW.assigned_at := now();
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'CONVERTED' AND NEW.first_contact_at IS NULL THEN
      NEW.first_contact_at := now();
    END IF;
    IF NEW.status = 'LOST' AND NEW.lost_reason_id IS NULL AND NEW.lost_note IS NULL THEN
      RAISE EXCEPTION 'Mất khách phải ghi lý do (lost_reason_id hoặc lost_note)'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.owner_employee_id IS DISTINCT FROM OLD.owner_employee_id
     AND NEW.owner_employee_id IS NOT NULL THEN
    NEW.assigned_at := coalesce(NEW.assigned_at, now());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lead_guard ON crm.lead;
CREATE TRIGGER trg_lead_guard
  BEFORE INSERT OR UPDATE ON crm.lead
  FOR EACH ROW EXECUTE FUNCTION crm.fn_lead_guard();

DROP TRIGGER IF EXISTS trg_lead_require_hot_info ON crm.lead;
CREATE TRIGGER trg_lead_require_hot_info
  BEFORE INSERT OR UPDATE OF temperature, info ON crm.lead
  FOR EACH ROW EXECUTE FUNCTION crm.fn_require_hot_info();

CREATE TABLE IF NOT EXISTS crm.lead_status_history (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id     bigint NOT NULL REFERENCES crm.lead(id) ON DELETE CASCADE,
  from_status crm.lead_status,
  to_status   crm.lead_status NOT NULL,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  changed_by  bigint,
  note        text
);

CREATE INDEX IF NOT EXISTS lead_status_history_lead_idx
  ON crm.lead_status_history(lead_id, changed_at DESC);

CREATE OR REPLACE FUNCTION crm.fn_lead_status_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO crm.lead_status_history(lead_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, app.current_employee_id());
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_lead_status_history ON crm.lead;
CREATE TRIGGER trg_lead_status_history
  AFTER UPDATE OF status ON crm.lead
  FOR EACH ROW EXECUTE FUNCTION crm.fn_lead_status_history();

DO $$
BEGIN
  IF to_regclass('mkt.campaign') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'crm.lead'::regclass AND conname = 'lead_campaign_id_fkey'
     ) THEN
    ALTER TABLE crm.lead
      ADD CONSTRAINT lead_campaign_id_fkey
      FOREIGN KEY (campaign_id) REFERENCES mkt.campaign(id);
  END IF;

  IF to_regclass('crm.customer') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'crm.lead'::regclass AND conname = 'lead_customer_id_fkey'
     ) THEN
    ALTER TABLE crm.lead
      ADD CONSTRAINT lead_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES crm.customer(id);
  END IF;

  IF to_regclass('hr.employee') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'crm.lead'::regclass AND conname = 'lead_owner_employee_id_fkey'
     ) THEN
    ALTER TABLE crm.lead
      ADD CONSTRAINT lead_owner_employee_id_fkey
      FOREIGN KEY (owner_employee_id) REFERENCES hr.employee(id);
  END IF;

  IF to_regclass('hr.employee') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'crm.lead_status_history'::regclass
         AND conname = 'lead_status_history_changed_by_fkey'
     ) THEN
    ALTER TABLE crm.lead_status_history
      ADD CONSTRAINT lead_status_history_changed_by_fkey
      FOREIGN KEY (changed_by) REFERENCES hr.employee(id);
  END IF;

  IF to_regclass('sales.lost_reason') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'crm.lead'::regclass AND conname = 'lead_lost_reason_id_fkey'
     ) THEN
    ALTER TABLE crm.lead
      ADD CONSTRAINT lead_lost_reason_id_fkey
      FOREIGN KEY (lost_reason_id) REFERENCES sales.lost_reason(id);
  END IF;
END $$;

ALTER TABLE crm.lead ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.lead_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.lead FORCE ROW LEVEL SECURITY;
ALTER TABLE crm.lead_status_history FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE crm.lead FROM PUBLIC;
REVOKE ALL ON TABLE crm.lead_status_history FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE crm.lead FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE crm.lead_status_history FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE crm.lead FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE crm.lead_status_history FROM authenticated';
  END IF;
END $$;
