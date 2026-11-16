# Báo giá Sourcing / Logistics — sửa lỗi ghép dữ liệu

16/11/2026 — Đã sửa code và kiểm thử; **chưa xác nhận triển khai production**, không sửa Supabase hoặc `.env`. Không cần migration.

## Đã sửa

- In/PDF/Excel dùng bản **đã gửi**, không ghép hàng đang sửa với cước cũ; xem trước bản đang sửa có nhãn **BẢN NHÁP**.
- Chặn xuất báo giá gộp khi thiếu bản đã gửi, đang chờ báo giá lại hoặc Sourcing/Logistics lệch hàng, số lượng, kiện.
- Logistics lấy hàng từ Sourcing đã gửi. Sourcing gửi lại với thông tin ảnh hưởng cước thay đổi thì Logistics phải báo lại.
- Xuất đủ lưu ý Logistics, gồm ghi chú khách thuê xe nâng nếu đã nhập.
- Hiện rõ số kiện, kích thước, **kg/kiện**, cân thực và cân tính cước. Cho lưu nháp thiếu số đo; chặn gửi khi kiện đã khai còn thiếu kích thước hoặc kg/kiện.
- Bỏ nhãn tổng là số tiền nhập tay, dùng nhãn mặc định để tránh hai số tổng mâu thuẫn.

## Lưu ý cho Sourcing

- Phân biệt số sản phẩm và số kiện: **100 sản phẩm, 10 kiện × 30 kg/kiện = 300 kg**; không nhập 300 vào ô kg/kiện.
- Kiểm tra mô tả gõ tay khớp ô đóng gói. Đổi hàng/số lượng/kiện thì gửi lại và phối hợp Logistics xác nhận cước mới.

## Lưu ý cho Logistics

- Đối chiếu hàng/kiện Sourcing đã gửi; kiểm tra và gửi lại cước khi nhận yêu cầu báo giá lại.
- Nhập thời gian giao khách, trách nhiệm bốc dỡ vào **Lưu ý khác** để lên bản xuất. “Ghi chú thêm cho Sale” là nội bộ.
- Nhập giá agent ở phần giá gốc; giữ giá vốn/lợi nhuận nội bộ. Phân biệt thời gian agent với thời gian cam kết khách.

## Đơn Steven John — BGS-20261112-0003

Đã kiểm chứng bằng dữ liệu thật, chỉ đọc: bản xuất sau sửa đúng **100/100, 2.150 kg, cước 4.515 + phụ phí 100 = 4.615 USD**, có ghi chú xe nâng.

Người phụ trách cần rà bản nháp 120/80, 30 kiện và mô tả Marble cũ “260 kg”; nhập thêm **40–45 ngày** vào Lưu ý khác. Giá agent 3.649 USD/lợi nhuận 966 USD là số liệu người dùng cung cấp, chưa tự điền vào DB. Chưa đủ lịch sử để kết luận ai nhập sai.
