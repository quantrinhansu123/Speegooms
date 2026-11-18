-- Nguồn "Tự tìm" cho khách tiềm năng do Sale tự tìm.
-- Giữ các giá trị cũ để dữ liệu hiện có tiếp tục đọc/sửa được.
ALTER TYPE crm.lead_brand ADD VALUE IF NOT EXISTS 'SELF_SOURCED';
