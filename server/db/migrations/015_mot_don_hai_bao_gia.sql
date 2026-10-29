-- Khách Sourcing + Logistics là một đơn hàng, gồm hai báo giá trên cùng một bản ghi Sourcing.
-- Báo giá Logistics nằm trong bao_gia_logistics. Bản ghi Logistics tách riêng được gộp rồi xóa.

ALTER TABLE crm.bao_gia_sourcing_viet_nam
  ADD COLUMN IF NOT EXISTS bao_gia_logistics jsonb;

ALTER TABLE crm.bao_gia_sourcing_global
  ADD COLUMN IF NOT EXISTS bao_gia_logistics jsonb;

COMMENT ON COLUMN crm.bao_gia_sourcing_viet_nam.bao_gia_logistics IS
  'Báo giá Logistics của cùng đơn hàng khi khách là Sourcing + Logistics.';
COMMENT ON COLUMN crm.bao_gia_sourcing_global.bao_gia_logistics IS
  'Báo giá Logistics của cùng đơn hàng khi khách là Sourcing + Logistics.';

UPDATE crm.bao_gia_sourcing_viet_nam q
SET bao_gia_logistics = jsonb_build_object(
  'templateId', lq.ma_mau,
  'opsNote', coalesce(lq.ghi_chu_vh, ''),
  'quoteStatus', lq.trang_thai_bao_gia::text,
  'contractStatus', lq.trang_thai_hop_dong::text,
  'orders', coalesce(lq.chi_tiet_don_hang, '[]'::jsonb),
  'notes', coalesce(lq.ghi_chu, '{}'::jsonb),
  'bank', coalesce(lq.tai_khoan_ngan_hang, '{}'::jsonb),
  'sentQuote', lq.ban_da_gui
)
FROM crm.bao_gia_logistics_viet_nam lq
JOIN crm.khach_hang_tiem_nang_viet_nam p ON p.ma_khach_hang_tiem_nang = lq.ma_khach_hang_tiem_nang
WHERE q.ma_khach_hang_tiem_nang = lq.ma_khach_hang_tiem_nang
  AND p.nhom_khach::text = 'SOURCING_LOGISTICS';

UPDATE crm.bao_gia_sourcing_global q
SET bao_gia_logistics = jsonb_build_object(
  'templateId', lq.ma_mau,
  'opsNote', coalesce(lq.ghi_chu_vh, ''),
  'quoteStatus', lq.trang_thai_bao_gia::text,
  'contractStatus', lq.trang_thai_hop_dong::text,
  'orders', coalesce(lq.chi_tiet_don_hang, '[]'::jsonb),
  'notes', coalesce(lq.ghi_chu, '{}'::jsonb),
  'bank', coalesce(lq.tai_khoan_ngan_hang, '{}'::jsonb),
  'sentQuote', lq.ban_da_gui
)
FROM crm.bao_gia_logistics_global lq
JOIN crm.khach_hang_tiem_nang_global p ON p.ma_khach_hang_tiem_nang = lq.ma_khach_hang_tiem_nang
WHERE q.ma_khach_hang_tiem_nang = lq.ma_khach_hang_tiem_nang
  AND p.nhom_khach::text = 'SOURCING_LOGISTICS';

DELETE FROM crm.bao_gia_logistics_viet_nam lq
USING crm.khach_hang_tiem_nang_viet_nam p
WHERE p.ma_khach_hang_tiem_nang = lq.ma_khach_hang_tiem_nang
  AND p.nhom_khach::text = 'SOURCING_LOGISTICS';

DELETE FROM crm.bao_gia_logistics_global lq
USING crm.khach_hang_tiem_nang_global p
WHERE p.ma_khach_hang_tiem_nang = lq.ma_khach_hang_tiem_nang
  AND p.nhom_khach::text = 'SOURCING_LOGISTICS';

UPDATE crm.bao_gia_sourcing_viet_nam q
SET bao_gia_logistics = jsonb_build_object(
  'templateId', null,
  'opsNote', '',
  'quoteStatus', 'CHUA_CO_BAO_GIA',
  'contractStatus', 'CHUA_TAO',
  'orders', '[]'::jsonb,
  'notes', jsonb_build_object('totalLabel', '', 'weightNote', '', 'validityNote', '', 'deposit', ''),
  'bank', jsonb_build_object('title', '', 'accountName', '', 'accountNumber', '', 'routingNumber', ''),
  'sentQuote', null
)
FROM crm.khach_hang_tiem_nang_viet_nam p
WHERE p.ma_khach_hang_tiem_nang = q.ma_khach_hang_tiem_nang
  AND p.nhom_khach::text = 'SOURCING_LOGISTICS'
  AND q.bao_gia_logistics IS NULL;

UPDATE crm.bao_gia_sourcing_global q
SET bao_gia_logistics = jsonb_build_object(
  'templateId', null,
  'opsNote', '',
  'quoteStatus', 'CHUA_CO_BAO_GIA',
  'contractStatus', 'CHUA_TAO',
  'orders', '[]'::jsonb,
  'notes', jsonb_build_object('totalLabel', '', 'weightNote', '', 'validityNote', '', 'deposit', ''),
  'bank', jsonb_build_object('title', '', 'accountName', '', 'accountNumber', '', 'routingNumber', ''),
  'sentQuote', null
)
FROM crm.khach_hang_tiem_nang_global p
WHERE p.ma_khach_hang_tiem_nang = q.ma_khach_hang_tiem_nang
  AND p.nhom_khach::text = 'SOURCING_LOGISTICS'
  AND q.bao_gia_logistics IS NULL;
