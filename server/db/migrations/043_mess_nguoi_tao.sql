-- Mess ghi người tạo: người tạo chỉ xem mess của mình, Admin xem tất cả.
-- Idempotent.

ALTER TABLE crm.tin_nhan_viet_nam
  ADD COLUMN IF NOT EXISTS nguoi_tao_id text REFERENCES public.nguoi_dung (ma_nguoi_dung) ON DELETE SET NULL;

ALTER TABLE crm.tin_nhan_global
  ADD COLUMN IF NOT EXISTS nguoi_tao_id text REFERENCES public.nguoi_dung (ma_nguoi_dung) ON DELETE SET NULL;

COMMENT ON COLUMN crm.tin_nhan_viet_nam.nguoi_tao_id IS 'Người tạo mess; chỉ người này và Admin xem được.';
COMMENT ON COLUMN crm.tin_nhan_global.nguoi_tao_id IS 'Người tạo mess; chỉ người này và Admin xem được.';

-- Mess cũ: suy ra người tạo từ tên sale (lúc tạo, tên sale = tên người đăng nhập). Chỉ gán khi tên khớp đúng một người.
UPDATE crm.tin_nhan_viet_nam m
SET nguoi_tao_id = u.ma_nguoi_dung
FROM public.nguoi_dung u
WHERE m.nguoi_tao_id IS NULL
  AND lower(btrim(m.nhan_vien_ban)) = lower(btrim(u.ho_ten))
  AND (SELECT count(*) FROM public.nguoi_dung x WHERE lower(btrim(x.ho_ten)) = lower(btrim(u.ho_ten))) = 1;

UPDATE crm.tin_nhan_global m
SET nguoi_tao_id = u.ma_nguoi_dung
FROM public.nguoi_dung u
WHERE m.nguoi_tao_id IS NULL
  AND lower(btrim(m.nhan_vien_ban)) = lower(btrim(u.ho_ten))
  AND (SELECT count(*) FROM public.nguoi_dung x WHERE lower(btrim(x.ho_ten)) = lower(btrim(u.ho_ten))) = 1;
