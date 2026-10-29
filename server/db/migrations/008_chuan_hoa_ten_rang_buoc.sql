-- Chuẩn hoá nốt các ràng buộc còn giữ tên tiếng Anh sau 007.
-- Idempotent: chỉ đổi khi tên cũ còn tồn tại.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_role_check' AND conrelid = 'public.nguoi_dung'::regclass
  ) THEN
    ALTER TABLE public.nguoi_dung RENAME CONSTRAINT users_role_check TO nguoi_dung_vai_tro_check;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'access_log_account_id_fkey' AND conrelid = 'authz.nhat_ky_truy_cap'::regclass
  ) THEN
    ALTER TABLE authz.nhat_ky_truy_cap RENAME CONSTRAINT access_log_account_id_fkey TO nhat_ky_truy_cap_tai_khoan_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'account_role_account_id_fkey' AND conrelid = 'authz.tai_khoan_vai_tro'::regclass
  ) THEN
    ALTER TABLE authz.tai_khoan_vai_tro RENAME CONSTRAINT account_role_account_id_fkey TO tai_khoan_vai_tro_tai_khoan_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'account_role_role_id_fkey' AND conrelid = 'authz.tai_khoan_vai_tro'::regclass
  ) THEN
    ALTER TABLE authz.tai_khoan_vai_tro RENAME CONSTRAINT account_role_role_id_fkey TO tai_khoan_vai_tro_vai_tro_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'role_permission_permission_id_fkey' AND conrelid = 'authz.vai_tro_quyen'::regclass
  ) THEN
    ALTER TABLE authz.vai_tro_quyen RENAME CONSTRAINT role_permission_permission_id_fkey TO vai_tro_quyen_quyen_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'role_permission_role_id_fkey' AND conrelid = 'authz.vai_tro_quyen'::regclass
  ) THEN
    ALTER TABLE authz.vai_tro_quyen RENAME CONSTRAINT role_permission_role_id_fkey TO vai_tro_quyen_vai_tro_fkey;
  END IF;

  IF to_regclass('app.lich_su_cap_nhat_cau_truc') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'schema_migrations_pkey'
         AND conrelid = 'app.lich_su_cap_nhat_cau_truc'::regclass
     ) THEN
    ALTER TABLE app.lich_su_cap_nhat_cau_truc
      RENAME CONSTRAINT schema_migrations_pkey TO lich_su_cap_nhat_cau_truc_pkey;
  END IF;
END $$;
