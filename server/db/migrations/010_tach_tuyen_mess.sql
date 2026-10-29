-- Tách mess và khách hàng tiềm năng theo tuyến Việt Nam / Global.
-- Hai cặp bảng giống cấu trúc bảng gốc, chỉ khác tên.
-- Không tạo bảng lịch sử trạng thái và không gắn trigger ghi lịch sử.

DO $clone$
DECLARE
  pair record;
  rec record;
  pk_cols text;
  idx_def text;
  idx_name text;
BEGIN
  FOR pair IN
    SELECT *
    FROM (VALUES
      ('crm.tin_nhan'::text, 'crm.tin_nhan_viet_nam'::text, 'vn'),
      ('crm.tin_nhan', 'crm.tin_nhan_global', 'gl'),
      ('crm.khach_hang_tiem_nang', 'crm.khach_hang_tiem_nang_viet_nam', 'vn'),
      ('crm.khach_hang_tiem_nang', 'crm.khach_hang_tiem_nang_global', 'gl')
    ) AS t(src, dst, suffix)
  LOOP
    IF to_regclass(pair.dst) IS NOT NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'CREATE TABLE %s (LIKE %s INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY INCLUDING COMMENTS)',
      pair.dst,
      pair.src
    );

    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord)
      INTO pk_cols
    FROM pg_constraint c
    JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    WHERE c.conrelid = pair.src::regclass
      AND c.contype = 'p';

    IF pk_cols IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE %s ADD CONSTRAINT %I PRIMARY KEY (%s)',
        pair.dst,
        left(split_part(pair.dst, '.', 2) || '_pkey', 63),
        pk_cols
      );
    END IF;

    FOR rec IN
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = pair.src::regclass
        AND contype IN ('c', 'u')
    LOOP
      EXECUTE format(
        'ALTER TABLE %s ADD CONSTRAINT %I %s',
        pair.dst,
        left(rec.conname || '_' || pair.suffix, 63),
        rec.def
      );
    END LOOP;

    FOR rec IN
      SELECT c.relname AS index_name, pg_get_indexdef(i.indexrelid) AS def
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      WHERE i.indrelid = pair.src::regclass
        AND NOT i.indisprimary
        AND NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conindid = i.indexrelid AND contype IN ('p', 'u')
        )
    LOOP
      idx_name := left(rec.index_name || '_' || pair.suffix, 63);
      idx_def := replace(rec.def, ' ON ' || pair.src || ' ', ' ON ' || pair.dst || ' ');
      idx_def := regexp_replace(idx_def, 'INDEX [^ ]+ ON', 'INDEX ' || quote_ident(idx_name) || ' ON');
      EXECUTE idx_def;
    END LOOP;

    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC', pair.dst);
  END LOOP;
END
$clone$;

DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'khach_hang_tiem_nang_viet_nam_tin_fkey'
  ) THEN
    ALTER TABLE crm.khach_hang_tiem_nang_viet_nam
      ADD CONSTRAINT khach_hang_tiem_nang_viet_nam_tin_fkey
      FOREIGN KEY (ma_tin_nhan) REFERENCES crm.tin_nhan_viet_nam (ma_tin_nhan);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'khach_hang_tiem_nang_global_tin_fkey'
  ) THEN
    ALTER TABLE crm.khach_hang_tiem_nang_global
      ADD CONSTRAINT khach_hang_tiem_nang_global_tin_fkey
      FOREIGN KEY (ma_tin_nhan) REFERENCES crm.tin_nhan_global (ma_tin_nhan);
  END IF;
END
$fk$;

DROP TRIGGER IF EXISTS trg_tin_nhan_viet_nam_cap_nhat ON crm.tin_nhan_viet_nam;
CREATE TRIGGER trg_tin_nhan_viet_nam_cap_nhat
  BEFORE UPDATE ON crm.tin_nhan_viet_nam
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

DROP TRIGGER IF EXISTS trg_tin_nhan_global_cap_nhat ON crm.tin_nhan_global;
CREATE TRIGGER trg_tin_nhan_global_cap_nhat
  BEFORE UPDATE ON crm.tin_nhan_global
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

DROP TRIGGER IF EXISTS trg_tin_nhan_viet_nam_bao_ve ON crm.tin_nhan_viet_nam;
CREATE TRIGGER trg_tin_nhan_viet_nam_bao_ve
  BEFORE INSERT OR UPDATE ON crm.tin_nhan_viet_nam
  FOR EACH ROW EXECUTE FUNCTION crm.fn_message_guard();

