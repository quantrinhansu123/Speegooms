-- Gán Sale cho khách tiềm năng và hợp đồng cũ (nhập từ datalake) để báo cáo Sale tính đúng người.
-- Datalake ghi Sale bằng tên gọi ngắn (cột sale_chu, ví dụ "Trúc", "Quyên"), nên khớp theo thứ tự:
--   1. trùng đúng họ tên đầy đủ; 2. tên gọi trùng đúng một từ trong họ tên.
-- Chỉ điền khi xác định được ĐÚNG 1 tài khoản Sale trong tuyến, chỉ điền chỗ còn trống, chạy lại an toàn.
-- Bản ghi không xác định được vẫn để trống để gán tay.
CREATE OR REPLACE FUNCTION pg_temp.sale_by_name(nick text, roles text[]) RETURNS text
LANGUAGE sql STABLE AS $f$
  SELECT coalesce(
    (SELECT min(u.ma_nguoi_dung) FROM public.nguoi_dung u
      WHERE u.vai_tro = ANY(roles) AND lower(btrim(u.ho_ten)) = lower(btrim(nick))
      HAVING count(*) = 1),
    (SELECT min(u.ma_nguoi_dung) FROM public.nguoi_dung u
      WHERE u.vai_tro = ANY(roles) AND btrim(nick) <> ''
        AND lower(btrim(nick)) = ANY(string_to_array(regexp_replace(lower(btrim(u.ho_ten)), '\s+', ' ', 'g'), ' '))
      HAVING count(*) = 1)
  )
$f$;

DO $$
DECLARE
  lane record;
BEGIN
  FOR lane IN SELECT * FROM (VALUES
    ('viet_nam', 'vn', ARRAY['sale-vn']),
    ('global', 'global', ARRAY['sale-global', 'sale-global-lead'])
  ) AS t(suffix, tuyen, roles) LOOP
    -- 1. Khách tiềm năng có Mess: lấy người tạo Mess, nếu chưa có thì theo tên nhân viên bán trên Mess.
    EXECUTE format($sql$
      UPDATE crm.%1$I l
      SET nguoi_xu_ly_id = coalesce(m.nguoi_tao_id, pg_temp.sale_by_name(m.nhan_vien_ban, $1))
      FROM crm.%2$I m
      WHERE m.id = l.ma_tin_nhan
        AND l.nguoi_xu_ly_id IS NULL AND l.nguoi_tao_id IS NULL
        AND coalesce(m.nguoi_tao_id, pg_temp.sale_by_name(m.nhan_vien_ban, $1)) IS NOT NULL
    $sql$, 'khach_hang_tiem_nang_' || lane.suffix, 'tin_nhan_' || lane.suffix) USING lane.roles;

    -- 2. Hợp đồng không báo giá chưa có người tạo: theo tên nhân viên bán trên hợp đồng.
    EXECUTE $sql$
      UPDATE crm.hop_dong h
      SET nguoi_tao_id = pg_temp.sale_by_name(h.nhan_vien_ban, $1)
      WHERE h.tuyen = $2 AND h.ma_bao_gia IS NULL AND h.nguoi_tao_id IS NULL
        AND pg_temp.sale_by_name(h.nhan_vien_ban, $1) IS NOT NULL
    $sql$ USING lane.roles, lane.tuyen;

    -- 3. Khách tiềm năng chưa có Sale: lấy theo tên Sale trên hợp đồng của báo giá thuộc khách đó (chỉ khi các hợp đồng cùng một người).
    EXECUTE format($sql$
      UPDATE crm.%1$I l
      SET nguoi_xu_ly_id = owner.id
      FROM (
        SELECT q.lead_id, min(pg_temp.sale_by_name(h.nhan_vien_ban, $1)) AS id
        FROM (SELECT id, ma_khach_hang_tiem_nang AS lead_id FROM crm.%2$I
              UNION ALL SELECT id, ma_khach_hang_tiem_nang FROM crm.%3$I) q
        JOIN crm.hop_dong h ON h.ma_bao_gia = q.id AND h.tuyen = $2
        WHERE q.lead_id IS NOT NULL AND pg_temp.sale_by_name(h.nhan_vien_ban, $1) IS NOT NULL
        GROUP BY q.lead_id
        HAVING count(DISTINCT pg_temp.sale_by_name(h.nhan_vien_ban, $1)) = 1
      ) owner
      WHERE owner.lead_id = l.id AND l.nguoi_xu_ly_id IS NULL AND l.nguoi_tao_id IS NULL AND l.xoa_luc IS NULL
    $sql$, 'khach_hang_tiem_nang_' || lane.suffix, 'bao_gia_sourcing_' || lane.suffix, 'bao_gia_logistics_' || lane.suffix)
    USING lane.roles, lane.tuyen;
  END LOOP;
END $$;
