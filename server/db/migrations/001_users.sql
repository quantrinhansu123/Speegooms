-- Schema dùng chung cho PostgreSQL và Supabase.
-- Chạy một lần trên database trước khi DB_PROVIDER=postgres hoặc supabase.

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL CHECK (
    role IN (
      'admin',
      'ban-gd',
      'marketing',
      'sale-vn',
      'sale-global',
      'van-hanh',
      'ke-toan',
      'hcns',
      'phap-che'
    )
  ),
  department text NOT NULL,
  title text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE users FROM PUBLIC;
REVOKE ALL ON TABLE sessions FROM PUBLIC;

-- Supabase tạo sẵn role anon/authenticated. Postgres thuần thì bỏ qua.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE users FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE sessions FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE users FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE sessions FROM authenticated';
  END IF;
END $$;
