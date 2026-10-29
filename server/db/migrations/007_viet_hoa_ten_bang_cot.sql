-- Việt hoá tên bảng và cột: tiếng Việt không dấu, snake_case.
-- Chạy sau 005. Giữ nguyên tên schema, tên enum, giá trị enum và tên function nội bộ.
-- Dữ liệu được giữ nguyên (chỉ RENAME, không DROP/CREATE lại bảng).

ALTER TABLE public.users RENAME TO nguoi_dung;
ALTER TABLE public.nguoi_dung RENAME COLUMN id TO ma_nguoi_dung;
ALTER TABLE public.nguoi_dung RENAME COLUMN email TO thu_dien_tu;
ALTER TABLE public.nguoi_dung RENAME COLUMN name TO ho_ten;
ALTER TABLE public.nguoi_dung RENAME COLUMN role TO vai_tro;
ALTER TABLE public.nguoi_dung RENAME COLUMN department TO phong_ban;
ALTER TABLE public.nguoi_dung RENAME COLUMN title TO chuc_danh;
ALTER TABLE public.nguoi_dung RENAME COLUMN password_hash TO mat_khau_bam;
ALTER TABLE public.nguoi_dung RENAME COLUMN created_at TO tao_luc;

ALTER TABLE public.sessions RENAME TO phien_dang_nhap;
ALTER TABLE public.phien_dang_nhap RENAME COLUMN id_hash TO bam_ma_phien;
ALTER TABLE public.phien_dang_nhap RENAME COLUMN user_id TO ma_nguoi_dung;
ALTER TABLE public.phien_dang_nhap RENAME COLUMN expires_at TO het_han_luc;
ALTER TABLE public.phien_dang_nhap RENAME COLUMN created_at TO tao_luc;

ALTER TABLE authz.app_role RENAME TO vai_tro;
ALTER TABLE authz.vai_tro RENAME COLUMN id TO ma_vai_tro;
ALTER TABLE authz.vai_tro RENAME COLUMN code TO ky_hieu;
ALTER TABLE authz.vai_tro RENAME COLUMN name TO ten;
ALTER TABLE authz.vai_tro RENAME COLUMN pg_role TO vai_tro_pg;
ALTER TABLE authz.vai_tro RENAME COLUMN description TO mo_ta;
ALTER TABLE authz.vai_tro RENAME COLUMN is_system TO la_he_thong;
ALTER TABLE authz.vai_tro RENAME COLUMN sort_order TO thu_tu;
ALTER TABLE authz.vai_tro RENAME COLUMN is_active TO dang_hoat_dong;

ALTER TABLE authz.account RENAME TO tai_khoan;
ALTER TABLE authz.tai_khoan RENAME COLUMN id TO ma_tai_khoan;
ALTER TABLE authz.tai_khoan RENAME COLUMN public_id TO ma_cong_khai;
ALTER TABLE authz.tai_khoan RENAME COLUMN employee_id TO ma_nhan_vien;
ALTER TABLE authz.tai_khoan RENAME COLUMN login_email TO thu_dien_tu_dang_nhap;
ALTER TABLE authz.tai_khoan RENAME COLUMN password_hash TO mat_khau_bam;
ALTER TABLE authz.tai_khoan RENAME COLUMN status TO trang_thai;
ALTER TABLE authz.tai_khoan RENAME COLUMN failed_attempts TO so_lan_dang_nhap_loi;
ALTER TABLE authz.tai_khoan RENAME COLUMN locked_until TO khoa_den_luc;
ALTER TABLE authz.tai_khoan RENAME COLUMN last_login_at TO dang_nhap_cuoi_luc;
ALTER TABLE authz.tai_khoan RENAME COLUMN must_reset_password TO phai_doi_mat_khau;
ALTER TABLE authz.tai_khoan RENAME COLUMN created_at TO tao_luc;
ALTER TABLE authz.tai_khoan RENAME COLUMN updated_at TO cap_nhat_luc;

