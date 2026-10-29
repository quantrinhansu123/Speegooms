-- Hợp đồng tạo từ báo giá. Vận hành cập nhật vận đơn rồi gửi kế toán.
-- Kế toán xác nhận tiền, ảnh tài khoản và trạng thái thanh toán.

DO $$ BEGIN
  CREATE TYPE crm.trang_thai_xac_nhan_ke_toan AS ENUM (
    'DA_HOAN_THANH_COC',
    'DA_HOAN_THANH_THANH_TOAN',
    'CHUA_HOAN_THANH_COC',
    'CHUA_HOAN_THANH_THANH_TOAN'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE crm.hop_dong
  ADD COLUMN IF NOT EXISTS tuyen text NOT NULL DEFAULT 'vn',
  ADD COLUMN IF NOT EXISTS ma_bao_gia uuid,
  ADD COLUMN IF NOT EXISTS ma_bao_gia_hien_thi text,
  ADD COLUMN IF NOT EXISTS trang_thai_van_hanh text,
  ADD COLUMN IF NOT EXISTS tracking text,
  ADD COLUMN IF NOT EXISTS ghi_chu_1 text,
  ADD COLUMN IF NOT EXISTS ghi_chu_2 text,
  ADD COLUMN IF NOT EXISTS ngay_nhap_kho_tq date,
  ADD COLUMN IF NOT EXISTS ngay_xuat_container date,
  ADD COLUMN IF NOT EXISTS ngay_cap_cang date,
  ADD COLUMN IF NOT EXISTS ngay_giao_du_kien date,
  ADD COLUMN IF NOT EXISTS gui_ke_toan_luc timestamptz,
  ADD COLUMN IF NOT EXISTS so_tien_xac_nhan numeric(18,2),
  ADD COLUMN IF NOT EXISTS trang_thai_ke_toan crm.trang_thai_xac_nhan_ke_toan;

ALTER TABLE crm.hop_dong
  DROP CONSTRAINT IF EXISTS hop_dong_tuyen_chk,
  DROP CONSTRAINT IF EXISTS hop_dong_bao_gia_key;

ALTER TABLE crm.hop_dong
  ADD CONSTRAINT hop_dong_tuyen_chk CHECK (tuyen IN ('vn', 'global')),
  ADD CONSTRAINT hop_dong_bao_gia_key UNIQUE (tuyen, ma_bao_gia);

COMMENT ON COLUMN crm.hop_dong.ma_bao_gia IS 'Đơn báo giá (ma_bao_gia). Một đơn một hợp đồng.';
COMMENT ON COLUMN crm.hop_dong.gui_ke_toan_luc IS 'Thời điểm vận hành bấm Lưu và gửi sang kế toán.';
COMMENT ON COLUMN crm.hop_dong.trang_thai_ke_toan IS 'Kế toán xác nhận trạng thái cọc hoặc thanh toán.';
