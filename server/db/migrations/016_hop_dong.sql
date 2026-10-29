-- Hợp đồng theo sheet vận hành.
-- Một hợp đồng có nhiều ảnh bill.
-- Chạy sau 015. Tên bảng và cột tiếng Việt không dấu.

CREATE TABLE IF NOT EXISTS crm.hop_dong (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_hien_thi         text NOT NULL UNIQUE DEFAULT app.next_code('HD'),
  ngay_ky             date,
  ten_khach_hang      text NOT NULL,
  nhan_vien_ban       text,
  van_chuyen_den      text,
  san_pham            text,
  so_luong            numeric(18,3),
  gia_tri_san_pham    numeric(18,2) NOT NULL DEFAULT 0,
  chi_phi_van_chuyen  numeric(18,2) NOT NULL DEFAULT 0,
  tong_gia_tri        numeric(18,2) NOT NULL DEFAULT 0,
  so_tien_thanh_toan  numeric(18,2) NOT NULL DEFAULT 0,
  so_tien_con_lai     numeric(18,2) GENERATED ALWAYS AS (tong_gia_tri - so_tien_thanh_toan) STORED,
  tao_luc             timestamptz NOT NULL DEFAULT now(),
  cap_nhat_luc        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hop_dong_ten_khach_chk CHECK (btrim(ten_khach_hang) <> ''),
  CONSTRAINT hop_dong_so_luong_chk CHECK (so_luong IS NULL OR so_luong >= 0),
  CONSTRAINT hop_dong_tien_chk CHECK (
    gia_tri_san_pham >= 0
    AND chi_phi_van_chuyen >= 0
    AND tong_gia_tri >= 0
    AND so_tien_thanh_toan >= 0
    AND so_tien_thanh_toan <= tong_gia_tri
  )
);

COMMENT ON TABLE crm.hop_dong IS 'Hợp đồng.';
COMMENT ON COLUMN crm.hop_dong.ngay_ky IS 'Ngày ký hợp đồng.';
COMMENT ON COLUMN crm.hop_dong.ten_khach_hang IS 'Tên khách hàng.';
COMMENT ON COLUMN crm.hop_dong.nhan_vien_ban IS 'Sales.';
COMMENT ON COLUMN crm.hop_dong.van_chuyen_den IS 'Vận chuyển đến.';
COMMENT ON COLUMN crm.hop_dong.san_pham IS 'Sản phẩm.';
COMMENT ON COLUMN crm.hop_dong.so_luong IS 'Số lượng.';
COMMENT ON COLUMN crm.hop_dong.gia_tri_san_pham IS 'Giá trị sản phẩm (USD).';
COMMENT ON COLUMN crm.hop_dong.chi_phi_van_chuyen IS 'Chi phí vận chuyển.';
COMMENT ON COLUMN crm.hop_dong.tong_gia_tri IS 'Tổng giá trị hợp đồng.';
COMMENT ON COLUMN crm.hop_dong.so_tien_thanh_toan IS 'Số tiền đã thanh toán.';
COMMENT ON COLUMN crm.hop_dong.so_tien_con_lai IS 'Số tiền còn lại, bằng tổng giá trị trừ số tiền đã thanh toán.';

CREATE TABLE IF NOT EXISTS crm.hop_dong_anh_bill (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_hop_dong  uuid NOT NULL REFERENCES crm.hop_dong (id) ON DELETE CASCADE,
  duong_dan    text NOT NULL,
  thu_tu       smallint NOT NULL DEFAULT 1,
  tao_luc      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hop_dong_anh_bill_duong_dan_chk CHECK (btrim(duong_dan) <> ''),
  CONSTRAINT hop_dong_anh_bill_thu_tu_chk CHECK (thu_tu > 0),
  CONSTRAINT hop_dong_anh_bill_thu_tu_key UNIQUE (ma_hop_dong, thu_tu)
);

COMMENT ON TABLE crm.hop_dong_anh_bill IS 'Ảnh bill của hợp đồng. Một hợp đồng có nhiều ảnh.';
COMMENT ON COLUMN crm.hop_dong_anh_bill.duong_dan IS 'Đường dẫn hoặc URL ảnh bill.';

CREATE INDEX IF NOT EXISTS hop_dong_anh_bill_hop_dong_idx
  ON crm.hop_dong_anh_bill (ma_hop_dong, thu_tu);

DROP TRIGGER IF EXISTS trg_hop_dong_cap_nhat ON crm.hop_dong;
CREATE TRIGGER trg_hop_dong_cap_nhat
  BEFORE UPDATE ON crm.hop_dong
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

REVOKE ALL ON TABLE crm.hop_dong FROM PUBLIC;
REVOKE ALL ON TABLE crm.hop_dong_anh_bill FROM PUBLIC;
