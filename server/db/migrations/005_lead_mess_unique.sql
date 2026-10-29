-- Một mess đang sống chỉ tạo một lead.
CREATE UNIQUE INDEX IF NOT EXISTS lead_mess_id_uq
  ON crm.lead (mess_id)
  WHERE mess_id IS NOT NULL AND deleted_at IS NULL;