ALTER TABLE authz.account_role RENAME TO tai_khoan_vai_tro;
ALTER TABLE authz.tai_khoan_vai_tro RENAME COLUMN account_id TO ma_tai_khoan;
ALTER TABLE authz.tai_khoan_vai_tro RENAME COLUMN role_id TO ma_vai_tro;
ALTER TABLE authz.tai_khoan_vai_tro RENAME COLUMN department_id TO ma_phong_ban;
ALTER TABLE authz.tai_khoan_vai_tro RENAME COLUMN granted_at TO cap_luc;
ALTER TABLE authz.tai_khoan_vai_tro RENAME COLUMN granted_by TO cap_boi;

ALTER TABLE authz.permission RENAME TO quyen;
ALTER TABLE authz.quyen RENAME COLUMN id TO ma_quyen;
ALTER TABLE authz.quyen RENAME COLUMN code TO ky_hieu;
ALTER TABLE authz.quyen RENAME COLUMN module TO phan_he;
ALTER TABLE authz.quyen RENAME COLUMN resource TO tai_nguyen;
ALTER TABLE authz.quyen RENAME COLUMN action TO hanh_dong;
ALTER TABLE authz.quyen RENAME COLUMN column_scope TO pham_vi_cot;
ALTER TABLE authz.quyen RENAME COLUMN description TO mo_ta;

ALTER TABLE authz.role_permission RENAME TO vai_tro_quyen;
ALTER TABLE authz.vai_tro_quyen RENAME COLUMN role_id TO ma_vai_tro;
ALTER TABLE authz.vai_tro_quyen RENAME COLUMN permission_id TO ma_quyen;

ALTER TABLE authz.access_log RENAME TO nhat_ky_truy_cap;
ALTER TABLE authz.nhat_ky_truy_cap RENAME COLUMN id TO ma_nhat_ky;
ALTER TABLE authz.nhat_ky_truy_cap RENAME COLUMN occurred_at TO thoi_diem;
ALTER TABLE authz.nhat_ky_truy_cap RENAME COLUMN account_id TO ma_tai_khoan;
ALTER TABLE authz.nhat_ky_truy_cap RENAME COLUMN employee_id TO ma_nhan_vien;
ALTER TABLE authz.nhat_ky_truy_cap RENAME COLUMN event TO su_kien;
ALTER TABLE authz.nhat_ky_truy_cap RENAME COLUMN ip_address TO dia_chi_ip;
ALTER TABLE authz.nhat_ky_truy_cap RENAME COLUMN user_agent TO tac_nhan;
ALTER TABLE authz.nhat_ky_truy_cap RENAME COLUMN detail TO chi_tiet;

ALTER TABLE app.code_counter RENAME TO bo_dem_ma;
ALTER TABLE app.bo_dem_ma RENAME COLUMN prefix TO tien_to;
ALTER TABLE app.bo_dem_ma RENAME COLUMN period TO ky;
ALTER TABLE app.bo_dem_ma RENAME COLUMN last_value TO gia_tri_cuoi;

