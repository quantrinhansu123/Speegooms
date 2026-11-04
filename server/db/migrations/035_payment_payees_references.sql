-- Nhân viên là đối tượng nhận và mỗi đề nghị có thể chứa nhiều mã tham chiếu theo nguồn.
ALTER TYPE ke_toan.doi_tuong_nhan ADD VALUE IF NOT EXISTS 'NHAN_VIEN';

ALTER TABLE ke_toan.de_nghi_thanh_toan
  ADD COLUMN IF NOT EXISTS ma_tham_chieu_chi_tiet jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE ke_toan.de_nghi_thanh_toan
SET ma_tham_chieu_chi_tiet = jsonb_build_array(jsonb_build_object('source', 'Khác', 'code', ma_tham_chieu))
WHERE ma_tham_chieu IS NOT NULL
  AND btrim(ma_tham_chieu) <> ''
  AND ma_tham_chieu_chi_tiet = '[]'::jsonb;

ALTER TABLE ke_toan.de_nghi_thanh_toan
  ADD CONSTRAINT de_nghi_tham_chieu_chi_tiet_array_chk
  CHECK (jsonb_typeof(ma_tham_chieu_chi_tiet) = 'array');

COMMENT ON COLUMN ke_toan.de_nghi_thanh_toan.ma_tham_chieu_chi_tiet IS
  'Danh sách mã tham chiếu theo nguồn, ví dụ [{"source":"Shopee","code":"SP-123"}].';

CREATE TABLE IF NOT EXISTS ke_toan.danh_ba_nguoi_nhan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doi_tuong_nhan ke_toan.doi_tuong_nhan NOT NULL,
  ten text NOT NULL,
  ma text NOT NULL UNIQUE DEFAULT app.next_code('NN'),
  CONSTRAINT danh_ba_nguoi_nhan_ten_chk CHECK (btrim(ten) <> '')
);
CREATE UNIQUE INDEX IF NOT EXISTS danh_ba_nguoi_nhan_ten_key
  ON ke_toan.danh_ba_nguoi_nhan (doi_tuong_nhan, lower(btrim(ten)));
REVOKE ALL ON TABLE ke_toan.danh_ba_nguoi_nhan FROM PUBLIC;
