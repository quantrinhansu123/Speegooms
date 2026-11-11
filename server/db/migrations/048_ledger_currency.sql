-- Existing rows remain VND; preserve the original amount and transaction rate.
ALTER TABLE ke_toan.so_thu_chi
  ADD COLUMN tien_te text NOT NULL DEFAULT 'VND' CHECK (tien_te ~ '^[A-Z]{3}$'),
  ADD COLUMN ty_gia numeric(18,6) NOT NULL DEFAULT 1 CHECK (ty_gia > 0 AND ty_gia <= 1000000),
  ADD CONSTRAINT so_thu_chi_vnd_rate_chk CHECK (tien_te <> 'VND' OR ty_gia = 1),
  ADD COLUMN so_tien_vnd numeric(18,2) GENERATED ALWAYS AS
    (CASE WHEN tien_te = 'VND' THEN so_tien ELSE round(so_tien * ty_gia, 0) END) STORED,
  ADD CONSTRAINT so_thu_chi_vnd_amount_chk CHECK (so_tien_vnd > 0 AND so_tien_vnd <= 9999999999999);
ALTER TABLE ke_toan.sao_ke
  ADD COLUMN tien_te text NOT NULL DEFAULT 'VND' CHECK (tien_te ~ '^[A-Z]{3}$'),
  ADD COLUMN ty_gia numeric(18,6) NOT NULL DEFAULT 1 CHECK (ty_gia > 0 AND ty_gia <= 1000000),
  ADD CONSTRAINT sao_ke_vnd_rate_chk CHECK (tien_te <> 'VND' OR ty_gia = 1),
  ADD COLUMN so_tien_vnd numeric(18,2) GENERATED ALWAYS AS
    (CASE WHEN tien_te = 'VND' THEN so_tien ELSE round(so_tien * ty_gia, 0) END) STORED,
  ADD CONSTRAINT sao_ke_vnd_amount_chk CHECK (so_tien_vnd > 0 AND so_tien_vnd <= 9999999999999);