ALTER TABLE crm.message RENAME TO tin_nhan;
ALTER TABLE crm.tin_nhan RENAME COLUMN id TO ma_tin_nhan;
ALTER TABLE crm.tin_nhan RENAME COLUMN public_id TO ma_cong_khai;
ALTER TABLE crm.tin_nhan RENAME COLUMN mess_code TO ma_hien_thi;
ALTER TABLE crm.tin_nhan RENAME COLUMN source TO nguon;
ALTER TABLE crm.tin_nhan RENAME COLUMN campaign_id TO ma_chien_dich;
ALTER TABLE crm.tin_nhan RENAME COLUMN received_at TO nhan_luc;
ALTER TABLE crm.tin_nhan RENAME COLUMN customer_id TO ma_khach_hang;
ALTER TABLE crm.tin_nhan RENAME COLUMN customer_name_raw TO ten_khach_hang_tho;
ALTER TABLE crm.tin_nhan RENAME COLUMN phone TO so_dien_thoai;
ALTER TABLE crm.tin_nhan RENAME COLUMN phone_norm TO so_dien_thoai_chuan;
ALTER TABLE crm.tin_nhan RENAME COLUMN email TO thu_dien_tu;
ALTER TABLE crm.tin_nhan RENAME COLUMN market TO thi_truong;
ALTER TABLE crm.tin_nhan RENAME COLUMN origin_country TO quoc_gia_xuat_xu;
ALTER TABLE crm.tin_nhan RENAME COLUMN channel_detail TO chi_tiet_kenh;
ALTER TABLE crm.tin_nhan RENAME COLUMN assigned_employee_id TO ma_nhan_vien_phu_trach;
ALTER TABLE crm.tin_nhan RENAME COLUMN status TO trang_thai;
ALTER TABLE crm.tin_nhan RENAME COLUMN temperature TO nhiet_do;
ALTER TABLE crm.tin_nhan RENAME COLUMN first_response_at TO phan_hoi_dau_luc;
ALTER TABLE crm.tin_nhan RENAME COLUMN response_minutes TO so_phut_phan_hoi;
ALTER TABLE crm.tin_nhan RENAME COLUMN sla_due_at TO han_sla_luc;
ALTER TABLE crm.tin_nhan RENAME COLUMN sla_breached TO vi_pham_sla;
ALTER TABLE crm.tin_nhan RENAME COLUMN external_ref TO ma_tham_chieu_ngoai;
ALTER TABLE crm.tin_nhan RENAME COLUMN raw TO du_lieu_tho;
ALTER TABLE crm.tin_nhan RENAME COLUMN note TO ghi_chu;
ALTER TABLE crm.tin_nhan RENAME COLUMN pain_point_code TO ma_van_de;
ALTER TABLE crm.tin_nhan RENAME COLUMN pain_point_note TO ghi_chu_van_de;
ALTER TABLE crm.tin_nhan RENAME COLUMN page_source TO nguon_trang;
ALTER TABLE crm.tin_nhan RENAME COLUMN info TO thong_tin;
ALTER TABLE crm.tin_nhan RENAME COLUMN info_score TO diem_thong_tin;
ALTER TABLE crm.tin_nhan RENAME COLUMN customer_type TO loai_khach_hang;
ALTER TABLE crm.tin_nhan RENAME COLUMN goods TO hang_hoa;
ALTER TABLE crm.tin_nhan RENAME COLUMN classification TO phan_loai;
ALTER TABLE crm.tin_nhan RENAME COLUMN demand TO nhu_cau;
ALTER TABLE crm.tin_nhan RENAME COLUMN created_at TO tao_luc;
ALTER TABLE crm.tin_nhan RENAME COLUMN updated_at TO cap_nhat_luc;

ALTER TABLE crm.message_status_history RENAME TO lich_su_trang_thai_tin_nhan;
ALTER TABLE crm.lich_su_trang_thai_tin_nhan RENAME COLUMN id TO ma_lich_su;
ALTER TABLE crm.lich_su_trang_thai_tin_nhan RENAME COLUMN message_id TO ma_tin_nhan;
ALTER TABLE crm.lich_su_trang_thai_tin_nhan RENAME COLUMN from_status TO trang_thai_truoc;
ALTER TABLE crm.lich_su_trang_thai_tin_nhan RENAME COLUMN to_status TO trang_thai_sau;
ALTER TABLE crm.lich_su_trang_thai_tin_nhan RENAME COLUMN changed_at TO thay_doi_luc;
ALTER TABLE crm.lich_su_trang_thai_tin_nhan RENAME COLUMN changed_by TO thay_doi_boi;
ALTER TABLE crm.lich_su_trang_thai_tin_nhan RENAME COLUMN note TO ghi_chu;

ALTER TABLE crm.message_pii RENAME TO thong_tin_ca_nhan_tin_nhan;
ALTER TABLE crm.thong_tin_ca_nhan_tin_nhan RENAME COLUMN message_id TO ma_tin_nhan;
ALTER TABLE crm.thong_tin_ca_nhan_tin_nhan RENAME COLUMN customer_name_raw TO ten_khach_hang_tho;
ALTER TABLE crm.thong_tin_ca_nhan_tin_nhan RENAME COLUMN phone TO so_dien_thoai;
ALTER TABLE crm.thong_tin_ca_nhan_tin_nhan RENAME COLUMN phone_norm TO so_dien_thoai_chuan;
ALTER TABLE crm.thong_tin_ca_nhan_tin_nhan RENAME COLUMN email TO thu_dien_tu;
ALTER TABLE crm.thong_tin_ca_nhan_tin_nhan RENAME COLUMN updated_at TO cap_nhat_luc;

