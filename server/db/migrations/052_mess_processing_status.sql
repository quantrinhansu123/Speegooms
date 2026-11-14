-- Trạng thái xử lý do người dùng cập nhật, độc lập với trạng thái chuyển.
ALTER TABLE crm.tin_nhan_viet_nam
  ADD COLUMN IF NOT EXISTS trang_thai_xu_ly text NOT NULL DEFAULT 'L0'
  CHECK (trang_thai_xu_ly IN ('L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8'));
ALTER TABLE crm.tin_nhan_global
  ADD COLUMN IF NOT EXISTS trang_thai_xu_ly text NOT NULL DEFAULT 'L0'
  CHECK (trang_thai_xu_ly IN ('L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8'));
