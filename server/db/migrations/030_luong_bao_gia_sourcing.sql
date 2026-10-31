BEGIN;
-- Run together with the application update; prevent requests racing the baseline.
LOCK TABLE crm.khach_hang_tiem_nang_viet_nam, crm.khach_hang_tiem_nang_global,
  crm.bao_gia_sourcing_viet_nam, crm.bao_gia_sourcing_global,
  crm.bao_gia_logistics_viet_nam, crm.bao_gia_logistics_global IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM crm.khach_hang_tiem_nang_viet_nam WHERE nhom_khach::text = 'SOURCING_LOGISTICS')
    OR EXISTS (SELECT 1 FROM crm.khach_hang_tiem_nang_global WHERE nhom_khach::text = 'SOURCING_LOGISTICS') THEN
    RAISE EXCEPTION 'Unexpected SOURCING_LOGISTICS customers; review data before migration';
  END IF;
END $$;

ALTER TABLE crm.khach_hang_tiem_nang_viet_nam
  ADD COLUMN luong_bao_gia text NOT NULL DEFAULT 'COMBINED'
  CHECK (luong_bao_gia IN ('LEGACY', 'COMBINED'));
UPDATE crm.khach_hang_tiem_nang_viet_nam p SET luong_bao_gia = 'LEGACY'
WHERE EXISTS (SELECT 1 FROM crm.bao_gia_sourcing_viet_nam q WHERE q.ma_khach_hang_tiem_nang = p.id)
   OR EXISTS (SELECT 1 FROM crm.bao_gia_logistics_viet_nam q WHERE q.ma_khach_hang_tiem_nang = p.id);
ALTER TABLE crm.khach_hang_tiem_nang_viet_nam
  ADD CONSTRAINT kh_viet_nam_loai_khach_hien_hanh CHECK (nhom_khach::text IN ('SOURCING', 'LOGISTICS'));

ALTER TABLE crm.khach_hang_tiem_nang_global
  ADD COLUMN luong_bao_gia text NOT NULL DEFAULT 'COMBINED'
  CHECK (luong_bao_gia IN ('LEGACY', 'COMBINED'));
UPDATE crm.khach_hang_tiem_nang_global p SET luong_bao_gia = 'LEGACY'
WHERE EXISTS (SELECT 1 FROM crm.bao_gia_sourcing_global q WHERE q.ma_khach_hang_tiem_nang = p.id)
   OR EXISTS (SELECT 1 FROM crm.bao_gia_logistics_global q WHERE q.ma_khach_hang_tiem_nang = p.id);
ALTER TABLE crm.khach_hang_tiem_nang_global
  ADD CONSTRAINT kh_global_loai_khach_hien_hanh CHECK (nhom_khach::text IN ('SOURCING', 'LOGISTICS'));

COMMIT;
