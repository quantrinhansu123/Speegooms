begin;
alter table public.nguoi_dung drop constraint if exists nguoi_dung_vai_tro_check;
alter table public.nguoi_dung add constraint nguoi_dung_vai_tro_check check (
 vai_tro in ('admin','ban-gd','marketing','marketing-lead','marketing-content','sale-vn','sale-global','sale-global-lead','sale-intern','van-hanh','sourcing','logistics','ke-toan','hcns','phap-che')
);
update public.nguoi_dung set vai_tro='marketing-content', phong_ban='Marketing', chuc_danh='Marketing Content'
 where lower(thu_dien_tu)='mkt04@speegocorp.com';
update public.nguoi_dung set vai_tro='marketing-lead', phong_ban='Marketing', chuc_danh='Leader Marketing'
 where lower(thu_dien_tu)='mkt02@speegocorp.com';
-- Chỉ ghép tên/email cũ khi xác định được duy nhất một tài khoản trong nhóm Marketing.
with matches as (
 select t.id, min(u.ma_nguoi_dung) as user_id, min(u.ho_ten) as name
 from app.marketing_tasks t join public.nguoi_dung u
 on lower(trim(t.data->>'assignee')) in (lower(trim(u.ho_ten)),lower(u.thu_dien_tu))
 where coalesce(t.data->>'assigneeId','')='' and u.vai_tro in ('admin','marketing','marketing-lead','marketing-content')
 group by t.id having count(*)=1
)
update app.marketing_tasks t set data=t.data || jsonb_build_object('assigneeId',m.user_id,'assignee',m.name), version=t.version+1
 from matches m where m.id=t.id;
create index if not exists marketing_task_assignee_idx on app.marketing_tasks ((data->>'assigneeId'));
commit;
