# Dữ liệu demo đã gỡ khỏi app

**Phạm vi và từ khóa:** `src/mocks`, trang trống, Duyệt thanh toán, Công nợ, Quyết toán, HCNS, Pháp chế, Khiếu nại, Fulfillment, dashboard, "dữ liệu mẫu".

**Đối chiếu:** 2026-11-09, thay đổi ngay sau `5569cff`. Đã kiểm chứng bằng trình duyệt và các bộ `pnpm check:*`.

## Quyết định

- Chủ dự án yêu cầu app chỉ hiển thị dữ liệu từ DB do người dùng nhập. Các seed demo của CRM demo, Vận hành, Fulfillment, Kế toán, Backoffice và dashboard đã đổi thành rỗng (các `loadSeed` / `createLocalRepository` / `dashboard.service.ts`). Khóa localStorage đã tăng phiên bản (`speego_crm_demo_v2`, `speego_ops_demo_v4`, `speego_fulfillment_demo_v2`, `speego_accounting_demo_v2`, `speego-backoffice-v2`) để trình duyệt bỏ bản cũ.
- **Các trang chưa nối DB sẽ luôn trống** cho tới khi xây phần nối DB: Duyệt thanh toán, Công nợ, Quyết toán, HCNS, Pháp chế, Khiếu nại, Fulfillment, Vận hành (ngoài hợp đồng), dashboard/COA/Reports. DB mới có tạo và xem đề nghị thanh toán; chưa có duyệt/chi, công nợ phải thu/trả, quyết toán.
- Công nợ và Quyết toán còn một công tắc `accountingUsesDemoContracts` (`src/config/accounting.ts`), đang `false`, để không liệt kê hợp đồng demo CRM.
- Các file `src/mocks/{crm,ops,fulfillment,data}` **vẫn còn** vì các bộ `pnpm check:*` đọc trực tiếp; app không nạp chúng. Dữ liệu kế toán gốc nằm ở `src/services/accounting/fixtures/` (các file `src/mocks/accounting` đã rỗng). `src/mocks/users.json` giữ lại: là danh sách tài khoản demo đăng nhập.
- DB không bị xóa gì. Nghiệp vụ kế toán (ngưỡng duyệt chi, chủ quyết toán) vẫn chưa được Ban GĐ chốt trong tài liệu.

## Kiểm chứng và việc còn mở

- Quan sát được: 12 trang mở trên trình duyệt không lỗi và hiện 0/trống; Mess (67 dòng) và Data lạnh (887) vẫn đủ dữ liệu; `pnpm check:crm|ops|fulfillment|accounting|backoffice|metrics` đều pass; `tsc` và `eslint` trên phần thay đổi sạch.
- `pnpm check:reports` hỏng từ trước thay đổi này (thiếu module `src/lib/download`), chưa xử lý.
- Một số mô tả trên trang vẫn ghi "dữ liệu demo/mẫu".
