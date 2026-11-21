ALTER TYPE ke_toan.khoan_muc_thu_chi ADD VALUE IF NOT EXISTS 'THU_NOI_BO';
ALTER TYPE ke_toan.khoan_muc_thu_chi ADD VALUE IF NOT EXISTS 'CHI_NOI_BO';

ALTER TABLE ke_toan.so_thu_chi
  ADD COLUMN IF NOT EXISTS phong_ban text,
  ADD COLUMN IF NOT EXISTS hang_muc_noi_bo text,
  ADD COLUMN IF NOT EXISTS noi_dung_noi_bo text,
  DROP CONSTRAINT IF EXISTS so_thu_chi_loai_khoan_chk,
  DROP CONSTRAINT IF EXISTS so_thu_chi_noi_bo_chk,
  ADD CONSTRAINT so_thu_chi_loai_khoan_chk CHECK (
    (loai = 'THU' AND khoan_muc::text IN ('COC_KHACH', 'THU_KHACH', 'THU_NOI_BO'))
    OR (loai = 'CHI' AND khoan_muc::text IN ('CHI_XUONG', 'CHI_VAN_CHUYEN', 'CHI_KHAC', 'CHI_NOI_BO'))
  ),
  ADD CONSTRAINT so_thu_chi_noi_bo_chk CHECK (
    CASE WHEN khoan_muc::text IN ('THU_NOI_BO', 'CHI_NOI_BO') THEN
      ma_don_hang IS NULL AND ma_de_nghi IS NULL
      AND phong_ban IS NOT NULL AND char_length(btrim(phong_ban)) BETWEEN 1 AND 120
      AND hang_muc_noi_bo IS NOT NULL AND char_length(btrim(hang_muc_noi_bo)) BETWEEN 1 AND 120
      AND noi_dung_noi_bo IS NOT NULL AND char_length(btrim(noi_dung_noi_bo)) BETWEEN 1 AND 500
    ELSE phong_ban IS NULL AND hang_muc_noi_bo IS NULL AND noi_dung_noi_bo IS NULL
    END
  );
