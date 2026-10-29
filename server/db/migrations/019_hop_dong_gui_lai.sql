-- Mốc Sale gửi lại cho vận hành, và kế toán gửi lại cho sale cùng vận hành.

ALTER TABLE crm.hop_dong
  ADD COLUMN IF NOT EXISTS gui_van_hanh_luc timestamptz,
  ADD COLUMN IF NOT EXISTS gui_xac_nhan_luc timestamptz;

COMMENT ON COLUMN crm.hop_dong.gui_van_hanh_luc IS 'Thời điểm sale gửi lại hợp đồng cho vận hành.';
COMMENT ON COLUMN crm.hop_dong.gui_xac_nhan_luc IS 'Thời điểm kế toán gửi lại hợp đồng cho sale và vận hành.';
