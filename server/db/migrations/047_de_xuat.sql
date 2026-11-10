-- Module Đề xuất (chấm công, đi muộn/về sớm, thanh toán, nghỉ phép...): đề xuất nhiều bước duyệt + mẫu đề xuất.
-- Idempotent.

CREATE SEQUENCE IF NOT EXISTS app.de_xuat_ma_seq;

CREATE TABLE IF NOT EXISTS app.de_xuat_mau (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_goc        text,                         -- khóa mẫu hệ thống bị ghi đè; NULL = mẫu riêng
  nhom          text NOT NULL DEFAULT 'CHUNG',
  tieu_de       text NOT NULL,
  mo_ta         text NOT NULL DEFAULT '',
  ve_viec       text NOT NULL DEFAULT '',
  noi_dung      text NOT NULL DEFAULT '',
  mau           text NOT NULL DEFAULT '#16a34a',
  nguoi_duyet   jsonb NOT NULL DEFAULT '[]',  -- [{id, name}] theo thứ tự duyệt
  gioi_han      integer CHECK (gioi_han IS NULL OR gioi_han > 0),
  chu_ky        text NOT NULL DEFAULT 'month' CHECK (chu_ky IN ('week', 'month', 'year')),
  nguoi_tao_id  text REFERENCES public.nguoi_dung (ma_nguoi_dung) ON DELETE SET NULL,
  tao_luc       timestamptz NOT NULL DEFAULT now(),
  cap_nhat_luc  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS de_xuat_mau_ma_goc_uq ON app.de_xuat_mau (ma_goc) WHERE ma_goc IS NOT NULL;

CREATE TABLE IF NOT EXISTS app.de_xuat (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ma              text NOT NULL UNIQUE DEFAULT ('DX-' || lpad(nextval('app.de_xuat_ma_seq')::text, 5, '0')),
  mau_id          text NOT NULL,              -- khóa mẫu hệ thống hoặc uuid mẫu riêng
  loai            text NOT NULL CHECK (loai IN ('cham-cong', 'di-muon-ve-som', 'thanh-toan', 'nghi-phep', 'chung')),
  ten_mau         text NOT NULL,
  ve_viec         text NOT NULL,
  noi_dung        text NOT NULL,
  chi_tiet        jsonb NOT NULL DEFAULT '{}',
  dinh_kem        jsonb NOT NULL DEFAULT '[]',
  nguoi_theo_doi  jsonb NOT NULL DEFAULT '[]', -- [{id, name}]
  nguoi_tao_id    text NOT NULL REFERENCES public.nguoi_dung (ma_nguoi_dung) ON DELETE CASCADE,
  trang_thai      text NOT NULL DEFAULT 'cho-duyet' CHECK (trang_thai IN ('cho-duyet', 'da-duyet', 'tu-choi')),
  buoc_hien_tai   integer NOT NULL DEFAULT 0,
  cac_buoc        jsonb NOT NULL,             -- [{approverId, approverName, decision, decidedAt, decidedById, decidedByName, comment}]
  tao_luc         timestamptz NOT NULL DEFAULT now(),
  cap_nhat_luc    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS de_xuat_nguoi_tao_idx ON app.de_xuat (nguoi_tao_id, tao_luc DESC);
CREATE INDEX IF NOT EXISTS de_xuat_tao_luc_idx ON app.de_xuat (tao_luc DESC);

REVOKE ALL ON TABLE app.de_xuat, app.de_xuat_mau FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE app.de_xuat, app.de_xuat_mau FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE app.de_xuat, app.de_xuat_mau FROM authenticated';
  END IF;
END $$;
