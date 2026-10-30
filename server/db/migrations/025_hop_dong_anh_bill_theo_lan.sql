-- Ảnh bill theo từng lần thanh toán.
-- Chạy sau 024. Idempotent.

ALTER TABLE crm.hop_dong_dong_thanh_toan
  ADD COLUMN IF NOT EXISTS anh_bill jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN crm.hop_dong_dong_thanh_toan.anh_bill IS 'Ảnh bill của lần chuyển khoản (mảng data URL / https).';

-- Hợp đồng có ảnh bill cũ nhưng chưa có dòng thanh toán: tạo lần 1.
INSERT INTO crm.hop_dong_dong_thanh_toan (ma_hop_dong, so_tien, thu_tu)
SELECT h.id, GREATEST(h.so_tien_thanh_toan, 0), 1
FROM crm.hop_dong h
WHERE EXISTS (SELECT 1 FROM crm.hop_dong_anh_bill b WHERE b.ma_hop_dong = h.id)
  AND NOT EXISTS (SELECT 1 FROM crm.hop_dong_dong_thanh_toan d WHERE d.ma_hop_dong = h.id);

-- Gán ảnh bill cũ vào lần thanh toán 1 (chỉ khi lần 1 chưa có ảnh).
UPDATE crm.hop_dong_dong_thanh_toan d
SET anh_bill = bills.anh
FROM (
  SELECT ma_hop_dong, jsonb_agg(duong_dan ORDER BY thu_tu) AS anh
  FROM crm.hop_dong_anh_bill
  GROUP BY ma_hop_dong
) bills
WHERE d.ma_hop_dong = bills.ma_hop_dong
  AND d.thu_tu = 1
  AND d.anh_bill = '[]'::jsonb;
