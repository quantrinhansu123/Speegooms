-- Địa chỉ khách nhập ngay khi tạo mess; khách tiềm năng lấy theo mess.
ALTER TABLE crm.tin_nhan_viet_nam ADD COLUMN IF NOT EXISTS dia_chi text;
ALTER TABLE crm.tin_nhan_global ADD COLUMN IF NOT EXISTS dia_chi text;
