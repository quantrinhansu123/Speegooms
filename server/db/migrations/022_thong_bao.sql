-- Thông báo in-app theo từng người nhận (bàn giao báo giá / hợp đồng).

CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.thong_bao (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nguoi_nhan_id     text NOT NULL REFERENCES public.nguoi_dung (ma_nguoi_dung) ON DELETE CASCADE,
  nguoi_gui_id      text REFERENCES public.nguoi_dung (ma_nguoi_dung) ON DELETE SET NULL,
  loai              text NOT NULL,
  tieu_de           text NOT NULL,
  noi_dung          text NOT NULL DEFAULT '',
  duong_dan         text NOT NULL DEFAULT '',
  tuyen             text CHECK (tuyen IS NULL OR tuyen IN ('vn', 'global')),
  tham_chieu_loai   text,
  tham_chieu_id     text,
  da_xem            boolean NOT NULL DEFAULT false,
  xem_luc           timestamptz,
  tao_luc           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS thong_bao_nguoi_nhan_idx
  ON app.thong_bao (nguoi_nhan_id, da_xem, tao_luc DESC);

COMMENT ON TABLE app.thong_bao IS
  'Thông báo in-app: mỗi dòng gắn một người nhận, dùng cho badge chưa đọc trên header.';
COMMENT ON COLUMN app.thong_bao.loai IS
  'quote.request | quote.send | quote.return | contract.create | contract.resend.ops | contract.resend.accounting | contract.resend.parties';
COMMENT ON COLUMN app.thong_bao.duong_dan IS
  'Đường dẫn FE để mở khi click thông báo.';

REVOKE ALL ON TABLE app.thong_bao FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE app.thong_bao FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE app.thong_bao FROM authenticated';
  END IF;
END $$;