ALTER TABLE crm.lead RENAME TO khach_hang_tiem_nang;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN id TO ma_khach_hang_tiem_nang;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN public_id TO ma_cong_khai;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN lead_code TO ma_tiem_nang;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN source TO nguon;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN campaign_id TO ma_chien_dich;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN customer_id TO ma_khach_hang;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN full_name TO ho_ten;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN company_name TO ten_cong_ty;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN phone TO so_dien_thoai;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN phone_norm TO so_dien_thoai_chuan;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN email TO thu_dien_tu;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN email_norm TO thu_dien_tu_chuan;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN market TO thi_truong;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN origin_country TO quoc_gia_xuat_xu;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN product_interest TO san_pham_quan_tam;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN quantity_note TO ghi_chu_so_luong;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN info TO thong_tin;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN info_score TO diem_thong_tin;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN dedupe_hash TO bam_trung_lap;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN temperature TO nhiet_do;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN status TO trang_thai;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN owner_employee_id TO ma_nhan_vien_phu_trach;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN assigned_at TO giao_luc;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN accepted_at TO tiep_nhan_luc;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN first_contact_at TO lien_he_dau_luc;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN next_action_at TO hanh_dong_ke_tiep_luc;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN sla_due_at TO han_sla_luc;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN lost_reason_id TO ma_ly_do_mat;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN lost_note TO ghi_chu_mat_khach;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN utm_source TO utm_nguon;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN utm_medium TO utm_phuong_thuc;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN utm_campaign TO utm_chien_dich;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN utm_term TO utm_tu_khoa;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN utm_content TO utm_noi_dung;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN landing_page TO trang_dich;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN external_id TO ma_ngoai;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN raw TO du_lieu_tho;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN created_at TO tao_luc;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN updated_at TO cap_nhat_luc;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN deleted_at TO xoa_luc;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN pain_point_code TO ma_van_de;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN pain_point_note TO ghi_chu_van_de;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN sale TO nhan_vien_ban;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN customer TO khach_hang;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN classification TO phan_loai;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN brand TO thuong_hieu;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN potential TO tiem_nang;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN mess_id TO ma_tin_nhan;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN customer_kind TO nhom_khach;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN customer_type TO loai_khach_hang;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN address TO dia_chi;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN care_channel TO kenh_cham_soc;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN sale_note TO ghi_chu_ban_hang;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN pack_spec TO quy_cach_dong_goi;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN weight_kg TO trong_luong_kg;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN logistics_class TO phan_loai_logistics;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN ship_from_address TO dia_chi_gui;
ALTER TABLE crm.khach_hang_tiem_nang RENAME COLUMN ship_to_address TO dia_chi_nhan;

ALTER TABLE crm.lead_status_history RENAME TO lich_su_trang_thai_tiem_nang;
ALTER TABLE crm.lich_su_trang_thai_tiem_nang RENAME COLUMN id TO ma_lich_su;
ALTER TABLE crm.lich_su_trang_thai_tiem_nang RENAME COLUMN lead_id TO ma_khach_hang_tiem_nang;
ALTER TABLE crm.lich_su_trang_thai_tiem_nang RENAME COLUMN from_status TO trang_thai_truoc;
ALTER TABLE crm.lich_su_trang_thai_tiem_nang RENAME COLUMN to_status TO trang_thai_sau;
ALTER TABLE crm.lich_su_trang_thai_tiem_nang RENAME COLUMN changed_at TO thay_doi_luc;
ALTER TABLE crm.lich_su_trang_thai_tiem_nang RENAME COLUMN changed_by TO thay_doi_boi;
ALTER TABLE crm.lich_su_trang_thai_tiem_nang RENAME COLUMN note TO ghi_chu;

