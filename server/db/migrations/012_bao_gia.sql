-- Báo giá vận hành, tách theo tuyến Sale và theo bàn Sourcing / Logistics.
-- Mẫu báo giá dùng chung, gắn với từng bàn. Sale chỉ tạo bản ghi; vận hành sửa mẫu và ghi chú.

DO $$ BEGIN
  CREATE TYPE crm.trang_thai_bao_gia AS ENUM (
    'CHUA_CO_BAO_GIA',
    'DA_CO_BAO_GIA',
    'CHUA_CO_BAO_GIA_LAI',
    'DA_CO_BAO_GIA_LAI'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE crm.trang_thai_hop_dong_bao_gia AS ENUM ('CHUA_TAO', 'DA_TAO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE crm.ban_bao_gia AS ENUM ('SOURCING', 'LOGISTICS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS crm.mau_bao_gia (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ten          text NOT NULL,
  noi_dung     text,
  ban          crm.ban_bao_gia NOT NULL,
  tao_luc      timestamptz NOT NULL DEFAULT now(),
  cap_nhat_luc timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mau_bao_gia_ten_key UNIQUE (ban, ten)
);

COMMENT ON TABLE crm.mau_bao_gia IS
  'Mẫu báo giá do vận hành quản lý. Mỗi bàn Sourcing hoặc Logistics có danh mục riêng.';

CREATE TABLE IF NOT EXISTS crm.bao_gia_sourcing_viet_nam (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_hien_thi             text NOT NULL UNIQUE DEFAULT app.next_code('BGS'),
  ma_khach_hang_tiem_nang uuid NOT NULL,
  ma_mau                  uuid,
  ghi_chu_vh              text,
  trang_thai_bao_gia      crm.trang_thai_bao_gia NOT NULL DEFAULT 'CHUA_CO_BAO_GIA',
  trang_thai_hop_dong     crm.trang_thai_hop_dong_bao_gia NOT NULL DEFAULT 'CHUA_TAO',
  tao_luc                 timestamptz NOT NULL DEFAULT now(),
  cap_nhat_luc            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bao_gia_sourcing_viet_nam_khach_key UNIQUE (ma_khach_hang_tiem_nang),
  CONSTRAINT bao_gia_sourcing_viet_nam_khach_fkey
    FOREIGN KEY (ma_khach_hang_tiem_nang) REFERENCES crm.khach_hang_tiem_nang_viet_nam (ma_khach_hang_tiem_nang),
  CONSTRAINT bao_gia_sourcing_viet_nam_mau_fkey
    FOREIGN KEY (ma_mau) REFERENCES crm.mau_bao_gia (id)
);

CREATE TABLE IF NOT EXISTS crm.bao_gia_sourcing_global (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_hien_thi             text NOT NULL UNIQUE DEFAULT app.next_code('BGS'),
  ma_khach_hang_tiem_nang uuid NOT NULL,
  ma_mau                  uuid,
  ghi_chu_vh              text,
  trang_thai_bao_gia      crm.trang_thai_bao_gia NOT NULL DEFAULT 'CHUA_CO_BAO_GIA',
  trang_thai_hop_dong     crm.trang_thai_hop_dong_bao_gia NOT NULL DEFAULT 'CHUA_TAO',
  tao_luc                 timestamptz NOT NULL DEFAULT now(),
  cap_nhat_luc            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bao_gia_sourcing_global_khach_key UNIQUE (ma_khach_hang_tiem_nang),
  CONSTRAINT bao_gia_sourcing_global_khach_fkey
    FOREIGN KEY (ma_khach_hang_tiem_nang) REFERENCES crm.khach_hang_tiem_nang_global (ma_khach_hang_tiem_nang),
  CONSTRAINT bao_gia_sourcing_global_mau_fkey
    FOREIGN KEY (ma_mau) REFERENCES crm.mau_bao_gia (id)
);

CREATE TABLE IF NOT EXISTS crm.bao_gia_logistics_viet_nam (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_hien_thi             text NOT NULL UNIQUE DEFAULT app.next_code('BGL'),
  ma_khach_hang_tiem_nang uuid NOT NULL,
  ma_mau                  uuid,
  ghi_chu_vh              text,
  trang_thai_bao_gia      crm.trang_thai_bao_gia NOT NULL DEFAULT 'CHUA_CO_BAO_GIA',
  trang_thai_hop_dong     crm.trang_thai_hop_dong_bao_gia NOT NULL DEFAULT 'CHUA_TAO',
  tao_luc                 timestamptz NOT NULL DEFAULT now(),
  cap_nhat_luc            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bao_gia_logistics_viet_nam_khach_key UNIQUE (ma_khach_hang_tiem_nang),
  CONSTRAINT bao_gia_logistics_viet_nam_khach_fkey
    FOREIGN KEY (ma_khach_hang_tiem_nang) REFERENCES crm.khach_hang_tiem_nang_viet_nam (ma_khach_hang_tiem_nang),
  CONSTRAINT bao_gia_logistics_viet_nam_mau_fkey
    FOREIGN KEY (ma_mau) REFERENCES crm.mau_bao_gia (id)
);

CREATE TABLE IF NOT EXISTS crm.bao_gia_logistics_global (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_hien_thi             text NOT NULL UNIQUE DEFAULT app.next_code('BGL'),
  ma_khach_hang_tiem_nang uuid NOT NULL,
  ma_mau                  uuid,
  ghi_chu_vh              text,
  trang_thai_bao_gia      crm.trang_thai_bao_gia NOT NULL DEFAULT 'CHUA_CO_BAO_GIA',
  trang_thai_hop_dong     crm.trang_thai_hop_dong_bao_gia NOT NULL DEFAULT 'CHUA_TAO',
  tao_luc                 timestamptz NOT NULL DEFAULT now(),
  cap_nhat_luc            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bao_gia_logistics_global_khach_key UNIQUE (ma_khach_hang_tiem_nang),
  CONSTRAINT bao_gia_logistics_global_khach_fkey
    FOREIGN KEY (ma_khach_hang_tiem_nang) REFERENCES crm.khach_hang_tiem_nang_global (ma_khach_hang_tiem_nang),
  CONSTRAINT bao_gia_logistics_global_mau_fkey
    FOREIGN KEY (ma_mau) REFERENCES crm.mau_bao_gia (id)
);

COMMENT ON TABLE crm.bao_gia_sourcing_viet_nam IS 'Báo giá Sourcing của Sale Việt Nam.';
COMMENT ON TABLE crm.bao_gia_sourcing_global IS 'Báo giá Sourcing của Sale Global.';
COMMENT ON TABLE crm.bao_gia_logistics_viet_nam IS 'Báo giá Logistics của Sale Việt Nam.';
COMMENT ON TABLE crm.bao_gia_logistics_global IS 'Báo giá Logistics của Sale Global.';

DROP TRIGGER IF EXISTS trg_mau_bao_gia_cap_nhat ON crm.mau_bao_gia;
CREATE TRIGGER trg_mau_bao_gia_cap_nhat
  BEFORE UPDATE ON crm.mau_bao_gia
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

DROP TRIGGER IF EXISTS trg_bao_gia_sourcing_viet_nam_cap_nhat ON crm.bao_gia_sourcing_viet_nam;
CREATE TRIGGER trg_bao_gia_sourcing_viet_nam_cap_nhat
  BEFORE UPDATE ON crm.bao_gia_sourcing_viet_nam
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

DROP TRIGGER IF EXISTS trg_bao_gia_sourcing_global_cap_nhat ON crm.bao_gia_sourcing_global;
CREATE TRIGGER trg_bao_gia_sourcing_global_cap_nhat
  BEFORE UPDATE ON crm.bao_gia_sourcing_global
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

DROP TRIGGER IF EXISTS trg_bao_gia_logistics_viet_nam_cap_nhat ON crm.bao_gia_logistics_viet_nam;
CREATE TRIGGER trg_bao_gia_logistics_viet_nam_cap_nhat
  BEFORE UPDATE ON crm.bao_gia_logistics_viet_nam
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

DROP TRIGGER IF EXISTS trg_bao_gia_logistics_global_cap_nhat ON crm.bao_gia_logistics_global;
CREATE TRIGGER trg_bao_gia_logistics_global_cap_nhat
  BEFORE UPDATE ON crm.bao_gia_logistics_global
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

REVOKE ALL ON TABLE crm.mau_bao_gia FROM PUBLIC;
REVOKE ALL ON TABLE crm.bao_gia_sourcing_viet_nam FROM PUBLIC;
REVOKE ALL ON TABLE crm.bao_gia_sourcing_global FROM PUBLIC;
REVOKE ALL ON TABLE crm.bao_gia_logistics_viet_nam FROM PUBLIC;
REVOKE ALL ON TABLE crm.bao_gia_logistics_global FROM PUBLIC;
