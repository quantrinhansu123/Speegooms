-- Run only on a disposable database with migrations 001-029 already applied.
\set ON_ERROR_STOP on
DO $$
DECLARE lane text;
DECLARE existing_id uuid;
BEGIN
  FOREACH lane IN ARRAY ARRAY['viet_nam', 'global'] LOOP
    EXECUTE format('INSERT INTO crm.khach_hang_tiem_nang_%I (nguon, ho_ten, so_dien_thoai, nhom_khach, tiem_nang, quy_cach_dong_goi) VALUES (''ADS'', ''old sourcing'', ''0900000001'', ''SOURCING'', ''POTENTIAL'', ''Keep existing packaging'') RETURNING id', lane) INTO existing_id;
    EXECUTE format('INSERT INTO crm.bao_gia_sourcing_%I (ma_khach_hang_tiem_nang) VALUES ($1)', lane) USING existing_id;
    EXECUTE format('INSERT INTO crm.khach_hang_tiem_nang_%I (nguon, ho_ten, so_dien_thoai, nhom_khach, tiem_nang) VALUES (''ADS'', ''old logistics'', ''0900000002'', ''LOGISTICS'', ''POTENTIAL'') RETURNING id', lane) INTO existing_id;
    EXECUTE format('INSERT INTO crm.bao_gia_logistics_%I (ma_khach_hang_tiem_nang) VALUES ($1)', lane) USING existing_id;
    EXECUTE format('INSERT INTO crm.khach_hang_tiem_nang_%I (nguon, ho_ten, so_dien_thoai, nhom_khach, tiem_nang) VALUES (''ADS'', ''unquoted sourcing'', ''0900000003'', ''SOURCING'', ''POTENTIAL'')', lane);
  END LOOP;
END $$;

\ir ../migrations/030_luong_bao_gia_sourcing.sql

DO $$
DECLARE lane text;
DECLARE count_rows integer;
DECLARE workflow text;
DECLARE packaging text;
DECLARE customer_id uuid;
BEGIN
  FOREACH lane IN ARRAY ARRAY['viet_nam', 'global'] LOOP
    EXECUTE format('SELECT count(*) FROM crm.khach_hang_tiem_nang_%I WHERE luong_bao_gia = ''LEGACY''', lane) INTO count_rows;
    IF count_rows <> 2 THEN RAISE EXCEPTION 'Existing quotes lost legacy mode: %', lane; END IF;
    EXECUTE format('SELECT luong_bao_gia FROM crm.khach_hang_tiem_nang_%I WHERE ho_ten = ''unquoted sourcing''', lane) INTO workflow;
    IF workflow <> 'COMBINED' THEN RAISE EXCEPTION 'Unquoted customer did not receive new workflow: %', lane; END IF;
    EXECUTE format('SELECT quy_cach_dong_goi FROM crm.khach_hang_tiem_nang_%I WHERE ho_ten = ''old sourcing''', lane) INTO packaging;
    IF packaging <> 'Keep existing packaging' THEN RAISE EXCEPTION 'Packaging was changed: %', lane; END IF;
    EXECUTE format('INSERT INTO crm.khach_hang_tiem_nang_%I (nguon, ho_ten, so_dien_thoai, nhom_khach) VALUES (''ADS'', ''new sourcing'', ''0900000004'', ''SOURCING'') RETURNING luong_bao_gia', lane) INTO workflow;
    IF workflow <> 'COMBINED' THEN RAISE EXCEPTION 'New customer has wrong default: %', lane; END IF;
    EXECUTE format('DELETE FROM crm.bao_gia_sourcing_%I RETURNING ma_khach_hang_tiem_nang', lane) INTO customer_id;
    EXECUTE format('INSERT INTO crm.bao_gia_sourcing_%I (ma_khach_hang_tiem_nang) VALUES ($1)', lane) USING customer_id;
    EXECUTE format('SELECT luong_bao_gia FROM crm.khach_hang_tiem_nang_%I WHERE id = $1', lane) INTO workflow USING customer_id;
    IF workflow <> 'LEGACY' THEN RAISE EXCEPTION 'Recreating a quote changed the workflow: %', lane; END IF;
    BEGIN
      EXECUTE format('UPDATE crm.khach_hang_tiem_nang_%I SET nhom_khach = ''SOURCING_LOGISTICS'' WHERE id = $1', lane) USING customer_id;
      RAISE EXCEPTION 'Removed customer kind was accepted: %', lane;
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;
END $$;
