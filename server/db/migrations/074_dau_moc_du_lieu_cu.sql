-- Keep the original dates of the November 9 data-lake import for reconciliation.
DO $$
DECLARE
  lane text;
  desk text;
  tbl text;
  marker timestamptz := TIMESTAMPTZ '2026-10-31 12:00:00+07';
  batch_start timestamptz := TIMESTAMPTZ '2026-11-09 01:30:00+00';
  batch_end timestamptz := TIMESTAMPTZ '2026-11-09 02:00:00+00';
BEGIN
  FOREACH lane IN ARRAY ARRAY['viet_nam', 'global'] LOOP
    FOREACH tbl IN ARRAY ARRAY['tin_nhan_' || lane, 'khach_hang_tiem_nang_' || lane, 'bao_gia_sourcing_' || lane, 'bao_gia_logistics_' || lane] LOOP
      EXECUTE format('ALTER TABLE crm.%I ADD COLUMN IF NOT EXISTS du_lieu_nhap_cu jsonb', tbl);
    END LOOP;

    EXECUTE format($sql$
      UPDATE crm.%I SET du_lieu_nhap_cu = jsonb_build_object('source', 'DATA_LAKE', 'createdAt', tao_luc, 'receivedAt', nhan_luc),
        tao_luc = $1, nhan_luc = $1
      WHERE du_lieu_nhap_cu IS NULL AND tao_luc >= $2 AND tao_luc < $3
        AND ma_tham_chieu_ngoai ~ '^MS-S[0-9]+-[0-9]+-[0-9]+$'
    $sql$, 'tin_nhan_' || lane) USING marker, batch_start, batch_end;

    EXECUTE format($sql$
      UPDATE crm.%I SET du_lieu_nhap_cu = jsonb_build_object('source', 'DATA_LAKE', 'createdAt', tao_luc),
        tao_luc = $1
      WHERE du_lieu_nhap_cu IS NULL AND tao_luc >= $2 AND tao_luc < $3
        AND ma_ngoai ~ '^RQ-[SM][0-9]+-[0-9]+-[0-9]+$'
    $sql$, 'khach_hang_tiem_nang_' || lane) USING marker, batch_start, batch_end;

    FOREACH desk IN ARRAY ARRAY['sourcing', 'logistics'] LOOP
      EXECUTE format($sql$
        UPDATE crm.%I q SET du_lieu_nhap_cu = jsonb_build_object('source', 'DATA_LAKE', 'createdAt', q.tao_luc),
          tao_luc = $1
        FROM crm.%I p
        WHERE q.ma_khach_hang_tiem_nang = p.id AND p.du_lieu_nhap_cu->>'source' = 'DATA_LAKE'
          AND q.du_lieu_nhap_cu IS NULL
          AND q.tao_luc >= TIMESTAMPTZ '2026-11-09 00:00:00+07'
          AND q.tao_luc < TIMESTAMPTZ '2026-11-10 00:00:00+07'
      $sql$, 'bao_gia_' || desk || '_' || lane, 'khach_hang_tiem_nang_' || lane) USING marker;
    END LOOP;
  END LOOP;

  ALTER TABLE crm.hop_dong ADD COLUMN IF NOT EXISTS du_lieu_nhap_cu jsonb;
  UPDATE crm.hop_dong SET du_lieu_nhap_cu = jsonb_build_object('source', 'DATA_LAKE', 'createdAt', tao_luc, 'signedOn', ngay_ky),
    tao_luc = marker
  WHERE du_lieu_nhap_cu IS NULL
    AND tao_luc >= TIMESTAMPTZ '2026-11-09 08:46:48+00' AND tao_luc < TIMESTAMPTZ '2026-11-09 08:47:00+00'
    AND ma_hien_thi ~ '^HD-20261109-(00(0[1-9]|[12][0-9]|3[012789]|4[0-3]))$';
END $$;
