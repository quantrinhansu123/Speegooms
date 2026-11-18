begin;

create table if not exists app.kpi_definitions (
  id uuid primary key default gen_random_uuid(),
  department text not null check (department in ('marketing', 'sale-vn', 'sale-global', 'van-hanh', 'ke-toan', 'hcns', 'phap-che')),
  team text not null check (length(btrim(team)) between 1 and 80),
  code text not null check (code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  name text not null check (length(btrim(name)) between 1 and 160),
  unit text not null check (length(btrim(unit)) between 1 and 40),
  target numeric check (target >= 0 and target <= 1000000000000000),
  period text not null default 'month' check (period in ('month', 'quarter', 'year')),
  active boolean not null default true,
  version integer not null default 1 check (version > 0),
  updated_by text,
  updated_at timestamptz not null default now(),
  unique (department, code)
);

insert into app.kpi_definitions (department, team, code, name, unit) values
  ('marketing', 'Content', 'KPI_1_C_MKT', 'Lượt xem', 'Lượt'),
  ('marketing', 'Content', 'KPI_2_C_MKT', 'Người xem', 'Người'),
  ('marketing', 'Media', 'KPI_1_M_MKT', 'Số Giây xem trung bình', 'Giây')
on conflict (department, code) do nothing;

commit;
