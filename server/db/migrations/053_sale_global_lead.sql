-- Thêm role trưởng Sale Global.
ALTER TABLE public.nguoi_dung DROP CONSTRAINT IF EXISTS nguoi_dung_vai_tro_check;
ALTER TABLE public.nguoi_dung ADD CONSTRAINT nguoi_dung_vai_tro_check CHECK (
  vai_tro IN ('admin', 'ban-gd', 'marketing', 'sale-vn', 'sale-global', 'sale-global-lead',
    'sale-intern', 'van-hanh', 'sourcing', 'logistics', 'ke-toan', 'hcns', 'phap-che')
);