-- Đổi tên index / constraint / trigger theo tên bảng, cột mới.
ALTER TABLE public.nguoi_dung RENAME CONSTRAINT users_pkey TO nguoi_dung_pkey;
ALTER TABLE public.nguoi_dung RENAME CONSTRAINT users_email_key TO nguoi_dung_thu_dien_tu_key;
ALTER TABLE public.phien_dang_nhap RENAME CONSTRAINT sessions_pkey TO phien_dang_nhap_pkey;
ALTER TABLE public.phien_dang_nhap RENAME CONSTRAINT sessions_user_id_fkey TO phien_dang_nhap_nguoi_dung_fkey;
ALTER INDEX public.sessions_user_id_idx RENAME TO phien_dang_nhap_nguoi_dung_idx;
ALTER INDEX public.sessions_expires_at_idx RENAME TO phien_dang_nhap_het_han_idx;

ALTER TABLE authz.vai_tro RENAME CONSTRAINT app_role_pkey TO vai_tro_pkey;
ALTER TABLE authz.vai_tro RENAME CONSTRAINT app_role_code_key TO vai_tro_ky_hieu_key;
ALTER TABLE authz.tai_khoan RENAME CONSTRAINT account_pkey TO tai_khoan_pkey;
ALTER TABLE authz.tai_khoan RENAME CONSTRAINT account_public_id_key TO tai_khoan_ma_cong_khai_key;
ALTER TABLE authz.tai_khoan RENAME CONSTRAINT account_login_email_key TO tai_khoan_thu_dien_tu_dang_nhap_key;
ALTER TABLE authz.tai_khoan RENAME CONSTRAINT account_failed_chk TO tai_khoan_so_lan_dang_nhap_loi_chk;
ALTER TABLE authz.tai_khoan_vai_tro RENAME CONSTRAINT account_role_pkey TO tai_khoan_vai_tro_pkey;
ALTER TABLE authz.quyen RENAME CONSTRAINT permission_pkey TO quyen_pkey;
ALTER TABLE authz.quyen RENAME CONSTRAINT permission_code_key TO quyen_ky_hieu_key;
ALTER TABLE authz.quyen RENAME CONSTRAINT permission_module_resource_action_column_scope_key TO quyen_phan_he_tai_nguyen_hanh_dong_pham_vi_key;
ALTER TABLE authz.vai_tro_quyen RENAME CONSTRAINT role_permission_pkey TO vai_tro_quyen_pkey;
ALTER TABLE authz.nhat_ky_truy_cap RENAME CONSTRAINT access_log_pkey TO nhat_ky_truy_cap_pkey;
ALTER INDEX authz.access_log_time_brin RENAME TO nhat_ky_truy_cap_thoi_diem_brin;
ALTER INDEX authz.access_log_account_idx RENAME TO nhat_ky_truy_cap_tai_khoan_idx;

ALTER TABLE app.bo_dem_ma RENAME CONSTRAINT code_counter_pkey TO bo_dem_ma_pkey;

ALTER TABLE crm.tin_nhan RENAME CONSTRAINT message_pkey TO tin_nhan_pkey;
ALTER TABLE crm.tin_nhan RENAME CONSTRAINT message_public_id_key TO tin_nhan_ma_cong_khai_key;
ALTER TABLE crm.tin_nhan RENAME CONSTRAINT message_mess_code_key TO tin_nhan_ma_hien_thi_key;
ALTER INDEX crm.message_status_idx RENAME TO tin_nhan_trang_thai_idx;
ALTER INDEX crm.message_assigned_idx RENAME TO tin_nhan_nhan_vien_idx;
ALTER INDEX crm.message_campaign_idx RENAME TO tin_nhan_chien_dich_idx;
ALTER INDEX crm.message_received_brin RENAME TO tin_nhan_nhan_luc_brin;
ALTER INDEX crm.message_external_uq RENAME TO tin_nhan_ma_ngoai_uq;

ALTER TABLE crm.lich_su_trang_thai_tin_nhan RENAME CONSTRAINT message_status_history_pkey TO lich_su_trang_thai_tin_nhan_pkey;
ALTER TABLE crm.lich_su_trang_thai_tin_nhan RENAME CONSTRAINT message_status_history_message_id_fkey TO lich_su_trang_thai_tin_nhan_ma_tin_nhan_fkey;
ALTER INDEX crm.message_status_history_msg_idx RENAME TO lich_su_trang_thai_tin_nhan_ma_tin_nhan_idx;

