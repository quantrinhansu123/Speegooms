-- Thu chi và đối soát, khớp màn Lịch sử thu chi và đối soát.
-- Chạy sau 030. Chưa gắn logic ứng dụng.
-- Khóa chính là id. Tên bảng và cột còn lại là tiếng Việt không dấu.

CREATE SCHEMA IF NOT EXISTS ke_toan;

DO $$ BEGIN
  CREATE TYPE ke_toan.loai_thu_chi AS ENUM ('THU', 'CHI');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ke_toan.khoan_muc_thu_chi AS ENUM (
    'COC_KHACH',
    'THU_KHACH',
    'CHI_XUONG',
    'CHI_VAN_CHUYEN',
    'CHI_KHAC'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE ke_toan.loai_thu_chi IS 'THU thu, CHI chi.';
COMMENT ON TYPE ke_toan.khoan_muc_thu_chi IS
  'COC_KHACH cọc khách, THU_KHACH thu thanh toán khách, CHI_XUONG chi xưởng, CHI_VAN_CHUYEN chi vận chuyển, CHI_KHAC chi khác.';

CREATE TABLE IF NOT EXISTS ke_toan.so_thu_chi (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngay            date NOT NULL,
  loai            ke_toan.loai_thu_chi NOT NULL,
  khoan_muc       ke_toan.khoan_muc_thu_chi NOT NULL,
  doi_tuong       text NOT NULL,
  ma_don_hang     text NOT NULL,
  so_tien         numeric(18,2) NOT NULL,
  ma_tham_chieu   text,
  da_doi_soat     boolean NOT NULL DEFAULT false,
  ma_de_nghi      uuid,
  tao_luc         timestamptz NOT NULL DEFAULT now(),
  cap_nhat_luc    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT so_thu_chi_doi_tuong_chk CHECK (btrim(doi_tuong) <> ''),
  CONSTRAINT so_thu_chi_don_chk CHECK (btrim(ma_don_hang) <> ''),
  CONSTRAINT so_thu_chi_so_tien_chk CHECK (so_tien > 0),
  CONSTRAINT so_thu_chi_loai_khoan_chk CHECK (
    (loai = 'THU' AND khoan_muc IN ('COC_KHACH', 'THU_KHACH'))
    OR (loai = 'CHI' AND khoan_muc IN ('CHI_XUONG', 'CHI_VAN_CHUYEN', 'CHI_KHAC'))
  ),
  CONSTRAINT so_thu_chi_thu_da_doi_soat_chk CHECK (
    khoan_muc NOT IN ('COC_KHACH', 'THU_KHACH') OR da_doi_soat
  ),
  CONSTRAINT so_thu_chi_de_nghi_chk CHECK (
    ma_de_nghi IS NULL OR loai = 'CHI'
  )
);

COMMENT ON TABLE ke_toan.so_thu_chi IS
  'Sổ thu chi. Một dòng là một dòng trên màn Lịch sử thu chi và đối soát.';
COMMENT ON COLUMN ke_toan.so_thu_chi.da_doi_soat IS
  'Cọc khách và thu khách luôn đã đối soát. Dòng chi đối soát khi khớp sao kê.';
COMMENT ON COLUMN ke_toan.so_thu_chi.ma_de_nghi IS
  'Đề nghị thanh toán nguồn của dòng chi. Có giá trị thì màn hình bật nút Đối soát.';
COMMENT ON COLUMN ke_toan.so_thu_chi.ma_tham_chieu IS
  'Số bill, mã ủy nhiệm chi hoặc mã chứng từ.';

CREATE INDEX IF NOT EXISTS so_thu_chi_ngay_idx
  ON ke_toan.so_thu_chi (ngay DESC);
CREATE INDEX IF NOT EXISTS so_thu_chi_loai_khoan_idx
  ON ke_toan.so_thu_chi (loai, khoan_muc);
CREATE INDEX IF NOT EXISTS so_thu_chi_chua_doi_soat_idx
  ON ke_toan.so_thu_chi (ngay DESC)
  WHERE NOT da_doi_soat;
CREATE INDEX IF NOT EXISTS so_thu_chi_don_idx
  ON ke_toan.so_thu_chi (ma_don_hang);
CREATE INDEX IF NOT EXISTS so_thu_chi_doi_tuong_idx
  ON ke_toan.so_thu_chi (doi_tuong);

CREATE TABLE IF NOT EXISTS ke_toan.sao_ke (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngay          date NOT NULL,
  loai          ke_toan.loai_thu_chi NOT NULL,
  so_tien       numeric(18,2) NOT NULL,
  doi_tuong     text NOT NULL,
  noi_dung      text,
  ma_don_hang   text,
  ma_de_nghi    uuid,
  tao_luc       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sao_ke_doi_tuong_chk CHECK (btrim(doi_tuong) <> ''),
  CONSTRAINT sao_ke_so_tien_chk CHECK (so_tien > 0),
  CONSTRAINT sao_ke_don_chk CHECK (ma_don_hang IS NULL OR btrim(ma_don_hang) <> '')
);

COMMENT ON TABLE ke_toan.sao_ke IS
  'Dòng sao kê demo. Cả ma_don_hang và ma_de_nghi trống thì là dòng chưa khớp.';
COMMENT ON COLUMN ke_toan.sao_ke.ma_don_hang IS 'Đơn hàng đã khớp, nếu có.';
COMMENT ON COLUMN ke_toan.sao_ke.ma_de_nghi IS 'Đề nghị thanh toán đã khớp, nếu có. Chưa có khóa ngoại.';

CREATE INDEX IF NOT EXISTS sao_ke_chua_khop_idx
  ON ke_toan.sao_ke (ngay DESC)
  WHERE ma_don_hang IS NULL AND ma_de_nghi IS NULL;

DROP TRIGGER IF EXISTS trg_so_thu_chi_cap_nhat ON ke_toan.so_thu_chi;
CREATE TRIGGER trg_so_thu_chi_cap_nhat
  BEFORE UPDATE ON ke_toan.so_thu_chi
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

REVOKE ALL ON TABLE ke_toan.so_thu_chi FROM PUBLIC;
REVOKE ALL ON TABLE ke_toan.sao_ke FROM PUBLIC;
