-- Đổi khóa crm.message và crm.lead từ bigint identity sang uuid.
-- Bảng đã tạo bởi 003/004 không đổi khi CREATE TABLE IF NOT EXISTS chạy lại.
-- Dòng hiện có nhận đúng giá trị public_id. Chạy lại thì bỏ qua nếu id đã là uuid.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $migrate$
DECLARE
  message_bigint boolean;
  lead_bigint boolean;
  rec record;
BEGIN
  SELECT c.data_type = 'bigint' INTO message_bigint
  FROM information_schema.columns c
  WHERE c.table_schema = 'crm' AND c.table_name = 'message' AND c.column_name = 'id';

  SELECT c.data_type = 'bigint' INTO lead_bigint
  FROM information_schema.columns c
  WHERE c.table_schema = 'crm' AND c.table_name = 'lead' AND c.column_name = 'id';

  IF NOT coalesce(message_bigint, false) AND NOT coalesce(lead_bigint, false) THEN
    RETURN;
  END IF;

  IF coalesce(message_bigint, false) IS DISTINCT FROM coalesce(lead_bigint, false) THEN
    RAISE EXCEPTION 'crm.message.id và crm.lead.id phải cùng kiểu trước khi đổi sang uuid';
  END IF;

  EXECUTE 'ALTER TABLE crm.message NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE crm.message DISABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE crm.message_status_history NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE crm.message_status_history DISABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE crm.message_pii NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE crm.message_pii DISABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE crm.lead NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE crm.lead DISABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE crm.lead_status_history NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE crm.lead_status_history DISABLE ROW LEVEL SECURITY';

  IF EXISTS (SELECT 1 FROM crm.message WHERE public_id IS NULL)
     OR EXISTS (SELECT 1 FROM crm.lead WHERE public_id IS NULL) THEN
    RAISE EXCEPTION 'public_id đang trống, không gán được uuid';
  END IF;

  IF EXISTS (
    SELECT 1 FROM crm.message_status_history h
    LEFT JOIN crm.message m ON m.id = h.message_id
    WHERE m.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM crm.message_pii p
    LEFT JOIN crm.message m ON m.id = p.message_id
    WHERE m.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM crm.lead l
    LEFT JOIN crm.message m ON m.id = l.mess_id
    WHERE l.mess_id IS NOT NULL AND m.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM crm.lead_status_history h
    LEFT JOIN crm.lead l ON l.id = h.lead_id
    WHERE l.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Có khóa ngoại mồ côi, dừng đổi id sang uuid';
  END IF;

  EXECUTE 'ALTER TABLE crm.message ADD COLUMN id_uuid uuid';
  EXECUTE 'UPDATE crm.message SET id_uuid = public_id';
  EXECUTE 'ALTER TABLE crm.message ALTER COLUMN id_uuid SET NOT NULL';

  EXECUTE 'ALTER TABLE crm.lead ADD COLUMN id_uuid uuid';
  EXECUTE 'UPDATE crm.lead SET id_uuid = public_id';
  EXECUTE 'ALTER TABLE crm.lead ALTER COLUMN id_uuid SET NOT NULL';

  EXECUTE 'ALTER TABLE crm.message_status_history ADD COLUMN message_id_uuid uuid';
  EXECUTE $sql$
    UPDATE crm.message_status_history h
    SET message_id_uuid = m.id_uuid
    FROM crm.message m
    WHERE m.id = h.message_id
  $sql$;
  EXECUTE 'ALTER TABLE crm.message_status_history ALTER COLUMN message_id_uuid SET NOT NULL';

  EXECUTE 'ALTER TABLE crm.message_pii ADD COLUMN message_id_uuid uuid';
  EXECUTE $sql$
    UPDATE crm.message_pii p
    SET message_id_uuid = m.id_uuid
    FROM crm.message m
    WHERE m.id = p.message_id
  $sql$;
  EXECUTE 'ALTER TABLE crm.message_pii ALTER COLUMN message_id_uuid SET NOT NULL';

  EXECUTE 'ALTER TABLE crm.lead ADD COLUMN mess_id_uuid uuid';
  EXECUTE $sql$
    UPDATE crm.lead l
    SET mess_id_uuid = m.id_uuid
    FROM crm.message m
    WHERE m.id = l.mess_id
  $sql$;

  EXECUTE 'ALTER TABLE crm.lead_status_history ADD COLUMN lead_id_uuid uuid';
  EXECUTE $sql$
    UPDATE crm.lead_status_history h
    SET lead_id_uuid = l.id_uuid
    FROM crm.lead l
    WHERE l.id = h.lead_id
  $sql$;
  EXECUTE 'ALTER TABLE crm.lead_status_history ALTER COLUMN lead_id_uuid SET NOT NULL';

  FOR rec IN
    SELECT conrelid::regclass AS tbl, conname
    FROM pg_constraint
    WHERE contype = 'f'
      AND confrelid IN ('crm.message'::regclass, 'crm.lead'::regclass)
      AND conrelid IN (
        'crm.message_status_history'::regclass,
        'crm.message_pii'::regclass,
        'crm.lead'::regclass,
        'crm.lead_status_history'::regclass
      )
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', rec.tbl, rec.conname);
  END LOOP;

  EXECUTE 'ALTER TABLE crm.message DROP CONSTRAINT message_pkey';
  EXECUTE 'ALTER TABLE crm.message DROP COLUMN id';
  EXECUTE 'ALTER TABLE crm.message RENAME COLUMN id_uuid TO id';
  EXECUTE 'ALTER TABLE crm.message ALTER COLUMN id SET DEFAULT gen_random_uuid()';
  EXECUTE 'ALTER TABLE crm.message ADD PRIMARY KEY (id)';

  EXECUTE 'ALTER TABLE crm.lead DROP CONSTRAINT lead_pkey';
  EXECUTE 'ALTER TABLE crm.lead DROP COLUMN id';
  EXECUTE 'ALTER TABLE crm.lead RENAME COLUMN id_uuid TO id';
  EXECUTE 'ALTER TABLE crm.lead ALTER COLUMN id SET DEFAULT gen_random_uuid()';
  EXECUTE 'ALTER TABLE crm.lead ADD PRIMARY KEY (id)';

  EXECUTE 'ALTER TABLE crm.message_status_history DROP COLUMN message_id';
  EXECUTE 'ALTER TABLE crm.message_status_history RENAME COLUMN message_id_uuid TO message_id';
  EXECUTE 'ALTER TABLE crm.message_status_history ADD CONSTRAINT message_status_history_message_id_fkey FOREIGN KEY (message_id) REFERENCES crm.message(id) ON DELETE CASCADE';

  EXECUTE 'ALTER TABLE crm.message_pii DROP CONSTRAINT IF EXISTS message_pii_pkey';
  EXECUTE 'ALTER TABLE crm.message_pii DROP COLUMN message_id';
  EXECUTE 'ALTER TABLE crm.message_pii RENAME COLUMN message_id_uuid TO message_id';
  EXECUTE 'ALTER TABLE crm.message_pii ADD PRIMARY KEY (message_id)';
  EXECUTE 'ALTER TABLE crm.message_pii ADD CONSTRAINT message_pii_message_id_fkey FOREIGN KEY (message_id) REFERENCES crm.message(id) ON DELETE CASCADE';

  EXECUTE 'ALTER TABLE crm.lead DROP COLUMN mess_id';
  EXECUTE 'ALTER TABLE crm.lead RENAME COLUMN mess_id_uuid TO mess_id';
  EXECUTE 'ALTER TABLE crm.lead ADD CONSTRAINT lead_mess_id_fkey FOREIGN KEY (mess_id) REFERENCES crm.message(id)';

  EXECUTE 'ALTER TABLE crm.lead_status_history DROP COLUMN lead_id';
  EXECUTE 'ALTER TABLE crm.lead_status_history RENAME COLUMN lead_id_uuid TO lead_id';
  EXECUTE 'ALTER TABLE crm.lead_status_history ADD CONSTRAINT lead_status_history_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES crm.lead(id) ON DELETE CASCADE';

  EXECUTE 'DROP INDEX IF EXISTS crm.message_status_history_msg_idx';
  EXECUTE 'DROP INDEX IF EXISTS crm.lead_status_history_lead_idx';
  EXECUTE 'DROP INDEX IF EXISTS crm.lead_mess_idx';
  EXECUTE 'DROP INDEX IF EXISTS crm.lead_mess_id_uq';
  EXECUTE 'CREATE INDEX message_status_history_msg_idx ON crm.message_status_history(message_id, changed_at DESC)';
  EXECUTE 'CREATE INDEX lead_status_history_lead_idx ON crm.lead_status_history(lead_id, changed_at DESC)';
  EXECUTE 'CREATE INDEX lead_mess_idx ON crm.lead(mess_id) WHERE mess_id IS NOT NULL AND deleted_at IS NULL';
  EXECUTE 'CREATE UNIQUE INDEX lead_mess_id_uq ON crm.lead (mess_id) WHERE mess_id IS NOT NULL AND deleted_at IS NULL';

  EXECUTE 'ALTER TABLE crm.message ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE crm.message FORCE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE crm.message_status_history ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE crm.message_status_history FORCE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE crm.message_pii ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE crm.message_pii FORCE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE crm.lead ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE crm.lead FORCE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE crm.lead_status_history ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE crm.lead_status_history FORCE ROW LEVEL SECURITY';
END
$migrate$;
