-- Mỗi lần chuyển khoản chọn loại tiền riêng, cùng cách chọn tỷ giá trên đơn hàng.
-- Chạy sau 037. Idempotent.

ALTER TABLE crm.hop_dong_dong_thanh_toan
  ADD COLUMN IF NOT EXISTS loai_tien text;

UPDATE crm.hop_dong_dong_thanh_toan d
SET loai_tien = h.loai_tien
FROM crm.hop_dong h
WHERE d.ma_hop_dong = h.id
  AND (d.loai_tien IS NULL OR btrim(d.loai_tien) = '');

UPDATE crm.hop_dong_dong_thanh_toan
SET loai_tien = 'VND'
WHERE loai_tien IS NULL OR btrim(loai_tien) = '';

ALTER TABLE crm.hop_dong_dong_thanh_toan
  ALTER COLUMN loai_tien SET DEFAULT 'VND';

UPDATE crm.hop_dong_dong_thanh_toan
SET loai_tien = 'VND'
WHERE loai_tien IS NULL;

ALTER TABLE crm.hop_dong_dong_thanh_toan
  ALTER COLUMN loai_tien SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE crm.hop_dong_dong_thanh_toan
    ADD CONSTRAINT hop_dong_dong_thanh_toan_loai_tien_chk
    CHECK (loai_tien IN ('VND', 'USD', 'AUD', 'EUR', 'GBP', 'CAD', 'SGD', 'CNY', 'JPY'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN crm.hop_dong_dong_thanh_toan.loai_tien IS
  'Loại tiền của lần chuyển khoản, chọn như ô Tỷ giá. Không quy đổi sang loại tiền khác.';
