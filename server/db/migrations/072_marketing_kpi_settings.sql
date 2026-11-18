begin;
create table if not exists app.marketing_kpi_settings (
 id boolean primary key default true check (id), version integer not null default 1,
 types jsonb not null default '[]'::jsonb, updated_by text, updated_at timestamptz not null default now()
);
insert into app.marketing_kpi_settings(id, types) values(true, '[
 {"id":"956415bc-a231-4a37-8f3a-1c8e04a7e001","kind":"media","name":"Sản phẩm Media","unit":"sản phẩm","direction":"at-least","defaultTarget":1,"active":true},
 {"id":"956415bc-a231-4a37-8f3a-1c8e04a7e002","kind":"content","name":"Bài nội dung","unit":"bài","direction":"at-least","defaultTarget":1,"active":true},
 {"id":"956415bc-a231-4a37-8f3a-1c8e04a7e003","kind":"ads","name":"KPI_1_A_MKT - Số mess","unit":"mess","direction":"at-least","defaultTarget":250,"active":true},
 {"id":"956415bc-a231-4a37-8f3a-1c8e04a7e004","kind":"ads","name":"KPI_2_A_MKT - CP/Mess TT","unit":"VND/mess","direction":"at-most","defaultTarget":140000,"active":true},
 {"id":"956415bc-a231-4a37-8f3a-1c8e04a7e005","kind":"seo","name":"KPI_1_S_MKT - Lượt hiển thị và click tìm kiếm","unit":"lượt","direction":"at-least","defaultTarget":250,"active":true},
 {"id":"956415bc-a231-4a37-8f3a-1c8e04a7e006","kind":"seo","name":"KPI_2_S_MKT - Từ khóa top 20","unit":"từ khóa","direction":"at-least","defaultTarget":1,"active":true},
 {"id":"956415bc-a231-4a37-8f3a-1c8e04a7e007","kind":"seo","name":"KPI_3_S_MKT - AI Impressions","unit":"lượt hiển thị","direction":"at-least","defaultTarget":1,"active":true}
]'::jsonb) on conflict do nothing;
commit;
