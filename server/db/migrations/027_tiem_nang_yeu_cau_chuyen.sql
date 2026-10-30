-- Khi Sale chuyển mess → tiềm năng: lưu yêu cầu khách, ảnh và lý do chuyển.

ALTER TABLE crm.khach_hang_tiem_nang_viet_nam
  ADD COLUMN IF NOT EXISTS yeu_cau_khach text,
  ADD COLUMN IF NOT EXISTS anh_yeu_cau jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ly_do_chuyen text;

ALTER TABLE crm.khach_hang_tiem_nang_global
  ADD COLUMN IF NOT EXISTS yeu_cau_khach text,
  ADD COLUMN IF NOT EXISTS anh_yeu_cau jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ly_do_chuyen text;

COMMENT ON COLUMN crm.khach_hang_tiem_nang_viet_nam.yeu_cau_khach IS 'Toàn bộ yêu cầu của khách khi chuyển từ mess.';
COMMENT ON COLUMN crm.khach_hang_tiem_nang_viet_nam.anh_yeu_cau IS 'Ảnh minh họa yêu cầu (URL Cloudinary hoặc data URL).';
COMMENT ON COLUMN crm.khach_hang_tiem_nang_viet_nam.ly_do_chuyen IS 'Lý do Sale chuyển mess sang khách tiềm năng.';
COMMENT ON COLUMN crm.khach_hang_tiem_nang_global.yeu_cau_khach IS 'Toàn bộ yêu cầu của khách khi chuyển từ mess.';
COMMENT ON COLUMN crm.khach_hang_tiem_nang_global.anh_yeu_cau IS 'Ảnh minh họa yêu cầu (URL Cloudinary hoặc data URL).';
COMMENT ON COLUMN crm.khach_hang_tiem_nang_global.ly_do_chuyen IS 'Lý do Sale chuyển mess sang khách tiềm năng.';
