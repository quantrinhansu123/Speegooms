begin;
create table if not exists app.marketing_tasks (
 id uuid primary key, version integer not null default 1, data jsonb not null,
 updated_by text not null, updated_at timestamptz not null default now()
);
create table if not exists app.marketing_reports (
 platform text not null, channel text not null, post_id text not null, data jsonb not null,
 updated_by text not null, updated_at timestamptz not null default now(),
 primary key(platform, channel, post_id)
);
commit;
