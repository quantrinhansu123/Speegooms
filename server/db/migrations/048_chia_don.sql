-- Chia đơn báo giá xoay vòng cho nhân sự Vận hành: Logistics (Thảo, Quốc Anh), Sourcing (Hương Thanh, Kim Anh).
-- Ai đang off (nghỉ phép đã duyệt hôm nay hoặc bật off tay) thì bị bỏ qua. Idempotent.

CREATE TABLE IF NOT EXISTS crm.chia_don_nguoi_nhan (
  ban           text NOT NULL CHECK (ban IN ('sourcing', 'logistics')),
  nguoi_dung_id text NOT NULL REFERENCES public.nguoi_dung (ma_nguoi_dung) ON DELETE CASCADE,
  thu_tu        integer NOT NULL,
  off_thu_cong  boolean NOT NULL DEFAULT false,
  PRIMARY KEY (ban, nguoi_dung_id)
);

-- Báo giá nào đã chia cho ai. Phiếu Logistics của khách Sourcing kết hợp dùng id của dòng Sourcing với ban = 'logistics'.
CREATE TABLE IF NOT EXISTS crm.chia_don (
  tuyen         text NOT NULL CHECK (tuyen IN ('vn', 'global')),
  ban           text NOT NULL CHECK (ban IN ('sourcing', 'logistics')),
  bao_gia_id    uuid NOT NULL,
  nguoi_nhan_id text REFERENCES public.nguoi_dung (ma_nguoi_dung) ON DELETE SET NULL,
  phan_cong_luc timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tuyen, ban, bao_gia_id)
);

CREATE INDEX IF NOT EXISTS chia_don_ban_luc_idx ON crm.chia_don (ban, phan_cong_luc DESC);

INSERT INTO crm.chia_don_nguoi_nhan (ban, nguoi_dung_id, thu_tu)
SELECT v.ban, u.ma_nguoi_dung, v.thu_tu
FROM (VALUES
  ('logistics', 'Dương Thị Thanh Thảo', 1),
  ('logistics', 'Trịnh Ngọc Quốc Anh', 2),
  ('sourcing',  'Trần Thị Hương Thanh', 1),
  ('sourcing',  'Hoàng Thị Kim Anh', 2)
) AS v (ban, ten, thu_tu)
JOIN public.nguoi_dung u ON lower(u.ho_ten) = lower(v.ten)
ON CONFLICT DO NOTHING;

REVOKE ALL ON TABLE crm.chia_don_nguoi_nhan, crm.chia_don FROM PUBLIC;
