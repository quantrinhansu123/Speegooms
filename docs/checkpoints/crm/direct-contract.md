# Tạo hợp đồng trực tiếp

- Ngày kiểm tra: 2026-11-18. Bàn giao lên main theo yêu cầu; chưa xác nhận deployment.
- Sale Việt Nam, Sale Global, trưởng nhóm Sale Global và Admin có nút **Tạo hợp đồng trực tiếp** trong danh sách Hợp đồng ở chế độ Sale.
- Form nhập khách hàng, sản phẩm, ngành hàng, số lượng, tuyến vận chuyển, loại tiền, giá trị sản phẩm, cước, thanh toán ban đầu và ngày ký. Ngoại tệ có tỷ giá VND tùy chọn. Sale lấy từ tài khoản đăng nhập.
- `POST /api/crm/contracts?lane=vn|global` dùng quyền `contract.create`, giới hạn Sale theo tuyến. Không tạo hoặc tra báo giá. Luồng chuyển hợp đồng từ báo giá giữ điều kiện hiện tại.
- Tổng hợp đồng được tính ở server bằng tiền sản phẩm cộng cước, làm tròn hai chữ số. Số tiền không âm, tối đa hai chữ số thập phân, tổng tối đa 1 tỷ theo giới hạn hợp đồng hiện có; thanh toán không vượt tổng.
- Hợp đồng lưu `ma_bao_gia = NULL`, bản thông tin gửi Vận hành và dòng thanh toán ban đầu trong cùng transaction. Dùng cấu trúc DB sẵn có, không cần migration. Danh sách và chi tiết hiển thị loại đơn **Trực tiếp** khi không gắn báo giá.
- Các màn hình Sale, Vận hành, Kế toán, cập nhật thanh toán và gửi sang Kế toán tiếp tục dùng hợp đồng theo ID. Không tra tỷ giá từ báo giá khi hợp đồng không có báo giá.

## Kiểm chứng

- 68/68 test qua: `direct-contract`, `contract-readiness`, `quote-workflow`, `contract-accounting-visibility`. Test mới đã thêm vào script test API.
- Typecheck frontend/backend, build API và `git diff --check` qua. Component form mới qua ESLint. Trang danh sách còn đúng 4 lỗi `react-hooks/set-state-in-effect` và 5 cảnh báo ảnh có sẵn từ HEAD, không phát sinh từ thay đổi này.
- Playwright với component thật và API giả lập: tạo trên cả hai tuyến, desktop/mobile, định dạng tiền, tỷ giá, chặn thanh toán vượt tổng, lỗi API rồi thử lại, mở chi tiết, làm mới danh sách và ẩn nút với Kế toán; không gọi API báo giá.
- PostgreSQL 17 tạm riêng trên máy: dựng migration 001–053 theo thứ tự của project, tạo thật trên cả hai tuyến không gắn báo giá, kiểm tra bản gửi Vận hành, thanh toán ban đầu, truy vấn ba chế độ, cập nhật thanh toán và chuyển sang Kế toán. Test tự dừng PostgreSQL; không ghi dữ liệu production.
- Tích hợp trên `d7f0fa1` từ remote main. Commit này cho phép dùng cân nhập theo dòng khi kiện thiếu kg/kiện; fixture test từ chối kiện chưa đủ thông tin được đặt rõ `weightKg = null` để tiếp tục kiểm tra trường hợp không có cân thay thế.
- Sau tích hợp: 68 test API liên quan và 12 test in báo giá qua; typecheck frontend/backend qua.

## Nguồn

- `shared/src/crm.ts`: `createDirectContractSchema`.
- `server/src/routes/crm.routes.ts`, `controllers/crm.controller.ts`, `services/crm.service.ts`, `adapters/postgres/crm.repository.ts`: API, quyền và lưu dữ liệu.
- `src/features/crm/live/direct-contract-create-dialog.tsx`, `contracts-live-view.tsx`: giao diện.
- `server/src/config/direct-contract.test.ts`: hồi quy API, quyền, số tiền và transaction.
