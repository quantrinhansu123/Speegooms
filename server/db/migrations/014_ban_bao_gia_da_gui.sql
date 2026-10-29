-- Bản báo giá đã gửi cho Sale. Sửa đơn hàng sau đó không đổi bản này.
-- Lần gửi sau ghi đè, Sale chỉ xem một bản.

ALTER TABLE crm.bao_gia_sourcing_viet_nam
  ADD COLUMN IF NOT EXISTS ban_da_gui jsonb;
ALTER TABLE crm.bao_gia_sourcing_global
  ADD COLUMN IF NOT EXISTS ban_da_gui jsonb;
ALTER TABLE crm.bao_gia_logistics_viet_nam
  ADD COLUMN IF NOT EXISTS ban_da_gui jsonb;
ALTER TABLE crm.bao_gia_logistics_global
  ADD COLUMN IF NOT EXISTS ban_da_gui jsonb;

COMMENT ON COLUMN crm.bao_gia_sourcing_viet_nam.ban_da_gui IS
  'Bản đã gửi cho Sale: một mẫu đơn hàng, ghi chú và tài khoản tại thời điểm gửi.';

-- Mẫu điền sẵn trước đây không phải dữ liệu người dùng nhập.
UPDATE crm.bao_gia_sourcing_viet_nam SET ghi_chu = '{}'::jsonb
WHERE ghi_chu = '{"totalLabel":"Tổng giá trị hàng hóa chưa bao gồm phí vận chuyển","weightNote":"Dự kiến số KG, có thể thay đổi theo thực tế","validityNote":"Báo giá có hiệu lực kể từ ngày báo giá (06/10 - 12/10)","deposit":"Đặt cọc 1 lần - 100% tiền hàng hóa"}'::jsonb;
UPDATE crm.bao_gia_sourcing_global SET ghi_chu = '{}'::jsonb
WHERE ghi_chu = '{"totalLabel":"Tổng giá trị hàng hóa chưa bao gồm phí vận chuyển","weightNote":"Dự kiến số KG, có thể thay đổi theo thực tế","validityNote":"Báo giá có hiệu lực kể từ ngày báo giá (06/10 - 12/10)","deposit":"Đặt cọc 1 lần - 100% tiền hàng hóa"}'::jsonb;
UPDATE crm.bao_gia_logistics_viet_nam SET ghi_chu = '{}'::jsonb
WHERE ghi_chu = '{"totalLabel":"Tổng giá trị hàng hóa chưa bao gồm phí vận chuyển","weightNote":"Dự kiến số KG, có thể thay đổi theo thực tế","validityNote":"Báo giá có hiệu lực kể từ ngày báo giá (06/10 - 12/10)","deposit":"Đặt cọc 1 lần - 100% tiền hàng hóa"}'::jsonb;
UPDATE crm.bao_gia_logistics_global SET ghi_chu = '{}'::jsonb
WHERE ghi_chu = '{"totalLabel":"Tổng giá trị hàng hóa chưa bao gồm phí vận chuyển","weightNote":"Dự kiến số KG, có thể thay đổi theo thực tế","validityNote":"Báo giá có hiệu lực kể từ ngày báo giá (06/10 - 12/10)","deposit":"Đặt cọc 1 lần - 100% tiền hàng hóa"}'::jsonb;

UPDATE crm.bao_gia_sourcing_viet_nam SET tai_khoan_ngan_hang = '{}'::jsonb
WHERE tai_khoan_ngan_hang = '{"title":"Tài khoản ngân hàng ACH","accountName":"SPEEGO LOGISTICS LLC","accountNumber":"0370750653","routingNumber":"111900785"}'::jsonb;
UPDATE crm.bao_gia_sourcing_global SET tai_khoan_ngan_hang = '{}'::jsonb
WHERE tai_khoan_ngan_hang = '{"title":"Tài khoản ngân hàng ACH","accountName":"SPEEGO LOGISTICS LLC","accountNumber":"0370750653","routingNumber":"111900785"}'::jsonb;
UPDATE crm.bao_gia_logistics_viet_nam SET tai_khoan_ngan_hang = '{}'::jsonb
WHERE tai_khoan_ngan_hang = '{"title":"Tài khoản ngân hàng ACH","accountName":"SPEEGO LOGISTICS LLC","accountNumber":"0370750653","routingNumber":"111900785"}'::jsonb;
UPDATE crm.bao_gia_logistics_global SET tai_khoan_ngan_hang = '{}'::jsonb
WHERE tai_khoan_ngan_hang = '{"title":"Tài khoản ngân hàng ACH","accountName":"SPEEGO LOGISTICS LLC","accountNumber":"0370750653","routingNumber":"111900785"}'::jsonb;
