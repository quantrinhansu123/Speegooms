ALTER TABLE crm.khach_hang_tiem_nang_viet_nam
  ADD COLUMN phuong_thuc_van_chuyen text CHECK (phuong_thuc_van_chuyen IN ('AIR', 'SEA'));

ALTER TABLE crm.khach_hang_tiem_nang_global
  ADD COLUMN phuong_thuc_van_chuyen text CHECK (phuong_thuc_van_chuyen IN ('AIR', 'SEA'));
