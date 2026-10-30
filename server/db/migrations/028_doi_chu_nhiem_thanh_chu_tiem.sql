-- Đổi nhãn mô tả PRINCIPAL: Chủ nhiệm → Chủ tiệm (giá trị enum giữ nguyên).
COMMENT ON TYPE crm.customer_type IS
  'Đối tượng: INDIVIDUAL cá nhân, PRINCIPAL chủ tiệm, ENTERPRISE doanh nghiệp.';
