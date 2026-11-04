-- Kế toán: đề nghị thanh toán, lịch sử bước, bảng lương, chi phí nội bộ.
-- Chạy sau 030. Chưa gắn logic ứng dụng.
-- Khóa chính là id. Tên bảng và cột còn lại là tiếng Việt không dấu.

CREATE SCHEMA IF NOT EXISTS ke_toan;

DO $$ BEGIN
  CREATE TYPE ke_toan.doi_tuong_nhan AS ENUM ('NHA_CUNG_CAP', 'DOI_TAC_VAN_CHUYEN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ke_toan.muc_dich_thanh_toan AS ENUM (
    'DAT_COC_XUONG', 'THANH_TOAN_XUONG', 'CUOC_VAN_CHUYEN', 'KHAC'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ke_toan.trang_thai_de_nghi AS ENUM (
    'NHAP', 'CHO_DUYET', 'DA_DUYET', 'DA_CHI', 'TU_CHOI', 'HUY'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ke_toan.trang_thai_chi_phi AS ENUM ('CHO_DUYET', 'DA_CHI');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE ke_toan.doi_tuong_nhan IS
  'NHA_CUNG_CAP nhà cung cấp, DOI_TAC_VAN_CHUYEN đối tác vận chuyển.';
COMMENT ON TYPE ke_toan.muc_dich_thanh_toan IS
  'DAT_COC_XUONG đặt cọc xưởng, THANH_TOAN_XUONG thanh toán xưởng, CUOC_VAN_CHUYEN cước vận chuyển, KHAC khác.';
COMMENT ON TYPE ke_toan.trang_thai_de_nghi IS
  'NHAP nháp, CHO_DUYET chờ duyệt, DA_DUYET đã duyệt chờ chi, DA_CHI đã chi, TU_CHOI từ chối, HUY hủy.';
COMMENT ON TYPE ke_toan.trang_thai_chi_phi IS
  'CHO_DUYET chờ duyệt, DA_CHI đã chi.';

CREATE TABLE IF NOT EXISTS ke_toan.de_nghi_thanh_toan (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_hien_thi            text NOT NULL UNIQUE DEFAULT app.next_code('DNTT'),
  ma_don_hang            text NOT NULL,
  ma_tin_nhan            text,
  ma_rfq                 text,
  ma_khach_hang          text,
  ten_khach_hang         text,
  doi_tuong_nhan         ke_toan.doi_tuong_nhan NOT NULL,
  muc_dich               ke_toan.muc_dich_thanh_toan NOT NULL,
  ma_nguoi_nhan          text,
  nguoi_nhan             text,
  ma_tham_chieu          text,
  noi_dung_thanh_toan    text NOT NULL,
  so_tien                numeric(18,2) NOT NULL,
  tien_te                char(3) NOT NULL DEFAULT 'VND',
  ghi_chu                text,
  trang_thai             ke_toan.trang_thai_de_nghi NOT NULL DEFAULT 'NHAP',
  nguoi_nhap             text,
  nhap_luc               timestamptz NOT NULL DEFAULT now(),
  nguoi_duyet            text,
  duyet_luc              timestamptz,
  ghi_chu_duyet          text,
  nguoi_chi              text,
  chi_luc                timestamptz,
  ma_giao_dich_ngan_hang text,
  doi_soat_luc           timestamptz,
  ly_do_tu_choi          text,
  tao_luc                timestamptz NOT NULL DEFAULT now(),
  cap_nhat_luc           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT de_nghi_don_hang_chk CHECK (btrim(ma_don_hang) <> ''),
  CONSTRAINT de_nghi_noi_dung_chk CHECK (btrim(noi_dung_thanh_toan) <> ''),
  CONSTRAINT de_nghi_so_tien_chk CHECK (so_tien > 0)
);

COMMENT ON TABLE ke_toan.de_nghi_thanh_toan IS
  'Đề nghị thanh toán. Tìm theo mã, đơn hàng, người nhận, mã tham chiếu, tên khách và nội dung.';
COMMENT ON COLUMN ke_toan.de_nghi_thanh_toan.noi_dung_thanh_toan IS 'Nội dung thanh toán.';
COMMENT ON COLUMN ke_toan.de_nghi_thanh_toan.ma_nguoi_nhan IS 'Mã nhà cung cấp hoặc đối tác vận chuyển.';
COMMENT ON COLUMN ke_toan.de_nghi_thanh_toan.ma_tham_chieu IS 'Mã đơn mua hoặc mã lô hàng.';
COMMENT ON COLUMN ke_toan.de_nghi_thanh_toan.ghi_chu_duyet IS 'Ghi chú khi duyệt.';
COMMENT ON COLUMN ke_toan.de_nghi_thanh_toan.ma_tin_nhan IS 'Mess trên chuỗi chi tiết.';
COMMENT ON COLUMN ke_toan.de_nghi_thanh_toan.ma_rfq IS 'RFQ trên chuỗi chi tiết.';

CREATE TABLE IF NOT EXISTS ke_toan.lich_su_de_nghi (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_de_nghi       uuid NOT NULL REFERENCES ke_toan.de_nghi_thanh_toan (id) ON DELETE CASCADE,
  noi_dung         text NOT NULL,
  nguoi_thuc_hien  text,
  thoi_diem        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lich_su_de_nghi_noi_dung_chk CHECK (btrim(noi_dung) <> '')
);

COMMENT ON TABLE ke_toan.lich_su_de_nghi IS
  'Lịch sử đề nghị: nội dung, người làm và thời điểm từng bước.';

CREATE INDEX IF NOT EXISTS de_nghi_tim_don_idx
  ON ke_toan.de_nghi_thanh_toan (ma_don_hang);
CREATE INDEX IF NOT EXISTS de_nghi_tim_nguoi_nhan_idx
  ON ke_toan.de_nghi_thanh_toan (nguoi_nhan);
CREATE INDEX IF NOT EXISTS de_nghi_tim_khach_idx
  ON ke_toan.de_nghi_thanh_toan (ten_khach_hang);
CREATE INDEX IF NOT EXISTS de_nghi_trang_thai_idx
  ON ke_toan.de_nghi_thanh_toan (trang_thai, nhap_luc DESC);
CREATE INDEX IF NOT EXISTS lich_su_de_nghi_idx
  ON ke_toan.lich_su_de_nghi (ma_de_nghi, thoi_diem DESC);

CREATE TABLE IF NOT EXISTS ke_toan.luong_nhan_su (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_hien_thi         text NOT NULL UNIQUE DEFAULT app.next_code('LU'),
  ky                  date NOT NULL,
  ma_nhan_su          text NOT NULL,
  ho_ten              text NOT NULL,
  phong_ban           text NOT NULL,
  vi_tri              text,
  luong_co_ban        numeric(18,2) NOT NULL,
  phu_cap             numeric(18,2) NOT NULL DEFAULT 0,
  khau_tru_bao_hiem   numeric(18,2) NOT NULL DEFAULT 0,
  thuc_nhan           numeric(18,2) GENERATED ALWAYS AS (luong_co_ban + phu_cap - khau_tru_bao_hiem) STORED,
  tao_luc             timestamptz NOT NULL DEFAULT now(),
  cap_nhat_luc        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT luong_ky_nhan_su_key UNIQUE (ky, ma_nhan_su),
  CONSTRAINT luong_ten_chk CHECK (btrim(ho_ten) <> '' AND btrim(ma_nhan_su) <> ''),
  CONSTRAINT luong_tien_chk CHECK (
    luong_co_ban >= 0
    AND phu_cap >= 0
    AND khau_tru_bao_hiem >= 0
    AND khau_tru_bao_hiem <= luong_co_ban + phu_cap
  )
);

COMMENT ON TABLE ke_toan.luong_nhan_su IS
  'Một dòng lương của một nhân sự trong một kỳ.';
COMMENT ON COLUMN ke_toan.luong_nhan_su.ky IS 'Ngày đầu kỳ lương, ví dụ 2026-10-01.';
COMMENT ON COLUMN ke_toan.luong_nhan_su.thuc_nhan IS
  'Thực nhận, bằng lương cơ bản cộng phụ cấp trừ khấu trừ bảo hiểm.';

CREATE TABLE IF NOT EXISTS ke_toan.chi_phi_noi_bo (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_hien_thi   text NOT NULL UNIQUE DEFAULT app.next_code('CP'),
  ngay_chi      date NOT NULL,
  phong_ban     text NOT NULL,
  hang_muc      text NOT NULL,
  noi_dung      text NOT NULL,
  so_tien       numeric(18,2) NOT NULL,
  trang_thai    ke_toan.trang_thai_chi_phi NOT NULL DEFAULT 'CHO_DUYET',
  tao_luc       timestamptz NOT NULL DEFAULT now(),
  cap_nhat_luc  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chi_phi_noi_dung_chk CHECK (btrim(noi_dung) <> '' AND btrim(hang_muc) <> ''),
  CONSTRAINT chi_phi_so_tien_chk CHECK (so_tien > 0)
);

COMMENT ON TABLE ke_toan.chi_phi_noi_bo IS
  'Chi phí nội bộ theo phòng ban. Không gồm đề nghị thanh toán nhà cung cấp.';

CREATE INDEX IF NOT EXISTS chi_phi_ngay_idx
  ON ke_toan.chi_phi_noi_bo (ngay_chi DESC);
CREATE INDEX IF NOT EXISTS chi_phi_phong_ban_idx
  ON ke_toan.chi_phi_noi_bo (phong_ban, trang_thai);

DROP TRIGGER IF EXISTS trg_de_nghi_thanh_toan_cap_nhat ON ke_toan.de_nghi_thanh_toan;
CREATE TRIGGER trg_de_nghi_thanh_toan_cap_nhat
  BEFORE UPDATE ON ke_toan.de_nghi_thanh_toan
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

DROP TRIGGER IF EXISTS trg_luong_nhan_su_cap_nhat ON ke_toan.luong_nhan_su;
CREATE TRIGGER trg_luong_nhan_su_cap_nhat
  BEFORE UPDATE ON ke_toan.luong_nhan_su
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

DROP TRIGGER IF EXISTS trg_chi_phi_noi_bo_cap_nhat ON ke_toan.chi_phi_noi_bo;
CREATE TRIGGER trg_chi_phi_noi_bo_cap_nhat
  BEFORE UPDATE ON ke_toan.chi_phi_noi_bo
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

REVOKE ALL ON TABLE ke_toan.de_nghi_thanh_toan FROM PUBLIC;
REVOKE ALL ON TABLE ke_toan.lich_su_de_nghi FROM PUBLIC;
REVOKE ALL ON TABLE ke_toan.luong_nhan_su FROM PUBLIC;
REVOKE ALL ON TABLE ke_toan.chi_phi_noi_bo FROM PUBLIC;
