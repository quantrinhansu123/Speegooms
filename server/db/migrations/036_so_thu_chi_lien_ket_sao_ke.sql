-- Cho phép ghi sổ trước khi đối soát, không bắt buộc gắn giao dịch với đơn hàng.
ALTER TABLE ke_toan.so_thu_chi
  ALTER COLUMN ma_don_hang DROP NOT NULL;

ALTER TABLE ke_toan.so_thu_chi
  DROP CONSTRAINT IF EXISTS so_thu_chi_don_chk,
  ADD CONSTRAINT so_thu_chi_don_chk
    CHECK (ma_don_hang IS NULL OR btrim(ma_don_hang) <> '');

-- Mọi dòng thu/chi mới mặc định chưa đối soát.
ALTER TABLE ke_toan.so_thu_chi
  DROP CONSTRAINT IF EXISTS so_thu_chi_thu_da_doi_soat_chk;
ALTER TABLE ke_toan.so_thu_chi
  ALTER COLUMN da_doi_soat SET DEFAULT false;
COMMENT ON COLUMN ke_toan.so_thu_chi.da_doi_soat IS
  'Mặc định chưa đối soát; chuyển true khi đã liên kết một dòng sao kê.';

ALTER TABLE ke_toan.so_thu_chi
  ADD COLUMN IF NOT EXISTS ma_sao_ke uuid;
DO $$ BEGIN
  ALTER TABLE ke_toan.so_thu_chi
    ADD CONSTRAINT so_thu_chi_ma_sao_ke_fkey
    FOREIGN KEY (ma_sao_ke) REFERENCES ke_toan.sao_ke(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS so_thu_chi_ma_sao_ke_key
  ON ke_toan.so_thu_chi (ma_sao_ke) WHERE ma_sao_ke IS NOT NULL;
