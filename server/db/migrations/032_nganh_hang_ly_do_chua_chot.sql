-- Phan loai nganh hang duoc chon tren Mess; ly do chua chot gan theo tung bao gia.

ALTER TABLE crm.tin_nhan_viet_nam
  ADD COLUMN IF NOT EXISTS nganh_hang text;
ALTER TABLE crm.tin_nhan_global
  ADD COLUMN IF NOT EXISTS nganh_hang text;

ALTER TABLE crm.tin_nhan_viet_nam
  DROP CONSTRAINT IF EXISTS tin_nhan_viet_nam_nganh_hang_chk,
  ADD CONSTRAINT tin_nhan_viet_nam_nganh_hang_chk CHECK (
    nganh_hang IS NULL OR nganh_hang IN (
      'NAIL_SPA_SUPPLIES', 'NAIL_SPA_EQUIPMENT', 'NAIL_SPA_FURNITURE', 'BATHROOM_MATERIALS',
      'DECOR_SIGNAGE', 'FNB_FURNITURE', 'HOME_FURNITURE', 'FNB_KITCHEN_EQUIPMENT',
      'NAIL_DISPOSABLES_PACKAGING', 'HOME_ELECTRONICS', 'FASHION_ACCESSORIES', 'OTHER'
    )
  );
ALTER TABLE crm.tin_nhan_global
  DROP CONSTRAINT IF EXISTS tin_nhan_global_nganh_hang_chk,
  ADD CONSTRAINT tin_nhan_global_nganh_hang_chk CHECK (
    nganh_hang IS NULL OR nganh_hang IN (
      'NAIL_SPA_SUPPLIES', 'NAIL_SPA_EQUIPMENT', 'NAIL_SPA_FURNITURE', 'BATHROOM_MATERIALS',
      'DECOR_SIGNAGE', 'FNB_FURNITURE', 'HOME_FURNITURE', 'FNB_KITCHEN_EQUIPMENT',
      'NAIL_DISPOSABLES_PACKAGING', 'HOME_ELECTRONICS', 'FASHION_ACCESSORIES', 'OTHER'
    )
  );

ALTER TABLE crm.bao_gia_sourcing_viet_nam
  ADD COLUMN IF NOT EXISTS ly_do_khong_chot text;
ALTER TABLE crm.bao_gia_sourcing_global
  ADD COLUMN IF NOT EXISTS ly_do_khong_chot text;
ALTER TABLE crm.bao_gia_logistics_viet_nam
  ADD COLUMN IF NOT EXISTS ly_do_khong_chot text;
ALTER TABLE crm.bao_gia_logistics_global
  ADD COLUMN IF NOT EXISTS ly_do_khong_chot text;

ALTER TABLE crm.bao_gia_sourcing_viet_nam
  DROP CONSTRAINT IF EXISTS bao_gia_sourcing_viet_nam_ly_do_chua_chot_chk,
  ADD CONSTRAINT bao_gia_sourcing_viet_nam_ly_do_chua_chot_chk CHECK (
    ly_do_khong_chot IS NULL OR char_length(ly_do_khong_chot) <= 2000
  );
ALTER TABLE crm.bao_gia_sourcing_global
  DROP CONSTRAINT IF EXISTS bao_gia_sourcing_global_ly_do_chua_chot_chk,
  ADD CONSTRAINT bao_gia_sourcing_global_ly_do_chua_chot_chk CHECK (
    ly_do_khong_chot IS NULL OR char_length(ly_do_khong_chot) <= 2000
  );
ALTER TABLE crm.bao_gia_logistics_viet_nam
  DROP CONSTRAINT IF EXISTS bao_gia_logistics_viet_nam_ly_do_chua_chot_chk,
  ADD CONSTRAINT bao_gia_logistics_viet_nam_ly_do_chua_chot_chk CHECK (
    ly_do_khong_chot IS NULL OR char_length(ly_do_khong_chot) <= 2000
  );
