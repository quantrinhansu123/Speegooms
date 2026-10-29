-- Bổ sung trường "Sales - hot & warm" cho mess.
-- Tên sale phụ trách nhập tay theo bảng vận hành; không ràng buộc hr.employee.

ALTER TABLE crm.tin_nhan
  ADD COLUMN IF NOT EXISTS nhan_vien_ban text;

COMMENT ON COLUMN crm.tin_nhan.nhan_vien_ban IS
  'Tên sale phụ trách mess (cột Sales - hot & warm trên bảng vận hành).';

COMMENT ON COLUMN crm.tin_nhan.thi_truong IS
  'Thị trường của khách.';
COMMENT ON COLUMN crm.tin_nhan.ma_van_de IS
  'Mã pain-point của khách.';
COMMENT ON COLUMN crm.tin_nhan.ghi_chu_van_de IS
  'Pain-Point của khách do sale ghi.';
COMMENT ON COLUMN crm.tin_nhan.ghi_chu IS
  'Ghi chú Sale.';
