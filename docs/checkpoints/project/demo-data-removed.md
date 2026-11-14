# Dữ liệu demo đã gỡ khỏi app

**Phạm vi và từ khóa:** `src/mocks`, trang trống, Duyệt thanh toán, Công nợ, Quyết toán, HCNS, Pháp chế, Khiếu nại, Fulfillment, dashboard, "dữ liệu mẫu", tài khoản demo, login, Demo Guide.

**Đối chiếu:** 2026-11-09, thay đổi ngay sau `5569cff`. Đã kiểm chứng bằng trình duyệt và các bộ `pnpm check:*`.

## Quyết định

- Chủ dự án yêu cầu app chỉ hiển thị dữ liệu từ DB do người dùng nhập. Các seed demo của CRM demo, Vận hành, Fulfillment, Kế toán, Backoffice và dashboard đã đổi thành rỗng (các `loadSeed` / `createLocalRepository` / `dashboard.service.ts`). Khóa localStorage đã tăng phiên bản (`speego_crm_demo_v2`, `speego_ops_demo_v4`, `speego_fulfillment_demo_v2`, `speego_accounting_demo_v2`, `speego-backoffice-v2`) để trình duyệt bỏ bản cũ.
- **Các trang chưa nối DB sẽ luôn trống** cho tới khi xây phần nối DB: Duyệt thanh toán, Công nợ, Quyết toán, HCNS, Pháp chế, Khiếu nại, Fulfillment, Vận hành (ngoài hợp đồng), dashboard/COA/Reports. DB mới có tạo và xem đề nghị thanh toán; chưa có duyệt/chi, công nợ phải thu/trả, quyết toán.
- Công nợ và Quyết toán còn một công tắc `accountingUsesDemoContracts` (`src/config/accounting.ts`), đang `false`, để không liệt kê hợp đồng demo CRM.
- Các file `src/mocks/{crm,ops,fulfillment,data}` **vẫn còn** vì các bộ `pnpm check:*` đọc trực tiếp; app không nạp chúng. Dữ liệu kế toán gốc nằm ở `src/services/accounting/fixtures/` (các file `src/mocks/accounting` đã rỗng). `src/mocks/users.json` giữ lại cho các tham chiếu người dùng còn dùng trong app; từ 2026-11-14, login và Demo Guide không còn nạp danh sách này.
- DB không bị xóa gì. Nghiệp vụ kế toán (ngưỡng duyệt chi, chủ quyết toán) vẫn chưa được Ban GĐ chốt trong tài liệu.

## Ẩn tài khoản demo trên frontend — 2026-11-14

- **Đối chiếu:** nền `b32ff1f`, nhánh `fix/hide-demo-accounts`. Phạm vi kiểm chứng mới chỉ gồm thay đổi tài khoản demo dưới đây.
- Gỡ danh sách vai trò, email, mật khẩu và thao tác tự điền khỏi `/login`; gỡ bảng tài khoản và mật khẩu chung khỏi Demo Guide. Đăng nhập bằng thông tin được cấp, giữ nguyên validation, xử lý lỗi và API đăng nhập. Không xóa hoặc vô hiệu hóa tài khoản trong DB.
- **Nguồn:** `src/app/login/page.tsx` (`LoginPage`), `src/features/auth/login-form.tsx` (`LoginForm`), `src/features/auth/schema.ts`, `src/features/demo-guide/demo-guide.tsx` (`DemoGuide`).
- **Kiểm chứng:** `npm.cmd run build` pass cả TypeScript và 93 trang. Worktree dùng junction thư viện nên đặt `TURBOPACK_ROOT` về thư mục repo; build chạy ngoài sandbox để tải Google Fonts. Assert trên HTML production `/login` xác nhận không có email/mật khẩu demo và còn đủ email, password, remember, nút submit. Tìm kiếm các ký hiệu demo đã gỡ ở ba thư mục bị ảnh hưởng không còn kết quả.
- ESLint bốn file thay đổi: 0 lỗi; còn cảnh báo có sẵn về `window.location.assign()` trong `LoginForm`. Chưa kiểm thử đăng nhập với backend, quan sát trình duyệt hoặc xác nhận deployment production.

## Kiểm chứng và việc còn mở

- Quan sát được: 12 trang mở trên trình duyệt không lỗi và hiện 0/trống; Mess (67 dòng) và Data lạnh (887) vẫn đủ dữ liệu; `pnpm check:crm|ops|fulfillment|accounting|backoffice|metrics` đều pass; `tsc` và `eslint` trên phần thay đổi sạch.
- `pnpm check:reports` hỏng từ trước thay đổi này (thiếu module `src/lib/download`), chưa xử lý.
- Một số mô tả trên trang vẫn ghi "dữ liệu demo/mẫu".
