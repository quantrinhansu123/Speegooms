# Trưởng sale global

- **Phạm vi:** role `sale-global-lead`, menu và dữ liệu Sale Global, Mess, Data khách hàng, migration 053.
- **Đối chiếu:** 2026-11-14, nguồn `c03f151` trên `feat/global-sales-lead`, ghép main `dcf642e`; bàn giao lên main theo yêu cầu người dùng; chưa xác nhận deployment.

## Quyết định

- Role có nhãn Trưởng sale global, thuộc phòng Sale Global. Có các quyền nghiệp vụ của Sale Global; xem Mess của mọi người trong tuyến Global, khách tiềm năng, RFQ, hợp đồng và giá gốc như admin trong các trang Sale Global.
- API CRM, import và giao diện khóa tuyến Global. Không cấp quyền quản trị hệ thống, vận hành hay kế toán. Quyền sửa Mess vẫn kiểm tra người tạo; quyền xử lý CRM theo người phụ trách giữ nguyên.
- Data khách hàng hiện là một bảng chung, chưa có phân tuyến VN/Global. Role mới xem/xuất toàn bộ bảng chung như Admin/Ban GĐ; các thao tác tạo/chăm/bàn giao theo quyền Sale, chia vòng tròn và xóa vẫn chỉ Admin.
- Role mới xuất hiện trong danh sách Sale Global và danh sách nhận bàn giao. Link thông báo Data khách hàng mở đúng menu Global.
- Đã áp dụng migration 053 và tạo tài khoản theo yêu cầu trên Supabase PostgreSQL cấu hình ở `server/.env`; đọc lại bằng repository/schema mới và xác minh hash mật khẩu đúng, mật khẩu sai bị từ chối. Không chạy lại seed toàn bộ tài khoản. Website cần triển khai cả frontend/backend có role mới để sử dụng tài khoản.

## Nguồn

- Schema/type/menu: `shared/src/user.ts`, `src/types/role.ts`, `src/config/roles.ts`, `src/config/crm.ts`.
- API và phạm vi: `server/src/config/permissions.ts`, `server/src/controllers/crm.controller.ts`, `server/src/services/crm.service.ts`, `server/src/controllers/data-lanh.controller.ts`.
- DB: `server/db/migrations/053_sale_global_lead.sql`, `server/src/scripts/migrate.ts`; xem giá: `shared/src/quote-access.ts`.
- Kiểm tra hồi quy: `server/src/config/global-sales-lead.test.ts`, `src/components/layout/sidebar-nav.test.tsx`, `src/features/notifications/notification-menu.test.ts`.

## Kiểm chứng và giới hạn

- API typecheck và frontend `next typegen` + `tsc --noEmit` đạt.
- `pnpm test:api`: bản ghép main: 210 đạt, 6 bài tích hợp PostgreSQL bỏ qua vì không cấu hình DB test; thêm 1 bài Vercel entry đạt. API build đạt.
- Test menu và thông báo: 7 đạt, bao gồm toàn bộ trang Global, chặn tuyến VN/quản trị và link thông báo role mới.
- Chưa kiểm tra đăng nhập bằng trình duyệt hoặc chạy full frontend production build; chưa triển khai website. Kiểm tra mật khẩu trên DB không đồng nghĩa đã kiểm tra website đang chạy.

- **Ghép main 2026-11-14:** giữ transaction và `FOR UPDATE` trong bàn giao Data khách hàng của main, thêm role mới vào kiểm tra Sale nhận bàn giao. Giữ cả test người nhận mới của main và test role mới; trang tài khoản cá nhân và quản trị tài khoản của main được giữ nguyên.
