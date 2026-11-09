-- Danh sách người được chia vòng tròn data lạnh (thứ tự = thu_tu). Quản lý bằng scripts/set-data-lanh-pool.ts.
-- Idempotent.

CREATE TABLE IF NOT EXISTS crm.data_lanh_nguoi_nhan (
  nguoi_dung_id text PRIMARY KEY REFERENCES public.nguoi_dung (ma_nguoi_dung) ON DELETE CASCADE,
  thu_tu        integer NOT NULL UNIQUE
);
