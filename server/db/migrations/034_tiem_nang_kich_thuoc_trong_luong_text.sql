-- Kích thước kiện và trọng lượng mô tả trong hồ sơ khách tiềm năng.
-- Giữ nguyên giá trị trọng lượng số đã lưu khi chuyển cột sang văn bản.
DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT conrelid::regclass AS table_name, conname
    FROM pg_constraint
    WHERE conrelid IN (
      'crm.khach_hang_tiem_nang_viet_nam'::regclass,
      'crm.khach_hang_tiem_nang_global'::regclass
    )
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%trong_luong_kg%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', item.table_name, item.conname);
  END LOOP;
END $$;

ALTER TABLE crm.khach_hang_tiem_nang_viet_nam
  ADD COLUMN kich_thuoc_kien_hang text,
  ALTER COLUMN trong_luong_kg TYPE text USING CASE WHEN trong_luong_kg IS NULL THEN NULL ELSE trong_luong_kg::text || ' kg' END;

ALTER TABLE crm.khach_hang_tiem_nang_global
  ADD COLUMN kich_thuoc_kien_hang text,
  ALTER COLUMN trong_luong_kg TYPE text USING CASE WHEN trong_luong_kg IS NULL THEN NULL ELSE trong_luong_kg::text || ' kg' END;

COMMENT ON COLUMN crm.khach_hang_tiem_nang_viet_nam.kich_thuoc_kien_hang IS 'Kích thước kiện hàng do Sale ghi nhận.';
COMMENT ON COLUMN crm.khach_hang_tiem_nang_global.kich_thuoc_kien_hang IS 'Kích thước kiện hàng do Sale ghi nhận.';
COMMENT ON COLUMN crm.khach_hang_tiem_nang_viet_nam.trong_luong_kg IS 'Trọng lượng do Sale ghi nhận; có thể là số hoặc mô tả.';
COMMENT ON COLUMN crm.khach_hang_tiem_nang_global.trong_luong_kg IS 'Trọng lượng do Sale ghi nhận; có thể là số hoặc mô tả.';
