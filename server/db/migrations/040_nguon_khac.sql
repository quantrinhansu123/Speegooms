-- Nguồn "Khác" (OTHER): khách Sale tạo tay ở màn Khách hàng tiềm năng, tách khỏi các kênh ADS/GG/OG/AF/REFERRAL/OUTBOUND
-- để sau này dễ tổng hợp. Idempotent. Giá trị mới chưa dùng được trong cùng giao dịch nên file này chỉ thêm giá trị enum.

ALTER TYPE crm.lead_source ADD VALUE IF NOT EXISTS 'OTHER';
