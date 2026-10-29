-- Thêm cột link_mess cho mess tuyến Việt Nam / Global.

ALTER TABLE crm.tin_nhan_viet_nam
  ADD COLUMN IF NOT EXISTS link_mess text;

ALTER TABLE crm.tin_nhan_global
  ADD COLUMN IF NOT EXISTS link_mess text;

COMMENT ON COLUMN crm.tin_nhan_viet_nam.link_mess IS
  'Link mess (URL hoặc đường dẫn tham chiếu hội thoại).';
COMMENT ON COLUMN crm.tin_nhan_global.link_mess IS
  'Link mess (URL hoặc đường dẫn tham chiếu hội thoại).';
