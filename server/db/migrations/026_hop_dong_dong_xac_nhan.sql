-- Nhiều lần kế toán xác nhận số tiền (mỗi lần kèm ảnh về TK).
-- Tổng so_tien các dòng = hop_dong.so_tien_xac_nhan.
-- Chạy sau 025. Idempotent.

CREATE TABLE IF NOT EXISTS crm.hop_dong_dong_xac_nhan (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_hop_dong  uuid NOT NULL REFERENCES crm.hop_dong (id) ON DELETE CASCADE,
  so_tien      numeric(18,2) NOT NULL,
  ghi_chu      text,
  thu_tu       smallint NOT NULL DEFAULT 1,
  anh          jsonb NOT NULL DEFAULT '[]'::jsonb,
  tao_luc      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hop_dong_dong_xac_nhan_so_tien_chk CHECK (so_tien >= 0),
  CONSTRAINT hop_dong_dong_xac_nhan_thu_tu_chk CHECK (thu_tu > 0),
  CONSTRAINT hop_dong_dong_xac_nhan_thu_tu_key UNIQUE (ma_hop_dong, thu_tu)
);

COMMENT ON TABLE crm.hop_dong_dong_xac_nhan IS 'Từng lần kế toán xác nhận số tiền / ảnh về TK.';
COMMENT ON COLUMN crm.hop_dong_dong_xac_nhan.so_tien IS 'Số tiền kế toán xác nhận cho lần này.';
COMMENT ON COLUMN crm.hop_dong_dong_xac_nhan.ghi_chu IS 'Ghi chú lần xác nhận.';
COMMENT ON COLUMN crm.hop_dong_dong_xac_nhan.anh IS 'Ảnh về TK của lần xác nhận (mảng data URL / https).';

CREATE INDEX IF NOT EXISTS hop_dong_dong_xac_nhan_hop_dong_idx
  ON crm.hop_dong_dong_xac_nhan (ma_hop_dong, thu_tu);

-- Hợp đồng cũ: một dòng từ số tiền xác nhận + ảnh bill hợp đồng (nếu chưa có dòng xác nhận).
INSERT INTO crm.hop_dong_dong_xac_nhan (ma_hop_dong, so_tien, thu_tu, anh)
SELECT
  h.id,
  coalesce(h.so_tien_xac_nhan, 0),
  1,
  coalesce((
    select jsonb_agg(b.duong_dan order by b.thu_tu)
    from crm.hop_dong_anh_bill b
    where b.ma_hop_dong = h.id
  ), '[]'::jsonb)
FROM crm.hop_dong h
WHERE h.so_tien_xac_nhan is not null
  AND h.so_tien_xac_nhan > 0
  AND NOT EXISTS (
    SELECT 1 FROM crm.hop_dong_dong_xac_nhan d WHERE d.ma_hop_dong = h.id
  );

REVOKE ALL ON TABLE crm.hop_dong_dong_xac_nhan FROM PUBLIC;
