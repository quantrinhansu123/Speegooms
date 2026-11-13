-- Tên khách là thông tin hiện tại của hồ sơ; điều khoản thương mại đã gửi giữ nguyên.
CREATE OR REPLACE FUNCTION crm.fn_sync_contract_customer_name()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.xoa_luc IS NOT NULL OR nullif(btrim(NEW.ho_ten), '') IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE crm.hop_dong h
  SET ten_khach_hang = btrim(NEW.ho_ten)
  WHERE h.tuyen = TG_ARGV[0]
    AND h.ten_khach_hang IS DISTINCT FROM btrim(NEW.ho_ten)
    AND h.ma_bao_gia IN (
      SELECT id FROM crm.bao_gia_sourcing_viet_nam
      WHERE TG_ARGV[0] = 'vn' AND ma_khach_hang_tiem_nang = NEW.id
      UNION ALL
      SELECT id FROM crm.bao_gia_logistics_viet_nam
      WHERE TG_ARGV[0] = 'vn' AND ma_khach_hang_tiem_nang = NEW.id
      UNION ALL
      SELECT id FROM crm.bao_gia_sourcing_global
      WHERE TG_ARGV[0] = 'global' AND ma_khach_hang_tiem_nang = NEW.id
      UNION ALL
      SELECT id FROM crm.bao_gia_logistics_global
      WHERE TG_ARGV[0] = 'global' AND ma_khach_hang_tiem_nang = NEW.id
    );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS crm_contract_customer_name ON crm.khach_hang_tiem_nang_viet_nam;
CREATE TRIGGER crm_contract_customer_name
  AFTER UPDATE OF ho_ten ON crm.khach_hang_tiem_nang_viet_nam
  FOR EACH ROW WHEN (OLD.ho_ten IS DISTINCT FROM NEW.ho_ten)
  EXECUTE FUNCTION crm.fn_sync_contract_customer_name('vn');

DROP TRIGGER IF EXISTS crm_contract_customer_name ON crm.khach_hang_tiem_nang_global;
CREATE TRIGGER crm_contract_customer_name
  AFTER UPDATE OF ho_ten ON crm.khach_hang_tiem_nang_global
  FOR EACH ROW WHEN (OLD.ho_ten IS DISTINCT FROM NEW.ho_ten)
  EXECUTE FUNCTION crm.fn_sync_contract_customer_name('global');

-- Sửa cả các hợp đồng đã giữ tên cũ trước khi có đồng bộ; bỏ qua hồ sơ đã xóa/trống tên.
WITH current_names AS (
  SELECT 'vn' AS lane, q.id AS quote_id, btrim(p.ho_ten) AS name, p.xoa_luc AS deleted_at
  FROM crm.bao_gia_sourcing_viet_nam q
  JOIN crm.khach_hang_tiem_nang_viet_nam p ON p.id = q.ma_khach_hang_tiem_nang
  UNION ALL
  SELECT 'vn', q.id, btrim(p.ho_ten), p.xoa_luc
  FROM crm.bao_gia_logistics_viet_nam q
  JOIN crm.khach_hang_tiem_nang_viet_nam p ON p.id = q.ma_khach_hang_tiem_nang
  UNION ALL
  SELECT 'global', q.id, btrim(p.ho_ten), p.xoa_luc
  FROM crm.bao_gia_sourcing_global q
  JOIN crm.khach_hang_tiem_nang_global p ON p.id = q.ma_khach_hang_tiem_nang
  UNION ALL
  SELECT 'global', q.id, btrim(p.ho_ten), p.xoa_luc
  FROM crm.bao_gia_logistics_global q
  JOIN crm.khach_hang_tiem_nang_global p ON p.id = q.ma_khach_hang_tiem_nang
)
UPDATE crm.hop_dong h
SET ten_khach_hang = source.name
FROM current_names source
WHERE h.tuyen = source.lane AND h.ma_bao_gia = source.quote_id
  AND source.deleted_at IS NULL AND nullif(source.name, '') IS NOT NULL
  AND h.ten_khach_hang IS DISTINCT FROM source.name;
