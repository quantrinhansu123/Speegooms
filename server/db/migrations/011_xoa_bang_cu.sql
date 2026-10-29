-- Bỏ bảng mess / khách hàng tiềm năng dùng chung và các bảng lịch sử đi kèm.
-- Ứng dụng chỉ đọc crm.tin_nhan_viet_nam, crm.tin_nhan_global,
-- crm.khach_hang_tiem_nang_viet_nam, crm.khach_hang_tiem_nang_global.

DROP TABLE IF EXISTS crm.lich_su_trang_thai_tin_nhan;
DROP TABLE IF EXISTS crm.thong_tin_ca_nhan_tin_nhan;
DROP TABLE IF EXISTS crm.lich_su_trang_thai_tiem_nang;
DROP TABLE IF EXISTS crm.khach_hang_tiem_nang;
DROP TABLE IF EXISTS crm.tin_nhan;

DROP FUNCTION IF EXISTS crm.fn_message_status_history();
DROP FUNCTION IF EXISTS crm.fn_sync_message_pii();
DROP FUNCTION IF EXISTS crm.fn_lead_status_history();

COMMENT ON TABLE crm.tin_nhan_viet_nam IS
  'Mess tuyến Việt Nam. Không lưu lịch sử trạng thái.';
COMMENT ON TABLE crm.tin_nhan_global IS
  'Mess tuyến Global. Không lưu lịch sử trạng thái.';
COMMENT ON TABLE crm.khach_hang_tiem_nang_viet_nam IS
  'Khách hàng tiềm năng tuyến Việt Nam. Không lưu lịch sử trạng thái.';
COMMENT ON TABLE crm.khach_hang_tiem_nang_global IS
  'Khách hàng tiềm năng tuyến Global. Không lưu lịch sử trạng thái.';
