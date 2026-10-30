-- Nhiều lần chuyển khoản cho một hợp đồng.
-- Tổng so_tien các dòng = hop_dong.so_tien_thanh_toan.
-- Chạy sau 023. Idempotent.

CREATE TABLE IF NOT EXISTS crm.hop_dong_dong_thanh_toan (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_hop_dong  uuid NOT NULL REFERENCES crm.hop_dong (id) ON DELETE CASCADE,
  so_tien      numeric(18,2) NOT NULL,
  ngay_chuyen  date,
  ghi_chu      text,
  thu_tu       smallint NOT NULL DEFAULT 1,
  tao_luc      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hop_dong_dong_thanh_toan_so_tien_chk CHECK (so_tien >= 0),
  CONSTRAINT hop_dong_dong_thanh_toan_thu_tu_chk CHECK (thu_tu > 0),
  CONSTRAINT hop_dong_dong_thanh_toan_thu_tu_key UNIQUE (ma_hop_dong, thu_tu)
);

COMMENT ON TABLE crm.hop_dong_dong_thanh_toan IS 'Từng lần khách chuyển khoản của hợp đồng.';
COMMENT ON COLUMN crm.hop_dong_dong_thanh_toan.so_tien IS 'Số tiền của lần chuyển khoản.';
COMMENT ON COLUMN crm.hop_dong_dong_thanh_toan.ngay_chuyen IS 'Ngày khách chuyển khoản.';
COMMENT ON COLUMN crm.hop_dong_dong_thanh_toan.ghi_chu IS 'Ghi chú lần thanh toán.';

CREATE INDEX IF NOT EXISTS hop_dong_dong_thanh_toan_hop_dong_idx
  ON crm.hop_dong_dong_thanh_toan (ma_hop_dong, thu_tu);

-- Hợp đồng cũ: một dòng từ số tiền đã thanh toán hiện có.
INSERT INTO crm.hop_dong_dong_thanh_toan (ma_hop_dong, so_tien, thu_tu)
SELECT h.id, h.so_tien_thanh_toan, 1
FROM crm.hop_dong h
WHERE h.so_tien_thanh_toan > 0
  AND NOT EXISTS (
    SELECT 1 FROM crm.hop_dong_dong_thanh_toan d WHERE d.ma_hop_dong = h.id
  );

REVOKE ALL ON TABLE crm.hop_dong_dong_thanh_toan FROM PUBLIC;