ALTER TABLE crm.thong_tin_ca_nhan_tin_nhan RENAME CONSTRAINT message_pii_pkey TO thong_tin_ca_nhan_tin_nhan_pkey;
ALTER TABLE crm.thong_tin_ca_nhan_tin_nhan RENAME CONSTRAINT message_pii_message_id_fkey TO thong_tin_ca_nhan_tin_nhan_ma_tin_nhan_fkey;

ALTER TABLE crm.khach_hang_tiem_nang RENAME CONSTRAINT lead_pkey TO khach_hang_tiem_nang_pkey;
ALTER TABLE crm.khach_hang_tiem_nang RENAME CONSTRAINT lead_public_id_key TO khach_hang_tiem_nang_ma_cong_khai_key;
ALTER TABLE crm.khach_hang_tiem_nang RENAME CONSTRAINT lead_lead_code_key TO khach_hang_tiem_nang_ma_tiem_nang_key;
ALTER TABLE crm.khach_hang_tiem_nang RENAME CONSTRAINT lead_contact_chk TO khach_hang_tiem_nang_lien_he_chk;
ALTER TABLE crm.khach_hang_tiem_nang RENAME CONSTRAINT lead_lost_chk TO khach_hang_tiem_nang_mat_khach_chk;
ALTER TABLE crm.khach_hang_tiem_nang RENAME CONSTRAINT lead_sale_chk TO khach_hang_tiem_nang_nhan_vien_ban_chk;
ALTER TABLE crm.khach_hang_tiem_nang RENAME CONSTRAINT lead_customer_json_chk TO khach_hang_tiem_nang_khach_hang_json_chk;
ALTER TABLE crm.khach_hang_tiem_nang RENAME CONSTRAINT lead_weight_chk TO khach_hang_tiem_nang_trong_luong_chk;
ALTER TABLE crm.khach_hang_tiem_nang RENAME CONSTRAINT lead_mess_id_fkey TO khach_hang_tiem_nang_ma_tin_nhan_fkey;
ALTER INDEX crm.lead_status_idx RENAME TO khach_hang_tiem_nang_trang_thai_idx;
ALTER INDEX crm.lead_owner_idx RENAME TO khach_hang_tiem_nang_nhan_vien_idx;
ALTER INDEX crm.lead_campaign_idx RENAME TO khach_hang_tiem_nang_chien_dich_idx;
ALTER INDEX crm.lead_dedupe_idx RENAME TO khach_hang_tiem_nang_bam_trung_lap_idx;
ALTER INDEX crm.lead_external_uq RENAME TO khach_hang_tiem_nang_ma_ngoai_uq;
ALTER INDEX crm.lead_mess_idx RENAME TO khach_hang_tiem_nang_ma_tin_nhan_idx;
ALTER INDEX crm.lead_mess_id_uq RENAME TO khach_hang_tiem_nang_ma_tin_nhan_uq;

ALTER TABLE crm.lich_su_trang_thai_tiem_nang RENAME CONSTRAINT lead_status_history_pkey TO lich_su_trang_thai_tiem_nang_pkey;
ALTER TABLE crm.lich_su_trang_thai_tiem_nang RENAME CONSTRAINT lead_status_history_lead_id_fkey TO lich_su_trang_thai_tiem_nang_ma_khach_hang_fkey;
ALTER INDEX crm.lead_status_history_lead_idx RENAME TO lich_su_trang_thai_tiem_nang_ma_khach_hang_idx;

ALTER TRIGGER trg_account_touch ON authz.tai_khoan RENAME TO trg_tai_khoan_cap_nhat;

ALTER TRIGGER trg_message_touch ON crm.tin_nhan RENAME TO trg_tin_nhan_cap_nhat;
ALTER TRIGGER trg_message_guard ON crm.tin_nhan RENAME TO trg_tin_nhan_bao_ve;
ALTER TRIGGER trg_message_require_hot_info ON crm.tin_nhan RENAME TO trg_tin_nhan_yeu_cau_du_thong_tin;
ALTER TRIGGER trg_message_status_history ON crm.tin_nhan RENAME TO trg_tin_nhan_lich_su_trang_thai;
ALTER TRIGGER trg_sync_message_pii ON crm.tin_nhan RENAME TO trg_dong_bo_thong_tin_ca_nhan;

