-- Cột khóa chính uuid là id. Giữ tên id, không đặt tên tiếng Việt.
-- Cột khóa ngoại (ma_tin_nhan, ma_khach_hang_tiem_nang, ma_bao_gia, ma_mau, ma_hop_dong) giữ nguyên.

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT *
    FROM (VALUES
      ('crm.tin_nhan_viet_nam', 'ma_tin_nhan'),
      ('crm.tin_nhan_global', 'ma_tin_nhan'),
      ('crm.khach_hang_tiem_nang_viet_nam', 'ma_khach_hang_tiem_nang'),
      ('crm.khach_hang_tiem_nang_global', 'ma_khach_hang_tiem_nang'),
      ('crm.bao_gia_sourcing_viet_nam', 'ma_bao_gia'),
      ('crm.bao_gia_sourcing_global', 'ma_bao_gia'),
      ('crm.bao_gia_logistics_viet_nam', 'ma_bao_gia'),
      ('crm.bao_gia_logistics_global', 'ma_bao_gia'),
      ('crm.mau_bao_gia', 'ma_mau'),
      ('crm.hop_dong', 'ma_hop_dong'),
      ('crm.hop_dong_anh_bill', 'ma_anh')
    ) AS t(tbl, col)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = split_part(rec.tbl, '.', 1)
        AND table_name = split_part(rec.tbl, '.', 2)
        AND column_name = rec.col
    ) AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = split_part(rec.tbl, '.', 1)
        AND table_name = split_part(rec.tbl, '.', 2)
        AND column_name = 'id'
    ) THEN
      EXECUTE format('ALTER TABLE %s RENAME COLUMN %I TO id', rec.tbl, rec.col);
    END IF;
  END LOOP;
END $$;
