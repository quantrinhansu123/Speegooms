CREATE TABLE ke_toan.tai_khoan_nhan (
  ten text PRIMARY KEY CHECK (ten = btrim(ten) AND length(ten) BETWEEN 1 AND 200)
);

ALTER TABLE ke_toan.so_thu_chi
  ADD COLUMN tai_khoan_nhan text REFERENCES ke_toan.tai_khoan_nhan(ten),
  ADD COLUMN ngay_giao_dich date;

COMMENT ON COLUMN ke_toan.so_thu_chi.ngay_giao_dich IS
  'Ngày giao dịch thực tế, độc lập với ngày ghi sổ; dữ liệu cũ chưa xác định để trống.';
