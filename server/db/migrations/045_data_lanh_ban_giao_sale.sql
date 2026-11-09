-- Data lạnh: intern bàn giao khách cho một Sale cụ thể để care tiếp (Sale nhận thông báo trên chuông).
-- Idempotent.

ALTER TABLE crm.data_lanh
  ADD COLUMN IF NOT EXISTS sale_care_id text REFERENCES public.nguoi_dung (ma_nguoi_dung) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ban_giao_luc timestamptz,
  ADD COLUMN IF NOT EXISTS ban_giao_boi text REFERENCES public.nguoi_dung (ma_nguoi_dung) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS data_lanh_sale_care_idx ON crm.data_lanh (sale_care_id);