ALTER TABLE crm.bao_gia_logistics_global
  DROP CONSTRAINT IF EXISTS bao_gia_logistics_global_ly_do_chua_chot_chk,
  ADD CONSTRAINT bao_gia_logistics_global_ly_do_chua_chot_chk CHECK (
    ly_do_khong_chot IS NULL OR char_length(ly_do_khong_chot) <= 2000
  );

ALTER TABLE crm.hop_dong
  ADD COLUMN IF NOT EXISTS nganh_hang text;
ALTER TABLE crm.hop_dong
  DROP CONSTRAINT IF EXISTS hop_dong_nganh_hang_chk,
  ADD CONSTRAINT hop_dong_nganh_hang_chk CHECK (
    nganh_hang IS NULL OR nganh_hang IN (
      'NAIL_SPA_SUPPLIES', 'NAIL_SPA_EQUIPMENT', 'NAIL_SPA_FURNITURE', 'BATHROOM_MATERIALS',
      'DECOR_SIGNAGE', 'FNB_FURNITURE', 'HOME_FURNITURE', 'FNB_KITCHEN_EQUIPMENT',
      'NAIL_DISPOSABLES_PACKAGING', 'HOME_ELECTRONICS', 'FASHION_ACCESSORIES', 'OTHER'
    )
  );

UPDATE crm.hop_dong h
SET nganh_hang = source.nganh_hang
FROM (
  SELECT 'vn'::text AS tuyen, q.id AS ma_bao_gia, m.nganh_hang
  FROM crm.bao_gia_sourcing_viet_nam q
  JOIN crm.khach_hang_tiem_nang_viet_nam p ON p.id = q.ma_khach_hang_tiem_nang
  LEFT JOIN crm.tin_nhan_viet_nam m ON m.id = p.ma_tin_nhan
  UNION ALL
  SELECT 'vn'::text, q.id, m.nganh_hang
  FROM crm.bao_gia_logistics_viet_nam q
  JOIN crm.khach_hang_tiem_nang_viet_nam p ON p.id = q.ma_khach_hang_tiem_nang
  LEFT JOIN crm.tin_nhan_viet_nam m ON m.id = p.ma_tin_nhan
  UNION ALL
  SELECT 'global'::text, q.id, m.nganh_hang
  FROM crm.bao_gia_sourcing_global q
  JOIN crm.khach_hang_tiem_nang_global p ON p.id = q.ma_khach_hang_tiem_nang
  LEFT JOIN crm.tin_nhan_global m ON m.id = p.ma_tin_nhan
  UNION ALL
  SELECT 'global'::text, q.id, m.nganh_hang
  FROM crm.bao_gia_logistics_global q
  JOIN crm.khach_hang_tiem_nang_global p ON p.id = q.ma_khach_hang_tiem_nang
  LEFT JOIN crm.tin_nhan_global m ON m.id = p.ma_tin_nhan
) source
WHERE h.tuyen = source.tuyen
  AND h.ma_bao_gia = source.ma_bao_gia
  AND h.nganh_hang IS NULL
  AND source.nganh_hang IS NOT NULL;

COMMENT ON COLUMN crm.tin_nhan_viet_nam.nganh_hang IS 'Nganh hang Sale chon tren Mess.';
COMMENT ON COLUMN crm.tin_nhan_global.nganh_hang IS 'Nganh hang Sale chon tren Mess.';
COMMENT ON COLUMN crm.bao_gia_sourcing_viet_nam.ly_do_khong_chot IS 'Ly do bao gia chua chot.';
COMMENT ON COLUMN crm.bao_gia_sourcing_global.ly_do_khong_chot IS 'Ly do bao gia chua chot.';
COMMENT ON COLUMN crm.bao_gia_logistics_viet_nam.ly_do_khong_chot IS 'Ly do bao gia chua chot.';
COMMENT ON COLUMN crm.bao_gia_logistics_global.ly_do_khong_chot IS 'Ly do bao gia chua chot.';
COMMENT ON COLUMN crm.hop_dong.nganh_hang IS 'Nganh hang tai thoi diem tao hop dong.';
