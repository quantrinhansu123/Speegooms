-- Chi tiết báo giá: dòng hàng, ghi chú chung và tài khoản ngân hàng.
-- Ba cột jsonb trên cả bốn bảng báo giá theo tuyến và bàn.

ALTER TABLE crm.bao_gia_sourcing_viet_nam
  ADD COLUMN IF NOT EXISTS chi_tiet_don_hang jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ghi_chu jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tai_khoan_ngan_hang jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE crm.bao_gia_sourcing_global
  ADD COLUMN IF NOT EXISTS chi_tiet_don_hang jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ghi_chu jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tai_khoan_ngan_hang jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE crm.bao_gia_logistics_viet_nam
  ADD COLUMN IF NOT EXISTS chi_tiet_don_hang jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ghi_chu jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tai_khoan_ngan_hang jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE crm.bao_gia_logistics_global
  ADD COLUMN IF NOT EXISTS chi_tiet_don_hang jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ghi_chu jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tai_khoan_ngan_hang jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN crm.bao_gia_sourcing_viet_nam.chi_tiet_don_hang IS
  'Các dòng hàng: STT, hình ảnh, số lượng, giá, tổng tiền, cân nặng, thông số, note.';
COMMENT ON COLUMN crm.bao_gia_sourcing_viet_nam.ghi_chu IS
  'Ghi chú chung: nhãn tổng tiền, ghi chú cân nặng, hiệu lực báo giá, thông tin đặt cọc.';
COMMENT ON COLUMN crm.bao_gia_sourcing_viet_nam.tai_khoan_ngan_hang IS
  'Tài khoản ngân hàng ACH và thông tin đi kèm.';
