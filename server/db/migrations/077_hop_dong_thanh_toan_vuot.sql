-- Cho phép thanh toán lớn hơn tổng giá trị hợp đồng (khách trả dư); so_tien_con_lai có thể âm.
ALTER TABLE crm.hop_dong DROP CONSTRAINT IF EXISTS hop_dong_tien_chk;
ALTER TABLE crm.hop_dong ADD CONSTRAINT hop_dong_tien_chk CHECK (
  gia_tri_san_pham >= 0
  AND chi_phi_van_chuyen >= 0
  AND tong_gia_tri >= 0
  AND so_tien_thanh_toan >= 0
);
