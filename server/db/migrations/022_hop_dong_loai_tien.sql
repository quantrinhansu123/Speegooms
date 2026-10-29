-- Loại tiền của hợp đồng. Dữ liệu cũ ghi nhận theo USD (xem chú thích cột gia_tri_san_pham),
-- nên cột mới mặc định USD để không đổi ý nghĩa của hợp đồng đã có.
-- Chạy sau 021. Idempotent.

ALTER TABLE crm.hop_dong
  ADD COLUMN IF NOT EXISTS loai_tien text NOT NULL DEFAULT 'USD';

DO $$ BEGIN
  ALTER TABLE crm.hop_dong
    ADD CONSTRAINT hop_dong_loai_tien_chk
    CHECK (loai_tien IN ('VND', 'USD', 'AUD', 'EUR', 'GBP', 'CAD', 'SGD', 'CNY', 'JPY'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN crm.hop_dong.loai_tien IS
  'Loại tiền của giá trị sản phẩm, chi phí vận chuyển, tổng giá trị và số tiền đã thanh toán. VND là nội tệ.';
