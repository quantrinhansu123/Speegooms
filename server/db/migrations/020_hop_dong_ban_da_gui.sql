-- Bản đã gửi cho từng bên. Lưu chỉ sửa bản nháp.
-- Trạng thái vận hành nằm trên cột trang_thai_van_hanh và các bên đọc trực tiếp.
-- Gửi lại chép bản nháp sang bản bên nhận, kèm trạng thái tại thời điểm gửi.

ALTER TABLE crm.hop_dong
  ADD COLUMN IF NOT EXISTS ban_gui_van_hanh jsonb,
  ADD COLUMN IF NOT EXISTS ban_gui_ke_toan jsonb,
  ADD COLUMN IF NOT EXISTS ban_gui_xac_nhan jsonb;

COMMENT ON COLUMN crm.hop_dong.ban_gui_van_hanh IS 'Thông tin thương mại Sale đã gửi cho Vận hành, kèm trạng thái tại thời điểm gửi.';
COMMENT ON COLUMN crm.hop_dong.ban_gui_ke_toan IS 'Thông tin Vận hành đã gửi cho Kế toán, kèm trạng thái tại thời điểm gửi.';
COMMENT ON COLUMN crm.hop_dong.ban_gui_xac_nhan IS 'Xác nhận Kế toán đã gửi cho Sale và Vận hành, kèm trạng thái và phần vận hành Kế toán đang giữ.';

UPDATE crm.hop_dong
SET ban_gui_van_hanh = jsonb_build_object(
  'customerName', ten_khach_hang,
  'saleName', nhan_vien_ban,
  'shipTo', van_chuyen_den,
  'product', san_pham,
  'quantity', so_luong,
  'productValue', gia_tri_san_pham,
  'shippingCost', chi_phi_van_chuyen,
  'totalValue', tong_gia_tri,
  'paidAmount', so_tien_thanh_toan,
  'balance', so_tien_con_lai,
  'signedOn', to_char(ngay_ky, 'YYYY-MM-DD'),
  'opsStatus', coalesce(trang_thai_van_hanh, '')
)
WHERE ban_gui_van_hanh IS NULL;

UPDATE crm.hop_dong
SET ban_gui_ke_toan = coalesce(ban_gui_van_hanh, '{}'::jsonb) || jsonb_build_object(
  'tracking', coalesce(tracking, ''),
  'note1', coalesce(ghi_chu_1, ''),
  'note2', coalesce(ghi_chu_2, ''),
  'chinaWarehouseOn', to_char(ngay_nhap_kho_tq, 'YYYY-MM-DD'),
  'containerOn', to_char(ngay_xuat_container, 'YYYY-MM-DD'),
  'arrivalOn', to_char(ngay_cap_cang, 'YYYY-MM-DD'),
  'deliveryOn', to_char(ngay_giao_du_kien, 'YYYY-MM-DD'),
  'opsStatus', coalesce(trang_thai_van_hanh, '')
)
WHERE gui_ke_toan_luc IS NOT NULL AND ban_gui_ke_toan IS NULL;

UPDATE crm.hop_dong h
SET ban_gui_xac_nhan = jsonb_build_object(
  'confirmedAmount', h.so_tien_xac_nhan,
  'accountingStatus', h.trang_thai_ke_toan,
  'images', coalesce((
    select jsonb_agg(b.duong_dan order by b.thu_tu)
    from crm.hop_dong_anh_bill b
    where b.ma_hop_dong = h.id
  ), '[]'::jsonb),
  'opsStatus', coalesce(h.trang_thai_van_hanh, ''),
  'tracking', coalesce(h.ban_gui_ke_toan->>'tracking', ''),
  'note1', coalesce(h.ban_gui_ke_toan->>'note1', ''),
  'note2', coalesce(h.ban_gui_ke_toan->>'note2', ''),
  'chinaWarehouseOn', h.ban_gui_ke_toan->>'chinaWarehouseOn',
  'containerOn', h.ban_gui_ke_toan->>'containerOn',
  'arrivalOn', h.ban_gui_ke_toan->>'arrivalOn',
  'deliveryOn', h.ban_gui_ke_toan->>'deliveryOn'
)
WHERE h.gui_xac_nhan_luc IS NOT NULL AND h.ban_gui_xac_nhan IS NULL;