ALTER TRIGGER trg_a_lead_sheet_sync ON crm.khach_hang_tiem_nang RENAME TO trg_khach_hang_tiem_nang_dong_bo_sheet;
ALTER TRIGGER trg_lead_touch ON crm.khach_hang_tiem_nang RENAME TO trg_khach_hang_tiem_nang_cap_nhat;
ALTER TRIGGER trg_lead_guard ON crm.khach_hang_tiem_nang RENAME TO trg_khach_hang_tiem_nang_bao_ve;
ALTER TRIGGER trg_lead_require_hot_info ON crm.khach_hang_tiem_nang RENAME TO trg_khach_hang_tiem_nang_yeu_cau_du_thong_tin;
ALTER TRIGGER trg_lead_status_history ON crm.khach_hang_tiem_nang RENAME TO trg_khach_hang_tiem_nang_lich_su_trang_thai;

-- Function bodies tham chiếu tên cột; phải tạo lại sau khi rename.
CREATE OR REPLACE FUNCTION app.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN
    NEW.cap_nhat_luc := now();
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION app.next_code(
  p_prefix text,
  p_period text DEFAULT to_char(now(), 'YYYYMMDD'),
  p_pad    int  DEFAULT 4
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v bigint;
BEGIN
  INSERT INTO app.bo_dem_ma (tien_to, ky, gia_tri_cuoi)
  VALUES (p_prefix, p_period, 1)
  ON CONFLICT (tien_to, ky)
    DO UPDATE SET gia_tri_cuoi = app.bo_dem_ma.gia_tri_cuoi + 1
  RETURNING gia_tri_cuoi INTO v;

  RETURN p_prefix || '-' || p_period || '-' || lpad(v::text, p_pad, '0');
END $$;

CREATE OR REPLACE FUNCTION crm.fn_message_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_campaign_source crm.lead_source;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.han_sla_luc IS NULL THEN
      NEW.han_sla_luc := NEW.nhan_luc + interval '10 minutes';
    END IF;

    IF NEW.ma_chien_dich IS NOT NULL AND to_regclass('mkt.campaign') IS NOT NULL THEN
      EXECUTE
        'SELECT source FROM mkt.campaign WHERE id = $1'
        INTO v_campaign_source
        USING NEW.ma_chien_dich;
      IF v_campaign_source IS NOT NULL
         AND v_campaign_source <> NEW.nguon
         AND NOT app.system_mode() THEN
        RAISE EXCEPTION 'Nguồn mess (%) không khớp nguồn campaign (%)',
          NEW.nguon, v_campaign_source
          USING ERRCODE = '23514';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF (NEW.nguon IS DISTINCT FROM OLD.nguon OR NEW.ma_chien_dich IS DISTINCT FROM OLD.ma_chien_dich)
     AND NOT app.system_mode()
     AND NOT app.has_role('speego_manager', 'speego_service') THEN
    RAISE EXCEPTION 'Nguồn/chiến dịch của mess do quy trình gán, không được sửa'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.phan_hoi_dau_luc IS NULL
     AND NEW.phan_hoi_dau_luc IS NULL
     AND NEW.trang_thai <> 'NEW' THEN
    NEW.phan_hoi_dau_luc := now();
  END IF;

  IF NEW.trang_thai = 'CONVERTED' AND NEW.phan_hoi_dau_luc IS NULL THEN
    NEW.phan_hoi_dau_luc := now();
  END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION crm.fn_require_hot_info()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.nhiet_do = 'HOT' AND NOT app.system_mode() THEN
    IF app.lead_info_score(coalesce(NEW.thong_tin, '{}'::jsonb)) < 6 THEN
      RAISE EXCEPTION 'Chỉ chuyển Hot khi đủ 6 thông tin (hiện %/6)',
        app.lead_info_score(coalesce(NEW.thong_tin, '{}'::jsonb))
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION crm.fn_message_status_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.trang_thai IS DISTINCT FROM OLD.trang_thai THEN
    INSERT INTO crm.lich_su_trang_thai_tin_nhan(ma_tin_nhan, trang_thai_truoc, trang_thai_sau, thay_doi_boi)
    VALUES (NEW.ma_tin_nhan, OLD.trang_thai, NEW.trang_thai, app.current_employee_id());
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION crm.fn_sync_message_pii()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = crm, app, public
AS $$
BEGIN
  INSERT INTO crm.thong_tin_ca_nhan_tin_nhan(ma_tin_nhan, ten_khach_hang_tho, so_dien_thoai, thu_dien_tu, cap_nhat_luc)
  VALUES (NEW.ma_tin_nhan, NEW.ten_khach_hang_tho, NEW.so_dien_thoai, NEW.thu_dien_tu, now())
  ON CONFLICT (ma_tin_nhan) DO UPDATE SET
    ten_khach_hang_tho = EXCLUDED.ten_khach_hang_tho,
    so_dien_thoai = EXCLUDED.so_dien_thoai,
    thu_dien_tu = EXCLUDED.thu_dien_tu,
    cap_nhat_luc = now();
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION crm.fn_lead_sheet_sync()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.nhan_vien_ban IS NOT NULL AND coalesce(NEW.nhan_vien_ban ->> 'id', '') ~ '^[0-9]+$' THEN
    NEW.ma_nhan_vien_phu_trach := (NEW.nhan_vien_ban ->> 'id')::bigint;
  END IF;

  IF NEW.khach_hang IS NOT NULL AND coalesce(NEW.khach_hang ->> 'id', '') ~ '^[0-9]+$' THEN
    NEW.ma_khach_hang := (NEW.khach_hang ->> 'id')::bigint;
  END IF;

  IF NEW.khach_hang IS NOT NULL
     AND nullif(btrim(NEW.khach_hang ->> 'name'), '') IS NOT NULL
     AND coalesce(NEW.ho_ten, '') = '' THEN
    NEW.ho_ten := btrim(NEW.khach_hang ->> 'name');
  END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION crm.fn_lead_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_customer bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.ma_khach_hang IS NULL
       AND to_regprocedure('crm.fn_find_customer(text,text,text)') IS NOT NULL THEN
      EXECUTE 'SELECT crm.fn_find_customer($1, $2, NULL)'
        INTO v_customer
        USING NEW.so_dien_thoai, NEW.thu_dien_tu;
      NEW.ma_khach_hang := v_customer;
    END IF;

    IF NEW.han_sla_luc IS NULL THEN
      NEW.han_sla_luc := now() + interval '30 minutes';
    END IF;

    IF NEW.trang_thai <> 'NEW' AND NEW.giao_luc IS NULL THEN
      NEW.giao_luc := now();
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.trang_thai IS DISTINCT FROM OLD.trang_thai THEN
    IF NEW.trang_thai = 'CONVERTED' AND NEW.lien_he_dau_luc IS NULL THEN
      NEW.lien_he_dau_luc := now();
    END IF;
    IF NEW.trang_thai = 'LOST' AND NEW.ma_ly_do_mat IS NULL AND NEW.ghi_chu_mat_khach IS NULL THEN
      RAISE EXCEPTION 'Mất khách phải ghi lý do (ma_ly_do_mat hoặc ghi_chu_mat_khach)'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.ma_nhan_vien_phu_trach IS DISTINCT FROM OLD.ma_nhan_vien_phu_trach
     AND NEW.ma_nhan_vien_phu_trach IS NOT NULL THEN
    NEW.giao_luc := coalesce(NEW.giao_luc, now());
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION crm.fn_lead_status_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.trang_thai IS DISTINCT FROM OLD.trang_thai THEN
    INSERT INTO crm.lich_su_trang_thai_tiem_nang(ma_khach_hang_tiem_nang, trang_thai_truoc, trang_thai_sau, thay_doi_boi)
    VALUES (NEW.ma_khach_hang_tiem_nang, OLD.trang_thai, NEW.trang_thai, app.current_employee_id());
  END IF;
  RETURN NULL;
END $$;
