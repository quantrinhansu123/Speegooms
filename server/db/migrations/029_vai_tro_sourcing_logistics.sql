-- Thêm vai trò bàn báo giá Sourcing / Logistics (giữ van-hanh full).

ALTER TABLE public.nguoi_dung DROP CONSTRAINT IF EXISTS nguoi_dung_vai_tro_check;

ALTER TABLE public.nguoi_dung
  ADD CONSTRAINT nguoi_dung_vai_tro_check CHECK (
    vai_tro IN (
      'admin',
      'ban-gd',
      'marketing',
      'sale-vn',
      'sale-global',
      'van-hanh',
      'sourcing',
      'logistics',
      'ke-toan',
      'hcns',
      'phap-che'
    )
  );
