-- Mục tiêu Marketing dùng đúng loại KPI giao việc (mã là uuid trong app.marketing_kpi_settings), nên nới điều kiện mã chỉ tiêu.
alter table app.kpi_targets drop constraint if exists kpi_targets_code_check;
alter table app.kpi_targets add constraint kpi_targets_code_check check (code ~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$');
