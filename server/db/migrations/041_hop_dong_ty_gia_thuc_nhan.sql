ALTER TABLE crm.hop_dong_dong_thanh_toan
  ADD COLUMN IF NOT EXISTS ty_gia numeric(18,6);

ALTER TABLE crm.hop_dong_dong_xac_nhan
  ADD COLUMN IF NOT EXISTS loai_tien text,
  ADD COLUMN IF NOT EXISTS ty_gia numeric(18,6);

UPDATE crm.hop_dong_dong_xac_nhan x
SET loai_tien = h.loai_tien
FROM crm.hop_dong h
WHERE x.ma_hop_dong = h.id AND x.loai_tien IS NULL;

ALTER TABLE crm.hop_dong_dong_xac_nhan
  ALTER COLUMN loai_tien SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE crm.hop_dong_dong_thanh_toan
    ADD CONSTRAINT hop_dong_dong_thanh_toan_ty_gia_chk CHECK (ty_gia IS NULL OR ty_gia > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE crm.hop_dong_dong_xac_nhan
    ADD CONSTRAINT hop_dong_dong_xac_nhan_ty_gia_chk CHECK (ty_gia IS NULL OR ty_gia > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
