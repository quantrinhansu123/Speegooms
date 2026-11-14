# Quản lý tài khoản và đổi mật khẩu

- Phạm vi: Cài đặt admin, tạo/sửa/xóa tài khoản, mật khẩu cá nhân, quyền API.
- Đối chiếu: 2026-11-14, commit chức năng `4d910ed`, nền `47ebbc8`, nhánh `feat/admin-accounts`; chuẩn bị bàn giao vào `main` theo yêu cầu người dùng.

## Hành vi

- Trước đây chỉ có danh sách và gán vai trò, không có tạo tài khoản trên giao diện/API (seed vẫn có).
- Admin vào `/cai-dat` → Quản lý tài khoản để tạo (kèm mật khẩu ban đầu), sửa họ tên/email/vai trò/phòng ban/chức danh, hoặc xóa với xác nhận. Không cho tự xóa hay tự đổi vai trò. Mọi route `/api/users` yêu cầu quyền admin `user.role.assign`; route cũ `PATCH /:id/role` giữ tương thích.
- Menu cá nhân mở `/tai-khoan` cho mọi vai trò; `/cai-dat` và nhóm Hệ thống vẫn chỉ admin. Admin cũng có form đổi mật khẩu ở Cài đặt.
- Đổi mật khẩu yêu cầu mật khẩu hiện tại, mật khẩu mới 8–128 ký tự và xác nhận khớp ở FE. Hash bằng Scrypt, cập nhật có điều kiện theo hash cũ để tránh ghi đè khi đổi đồng thời. Thành công thu hồi các phiên của tài khoản, xóa cookie và tải lại trang đăng nhập. Không có reset mật khẩu qua email hay admin đặt lại mật khẩu trong phạm vi này.
- Mật khẩu phải giữ nguyên khoảng trắng/ký tự markup: middleware XSS chỉ giữ nguyên các trường mật khẩu trên các route credential tương ứng, các trường khác vẫn được lọc và schema vẫn kiểm tra dữ liệu.
- Email tạo/sửa được trim, chuẩn hóa chữ thường và chặn trùng bởi adapter/unique constraint. Không dùng upsert của seed cho CRUD để tránh tái tạo tài khoản đã bị xóa khi lưu form cũ.

## Dữ liệu khi xóa

- Đây là xóa thật, dùng FK hiện có, không có migration mới. `047_de_xuat.sql` xóa cascade đề xuất do tài khoản tạo; `049_de_xuat_gop_y.sql` xóa góp ý. Thông báo, phiên đăng nhập, cấu hình chia đơn và người nhận data lạnh cũng cascade; các FK CRM/data lạnh còn lại chuyển NULL. Hộp xác nhận phải nêu rõ hậu quả này.
- Không thay đổi FK hay tự chuyển người phụ trách nghiệp vụ. Cần xem lại trước khi muốn lưu trữ tài khoản hoặc bảo toàn đề xuất của nhân viên nghỉ việc.

## Đường dẫn

- `shared/src/admin.ts`, `shared/src/auth.ts`: schema và giới hạn.
- `server/src/services/user-admin.service.ts`, `auth.service.ts`; `server/src/routes/users.routes.ts`, `auth.routes.ts`; adapter `memory`, `postgres`, `supabase` trong `server/src/adapters`.
- `src/features/settings/account-management.tsx`, `settings-view.tsx`; `src/features/auth/change-password-form.tsx`, `login-form.tsx`; `src/app/(app)/tai-khoan/page.tsx`, `src/components/layout/user-menu.tsx`.

## Kiểm chứng và giới hạn

- `pnpm test:api` thành công ngoài sandbox sau khi esbuild bị sandbox chặn duyệt thư mục: 202 pass, 5 integration test bỏ qua khi chưa có DB; built Vercel entry thêm 1 pass. Gồm test CRUD, email trùng, dữ liệu sai, chặn non-admin/tự xóa/tự đổi vai trò, mật khẩu chứa markup/khoảng trắng, đổi mật khẩu và thu hồi nhiều phiên.
- `tsc --noEmit -p server/tsconfig.json`, `next typegen` + `tsc --noEmit --incremental false` thành công; 5 test navigation/sidebar pass; ESLint phần thay đổi không có lỗi (còn warning điều hướng đăng nhập toàn trang vốn có).
- Playwright với API memory riêng: tạo/sửa/xóa qua dialog, menu đổi mật khẩu, lỗi xác nhận không khớp, đổi thành công và đăng nhập bằng mật khẩu mới. Đã chụp desktop/mobile và kiểm tra trang mật khẩu 390px không tràn ngang; ảnh/script thử nằm trong `.next/` bị Git bỏ qua.
- Cài dependencies riêng cho cả frontend/server của worktree để tránh lỗi shim tsx và hai bản React khi dùng junction tới node_modules của checkout khác; không đổi dependencies hoặc lockfile của dự án.
- Chưa kiểm chứng CRUD trực tiếp trên Postgres/Supabase hoặc chạy full production frontend build; preview dùng fallback font vì Google Fonts không truy cập được. Thu hồi session và cập nhật hash là hai thao tác riêng; nếu DB lỗi giữa hai bước có thể đã đổi mật khẩu dù API báo lỗi, cần dùng mật khẩu mới để đăng nhập lại.
