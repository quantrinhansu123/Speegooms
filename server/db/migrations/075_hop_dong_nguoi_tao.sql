ALTER TABLE crm.hop_dong
  ADD COLUMN IF NOT EXISTS nguoi_tao_id text REFERENCES public.nguoi_dung(ma_nguoi_dung) ON DELETE SET NULL;

-- Recover the authenticated creator of older direct contracts from creation notifications.
UPDATE crm.hop_dong h
SET nguoi_tao_id = history.creator_id
FROM (
  SELECT tuyen, tham_chieu_id, min(nguoi_gui_id) AS creator_id
  FROM app.thong_bao
  WHERE loai = 'contract.create' AND tham_chieu_loai = 'contract' AND nguoi_gui_id IS NOT NULL
  GROUP BY tuyen, tham_chieu_id
  HAVING count(DISTINCT nguoi_gui_id) = 1
) history
WHERE h.ma_bao_gia IS NULL AND h.nguoi_tao_id IS NULL
  AND history.tuyen = h.tuyen AND history.tham_chieu_id = h.id::text;
