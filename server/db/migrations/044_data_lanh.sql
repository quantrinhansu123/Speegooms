-- Data lạnh: khách cũ chia vòng tròn cho Sales intern chăm Facebook / Telesale.
-- Idempotent.

ALTER TABLE public.nguoi_dung DROP CONSTRAINT IF EXISTS nguoi_dung_vai_tro_check;
ALTER TABLE public.nguoi_dung
  ADD CONSTRAINT nguoi_dung_vai_tro_check CHECK (
    vai_tro IN (
      'admin', 'ban-gd', 'marketing', 'sale-vn', 'sale-global', 'sale-intern',
      'van-hanh', 'sourcing', 'logistics', 'ke-toan', 'hcns', 'phap-che'
    )
  );

CREATE TABLE IF NOT EXISTS crm.data_lanh (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stt                 integer NOT NULL UNIQUE,   -- STT trong file nguồn, dùng để nạp lại không bị trùng
  ho_ten              text,
  ten_tiem            text,
  so_dien_thoai       text,
  link_facebook       text,
  thi_truong          text,
  mang_kinh_doanh     text,
  phan_loai_khach     text,
  dia_chi             text,
  quan_tam            text,
  lich_su_cskh        text,
  ghi_chu             text,
  intern_id           text REFERENCES public.nguoi_dung (ma_nguoi_dung) ON DELETE SET NULL,
  giao_luc            timestamptz,
  trang_thai_facebook text,
  trang_thai_telesale text,
  tao_luc             timestamptz NOT NULL DEFAULT now(),
  cap_nhat_luc        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS data_lanh_intern_idx ON crm.data_lanh (intern_id);