DROP TRIGGER IF EXISTS trg_tin_nhan_global_bao_ve ON crm.tin_nhan_global;
CREATE TRIGGER trg_tin_nhan_global_bao_ve
  BEFORE INSERT OR UPDATE ON crm.tin_nhan_global
  FOR EACH ROW EXECUTE FUNCTION crm.fn_message_guard();

DROP TRIGGER IF EXISTS trg_tin_nhan_viet_nam_du_thong_tin ON crm.tin_nhan_viet_nam;
CREATE TRIGGER trg_tin_nhan_viet_nam_du_thong_tin
  BEFORE INSERT OR UPDATE OF nhiet_do, thong_tin ON crm.tin_nhan_viet_nam
  FOR EACH ROW EXECUTE FUNCTION crm.fn_require_hot_info();

DROP TRIGGER IF EXISTS trg_tin_nhan_global_du_thong_tin ON crm.tin_nhan_global;
CREATE TRIGGER trg_tin_nhan_global_du_thong_tin
  BEFORE INSERT OR UPDATE OF nhiet_do, thong_tin ON crm.tin_nhan_global
  FOR EACH ROW EXECUTE FUNCTION crm.fn_require_hot_info();

DROP TRIGGER IF EXISTS trg_tiem_nang_viet_nam_cap_nhat ON crm.khach_hang_tiem_nang_viet_nam;
CREATE TRIGGER trg_tiem_nang_viet_nam_cap_nhat
  BEFORE UPDATE ON crm.khach_hang_tiem_nang_viet_nam
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

DROP TRIGGER IF EXISTS trg_tiem_nang_global_cap_nhat ON crm.khach_hang_tiem_nang_global;
CREATE TRIGGER trg_tiem_nang_global_cap_nhat
  BEFORE UPDATE ON crm.khach_hang_tiem_nang_global
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

DROP TRIGGER IF EXISTS trg_tiem_nang_viet_nam_dong_bo ON crm.khach_hang_tiem_nang_viet_nam;
CREATE TRIGGER trg_tiem_nang_viet_nam_dong_bo
  BEFORE INSERT OR UPDATE ON crm.khach_hang_tiem_nang_viet_nam
  FOR EACH ROW EXECUTE FUNCTION crm.fn_lead_sheet_sync();

DROP TRIGGER IF EXISTS trg_tiem_nang_global_dong_bo ON crm.khach_hang_tiem_nang_global;
CREATE TRIGGER trg_tiem_nang_global_dong_bo
  BEFORE INSERT OR UPDATE ON crm.khach_hang_tiem_nang_global
  FOR EACH ROW EXECUTE FUNCTION crm.fn_lead_sheet_sync();

DROP TRIGGER IF EXISTS trg_tiem_nang_viet_nam_bao_ve ON crm.khach_hang_tiem_nang_viet_nam;
CREATE TRIGGER trg_tiem_nang_viet_nam_bao_ve
  BEFORE INSERT OR UPDATE ON crm.khach_hang_tiem_nang_viet_nam
  FOR EACH ROW EXECUTE FUNCTION crm.fn_lead_guard();

DROP TRIGGER IF EXISTS trg_tiem_nang_global_bao_ve ON crm.khach_hang_tiem_nang_global;
CREATE TRIGGER trg_tiem_nang_global_bao_ve
  BEFORE INSERT OR UPDATE ON crm.khach_hang_tiem_nang_global
  FOR EACH ROW EXECUTE FUNCTION crm.fn_lead_guard();

COMMENT ON TABLE crm.tin_nhan_viet_nam IS
  'Mess tuyến Việt Nam. Cùng cấu trúc crm.tin_nhan, không lưu lịch sử trạng thái.';
COMMENT ON TABLE crm.tin_nhan_global IS
  'Mess tuyến Global. Cùng cấu trúc crm.tin_nhan, không lưu lịch sử trạng thái.';
COMMENT ON TABLE crm.khach_hang_tiem_nang_viet_nam IS
  'Khách hàng tiềm năng tuyến Việt Nam. Cùng cấu trúc bảng gốc, không lưu lịch sử trạng thái.';
COMMENT ON TABLE crm.khach_hang_tiem_nang_global IS
  'Khách hàng tiềm năng tuyến Global. Cùng cấu trúc bảng gốc, không lưu lịch sử trạng thái.';
