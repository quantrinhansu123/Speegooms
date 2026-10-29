-- Match the deployed CRM schema: primary keys use id; foreign key names stay unchanged.
BEGIN;

DO $$
DECLARE
  item record;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('tin_nhan_viet_nam', 'ma_tin_nhan'),
    ('tin_nhan_global', 'ma_tin_nhan'),
    ('khach_hang_tiem_nang_viet_nam', 'ma_khach_hang_tiem_nang'),
    ('khach_hang_tiem_nang_global', 'ma_khach_hang_tiem_nang'),
    ('mau_bao_gia', 'ma_mau'),
    ('bao_gia_sourcing_viet_nam', 'ma_bao_gia'),
    ('bao_gia_sourcing_global', 'ma_bao_gia'),
    ('bao_gia_logistics_viet_nam', 'ma_bao_gia'),
    ('bao_gia_logistics_global', 'ma_bao_gia')
  ) AS columns_to_rename(table_name, column_name)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'crm' AND table_name = item.table_name AND column_name = item.column_name
    ) THEN
      EXECUTE format('ALTER TABLE crm.%I RENAME COLUMN %I TO id', item.table_name, item.column_name);
    END IF;
  END LOOP;
END $$;

COMMIT;
