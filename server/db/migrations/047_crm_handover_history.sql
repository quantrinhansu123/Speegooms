-- Keep CRM ownership and activity alongside the original lead, shared by its quotes.
ALTER TABLE crm.khach_hang_tiem_nang_viet_nam
  ADD COLUMN IF NOT EXISTS nguoi_xu_ly_id text REFERENCES public.nguoi_dung(ma_nguoi_dung) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nguoi_tao_id text REFERENCES public.nguoi_dung(ma_nguoi_dung) ON DELETE SET NULL;
ALTER TABLE crm.khach_hang_tiem_nang_global
  ADD COLUMN IF NOT EXISTS nguoi_xu_ly_id text REFERENCES public.nguoi_dung(ma_nguoi_dung) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nguoi_tao_id text REFERENCES public.nguoi_dung(ma_nguoi_dung) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS crm.lich_su_xu_ly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tuyen text NOT NULL CHECK (tuyen IN ('vn', 'global')),
  khach_id uuid NOT NULL,
  ban_ghi_id uuid NOT NULL,
  loai text NOT NULL CHECK (loai IN ('message', 'potential', 'quote')),
  hanh_dong text NOT NULL CHECK (hanh_dong IN ('create', 'update', 'handover', 'delete')),
  nguoi_thao_tac_id text REFERENCES public.nguoi_dung(ma_nguoi_dung) ON DELETE SET NULL,
  ten_nguoi_thao_tac text NOT NULL,
  nguoi_cu_id text,
  ten_nguoi_cu text,
  nguoi_moi_id text,
  ten_nguoi_moi text,
  tao_luc timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lich_su_xu_ly_khach_idx ON crm.lich_su_xu_ly(tuyen, khach_id, tao_luc DESC);

CREATE OR REPLACE FUNCTION crm.track_handler_activity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  actor_id text := nullif(current_setting('app.crm_actor_id', true), '');
  actor_role text;
  before_row jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  after_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  lead_id uuid;
  previous_lead_id uuid;
  previous_handler text;
  next_handler text;
  handler_role text;
  derived_columns text[];
  lead record;
BEGIN
  SELECT vai_tro INTO actor_role FROM public.nguoi_dung WHERE ma_nguoi_dung = actor_id;
  IF TG_ARGV[1] = 'message' THEN
    FOR lead IN EXECUTE format('SELECT id, nguoi_xu_ly_id FROM %s WHERE ma_tin_nhan = $1 AND xoa_luc IS NULL FOR UPDATE', TG_ARGV[2]) USING (after_row->>'id')::uuid LOOP
      IF actor_role IS NOT NULL AND actor_role <> 'admin' AND lead.nguoi_xu_ly_id IS NOT NULL AND lead.nguoi_xu_ly_id <> actor_id THEN
        -- The conversion transaction marks the source Mess only after assigning the lead.
        -- Generated columns are not populated in NEW until after BEFORE triggers run.
        SELECT coalesce(array_agg(attname::text), ARRAY[]::text[]) || ARRAY['trang_thai', 'cap_nhat_luc', 'phan_hoi_dau_luc']
          INTO derived_columns FROM pg_attribute WHERE attrelid = TG_RELID AND attgenerated <> '';
        IF TG_OP = 'UPDATE' AND OLD.trang_thai::text <> 'CONVERTED' AND NEW.trang_thai::text = 'CONVERTED'
          AND (to_jsonb(NEW) - derived_columns) = (to_jsonb(OLD) - derived_columns) THEN RETURN NEW; END IF;
        RAISE EXCEPTION 'Mess đã bàn giao cho người khác; bạn chỉ có quyền xem.' USING ERRCODE = '42501';
      END IF;
    END LOOP;
  ELSIF TG_ARGV[1] = 'potential' THEN
    lead_id := (after_row->>'id')::uuid;
    previous_handler := before_row->>'nguoi_xu_ly_id';
    IF TG_OP = 'INSERT' THEN
      NEW.nguoi_tao_id := coalesce(NEW.nguoi_tao_id, actor_id);
      NEW.nguoi_xu_ly_id := coalesce(NEW.nguoi_xu_ly_id, actor_id);
    END IF;
    next_handler := CASE WHEN TG_OP = 'DELETE' THEN previous_handler ELSE NEW.nguoi_xu_ly_id END;
    IF actor_role IN ('sale-vn', 'sale-global') AND previous_handler IS NOT NULL AND previous_handler <> actor_id THEN
      RAISE EXCEPTION 'Khách đã bàn giao cho người khác; bạn chỉ có quyền xem.' USING ERRCODE = '42501';
    END IF;
    IF next_handler IS DISTINCT FROM previous_handler AND next_handler IS NOT NULL THEN
      SELECT vai_tro INTO handler_role FROM public.nguoi_dung WHERE ma_nguoi_dung = next_handler;
      IF handler_role IS NULL OR NOT (handler_role = CASE WHEN TG_ARGV[0] = 'vn' THEN 'sale-vn' ELSE 'sale-global' END OR (handler_role = 'admin' AND next_handler = actor_id)) THEN
        RAISE EXCEPTION 'Chọn Sale xử lý đúng tuyến khách hàng.' USING ERRCODE = '23514';
      END IF;
    END IF;
  ELSE
    lead_id := (after_row->>'ma_khach_hang_tiem_nang')::uuid;
    previous_lead_id := (before_row->>'ma_khach_hang_tiem_nang')::uuid;
    -- Lock both leads when moving a quote, so reassignment cannot bypass ownership.
    FOR lead IN EXECUTE format('SELECT id, nguoi_xu_ly_id FROM %s WHERE id = $1 OR id = $2 ORDER BY id FOR UPDATE', TG_ARGV[2]) USING lead_id, previous_lead_id LOOP
      IF actor_role IN ('sale-vn', 'sale-global') AND lead.nguoi_xu_ly_id IS NOT NULL AND lead.nguoi_xu_ly_id <> actor_id THEN
        RAISE EXCEPTION 'Báo giá thuộc khách đã bàn giao; bạn chỉ có quyền xem.' USING ERRCODE = '42501';
      END IF;
      IF lead.id = lead_id THEN next_handler := lead.nguoi_xu_ly_id; END IF;
    END LOOP;
    previous_handler := next_handler;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

