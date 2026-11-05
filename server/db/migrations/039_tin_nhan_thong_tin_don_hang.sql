-- Sale nhập nháp thông tin sản phẩm/đơn hàng ngay trên mess, trước khi bấm Chuyển.
-- Khi chuyển, thông tin này được đưa sang báo giá nên Sale không phải nhập lại. Idempotent.

ALTER TABLE crm.tin_nhan_viet_nam
  ADD COLUMN IF NOT EXISTS thong_tin_don_hang jsonb;

ALTER TABLE crm.tin_nhan_global
  ADD COLUMN IF NOT EXISTS thong_tin_don_hang jsonb;

COMMENT ON COLUMN crm.tin_nhan_viet_nam.thong_tin_don_hang IS
  'Nháp thông tin sản phẩm/đơn hàng do Sale nhập trên mess (một mẫu đơn hàng). Không bắt buộc.';
COMMENT ON COLUMN crm.tin_nhan_global.thong_tin_don_hang IS
  'Nháp thông tin sản phẩm/đơn hàng do Sale nhập trên mess (một mẫu đơn hàng). Không bắt buộc.';
