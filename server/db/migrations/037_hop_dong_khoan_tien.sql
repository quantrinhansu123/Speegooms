-- Giá trị sản phẩm và chi phí vận chuyển giữ loại tiền lúc nhập, không quy đổi chung.
-- Chạy sau 036. Idempotent.

ALTER TABLE crm.hop_dong
  ADD COLUMN IF NOT EXISTS loai_tien_van_chuyen text;

ALTER TABLE crm.hop_dong
  ADD COLUMN IF NOT EXISTS khoan_tien jsonb;

DO $$ BEGIN
  ALTER TABLE crm.hop_dong
    ADD CONSTRAINT hop_dong_loai_tien_van_chuyen_chk
    CHECK (
      loai_tien_van_chuyen IS NULL
      OR loai_tien_van_chuyen IN ('VND', 'USD', 'AUD', 'EUR', 'GBP', 'CAD', 'SGD', 'CNY', 'JPY')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN crm.hop_dong.loai_tien_van_chuyen IS
  'Loại tiền của chi phí vận chuyển, theo cách logistics đã nhập. Không quy đổi sang loại tiền sản phẩm.';
COMMENT ON COLUMN crm.hop_dong.khoan_tien IS
  'Giá trị sản phẩm và chi phí vận chuyển theo từng loại tiền đã nhập.';

UPDATE crm.hop_dong
SET loai_tien_van_chuyen = loai_tien
WHERE loai_tien_van_chuyen IS NULL;

UPDATE crm.hop_dong
SET khoan_tien = jsonb_build_object(
  'product', jsonb_build_array(jsonb_build_object('currency', loai_tien, 'amount', gia_tri_san_pham)),
  'shipping', jsonb_build_array(jsonb_build_object('currency', loai_tien_van_chuyen, 'amount', chi_phi_van_chuyen))
)
WHERE khoan_tien IS NULL;

-- Hợp đồng này đã bị cộng cước USD vào tổng VND. Trả về số đã nhập:
-- hàng 45.181.160 đ và 1.753,31 USD; cước 893,15 USD.
UPDATE crm.hop_dong
SET chi_phi_van_chuyen = 893.15,
    loai_tien_van_chuyen = 'USD',
    tong_gia_tri = gia_tri_san_pham,
    khoan_tien = jsonb_build_object(
      'product', jsonb_build_array(
        jsonb_build_object('currency', 'VND', 'amount', gia_tri_san_pham),
        jsonb_build_object('currency', 'USD', 'amount', 1753.31)
      ),
      'shipping', jsonb_build_array(jsonb_build_object('currency', 'USD', 'amount', 893.15))
    ),
    ban_gui_van_hanh = CASE WHEN ban_gui_van_hanh IS NULL THEN NULL ELSE
      jsonb_set(jsonb_set(jsonb_set(
        ban_gui_van_hanh, '{shippingCost}', to_jsonb(893.15::numeric), true
      ), '{totalValue}', to_jsonb(gia_tri_san_pham), true
      ), '{balance}', to_jsonb(gia_tri_san_pham - so_tien_thanh_toan), true)
    END,
    ban_gui_ke_toan = CASE WHEN ban_gui_ke_toan IS NULL THEN NULL ELSE
      jsonb_set(jsonb_set(jsonb_set(
        ban_gui_ke_toan, '{shippingCost}', to_jsonb(893.15::numeric), true
      ), '{totalValue}', to_jsonb(gia_tri_san_pham), true
      ), '{balance}', to_jsonb(gia_tri_san_pham - so_tien_thanh_toan), true)
    END
WHERE ma_hien_thi = 'HD-20261105-0001'
  AND ma_bao_gia_hien_thi = 'BGS-20261103-0006';
