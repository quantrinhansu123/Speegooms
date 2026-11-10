-- Góp ý của người theo dõi / người duyệt trên đề xuất: kết luận (đủ / không đủ điều kiện) kèm lý do. Idempotent.

CREATE TABLE IF NOT EXISTS app.de_xuat_gop_y (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  de_xuat_id    uuid NOT NULL REFERENCES app.de_xuat (id) ON DELETE CASCADE,
  nguoi_gop_y_id text NOT NULL REFERENCES public.nguoi_dung (ma_nguoi_dung) ON DELETE CASCADE,
  ket_luan      text NOT NULL CHECK (ket_luan IN ('du-dieu-kien', 'khong-du-dieu-kien')),
  ly_do         text NOT NULL DEFAULT '',
  tao_luc       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS de_xuat_gop_y_de_xuat_idx ON app.de_xuat_gop_y (de_xuat_id, tao_luc);

REVOKE ALL ON TABLE app.de_xuat_gop_y FROM PUBLIC;
