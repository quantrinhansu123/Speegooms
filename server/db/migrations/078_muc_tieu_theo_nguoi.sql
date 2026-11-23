begin;

-- Mục tiêu giao theo từng người, theo tháng (ngày 1) hoặc tuần (Chủ nhật). Dùng chung Sale và Marketing.
create table if not exists app.kpi_targets (
  id uuid primary key default gen_random_uuid(),
  department text not null check (department in ('sale-vn', 'sale-global', 'marketing')),
  user_id text not null references public.nguoi_dung (ma_nguoi_dung) on delete cascade,
  period text not null check (period in ('month', 'week')),
  start_date date not null,
  code text not null check (code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  value numeric not null check (value >= 0 and value <= 1000000000000000),
  updated_by text,
  updated_at timestamptz not null default now(),
  unique (user_id, period, start_date, code)
);

create index if not exists kpi_targets_period_idx on app.kpi_targets (department, period, start_date);

commit;
