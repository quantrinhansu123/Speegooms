-- Mess có trường Nguồn (cùng danh sách với Nguồn của khách tiềm năng). Khách tiềm năng chuyển từ mess dùng luôn nguồn này.
-- Idempotent.

ALTER TABLE crm.tin_nhan_viet_nam
  ADD COLUMN IF NOT EXISTS thuong_hieu crm.lead_brand;

ALTER TABLE crm.tin_nhan_global
  ADD COLUMN IF NOT EXISTS thuong_hieu crm.lead_brand;

COMMENT ON COLUMN crm.tin_nhan_viet_nam.thuong_hieu IS 'Nguồn của mess; khách tiềm năng chuyển từ mess lấy nguồn này.';
COMMENT ON COLUMN crm.tin_nhan_global.thuong_hieu IS 'Nguồn của mess; khách tiềm năng chuyển từ mess lấy nguồn này.';

-- Khách tiềm năng đã có nguồn thì ghi ngược về mess gốc để hai bên khớp nhau.
UPDATE crm.tin_nhan_viet_nam m
SET thuong_hieu = l.thuong_hieu
FROM crm.khach_hang_tiem_nang_viet_nam l
WHERE l.ma_tin_nhan = m.id AND m.thuong_hieu IS NULL AND l.thuong_hieu IS NOT NULL;

UPDATE crm.tin_nhan_global m
SET thuong_hieu = l.thuong_hieu
FROM crm.khach_hang_tiem_nang_global l
WHERE l.ma_tin_nhan = m.id AND m.thuong_hieu IS NULL AND l.thuong_hieu IS NOT NULL;