-- AFTER records only successful writes, including INSERT ... ON CONFLICT DO NOTHING.
CREATE OR REPLACE FUNCTION crm.log_handler_activity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  actor_id text := nullif(current_setting('app.crm_actor_id', true), '');
  actor_name text;
  before_row jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  after_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  lead_id uuid;
  previous_handler text;
  next_handler text;
  action text;
BEGIN
  SELECT ho_ten INTO actor_name FROM public.nguoi_dung WHERE ma_nguoi_dung = actor_id;
  IF TG_ARGV[1] = 'message' THEN
    EXECUTE format('SELECT id, nguoi_xu_ly_id FROM %s WHERE ma_tin_nhan = $1 AND xoa_luc IS NULL', TG_ARGV[2]) INTO lead_id, next_handler USING (after_row->>'id')::uuid;
    IF lead_id IS NULL THEN RETURN NEW; END IF;
    previous_handler := next_handler;
  ELSIF TG_ARGV[1] = 'potential' THEN
    lead_id := (after_row->>'id')::uuid;
    previous_handler := before_row->>'nguoi_xu_ly_id';
    next_handler := after_row->>'nguoi_xu_ly_id';
  ELSE
    lead_id := (after_row->>'ma_khach_hang_tiem_nang')::uuid;
    EXECUTE format('SELECT nguoi_xu_ly_id FROM %s WHERE id = $1', TG_ARGV[2]) INTO next_handler USING lead_id;
    previous_handler := next_handler;
  END IF;
  action := CASE WHEN TG_OP = 'DELETE' THEN 'delete' WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END;
  IF TG_ARGV[1] = 'potential' AND next_handler IS DISTINCT FROM previous_handler AND (TG_OP <> 'INSERT' OR next_handler IS DISTINCT FROM actor_id) THEN action := 'handover'; END IF;
  INSERT INTO crm.lich_su_xu_ly(tuyen, khach_id, ban_ghi_id, loai, hanh_dong, nguoi_thao_tac_id, ten_nguoi_thao_tac, nguoi_cu_id, ten_nguoi_cu, nguoi_moi_id, ten_nguoi_moi)
    VALUES (TG_ARGV[0], lead_id, (after_row->>'id')::uuid, TG_ARGV[1], action, actor_id, coalesce(actor_name, 'Hệ thống / chưa xác định'), previous_handler,
      (SELECT ho_ten FROM public.nguoi_dung WHERE ma_nguoi_dung = previous_handler), next_handler,
      (SELECT ho_ten FROM public.nguoi_dung WHERE ma_nguoi_dung = next_handler));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE lane text; suffix text; entity text; table_name text; lead_table text;
BEGIN
  FOREACH lane IN ARRAY ARRAY['vn', 'global'] LOOP
    suffix := CASE WHEN lane = 'vn' THEN 'viet_nam' ELSE 'global' END;
    lead_table := 'crm.khach_hang_tiem_nang_' || suffix;
    FOREACH entity IN ARRAY ARRAY['tin_nhan', 'khach_hang_tiem_nang', 'bao_gia_sourcing', 'bao_gia_logistics'] LOOP
      table_name := 'crm.' || entity || '_' || suffix;
      EXECUTE format('DROP TRIGGER IF EXISTS crm_handler_activity ON %s', table_name);
      EXECUTE format('DROP TRIGGER IF EXISTS crm_handler_history ON %s', table_name);
      EXECUTE format('CREATE TRIGGER crm_handler_activity BEFORE INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION crm.track_handler_activity(%L, %L, %L)', table_name, lane, CASE WHEN entity = 'tin_nhan' THEN 'message' WHEN entity = 'khach_hang_tiem_nang' THEN 'potential' ELSE 'quote' END, lead_table);
      EXECUTE format('CREATE TRIGGER crm_handler_history AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION crm.log_handler_activity(%L, %L, %L)', table_name, lane, CASE WHEN entity = 'tin_nhan' THEN 'message' WHEN entity = 'khach_hang_tiem_nang' THEN 'potential' ELSE 'quote' END, lead_table);
    END LOOP;
  END LOOP;
END $$;
