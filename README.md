# SpeeGo Management Platform

Frontend demo quản trị logistics với Next.js 16, React 19, TypeScript và component dùng chung.
Dữ liệu lưu localStorage; không kết nối dịch vụ ngoài. Auth, phân quyền FE và phê duyệt chỉ là mô phỏng.

## Chạy ứng dụng

```bash
pnpm install
pnpm dev
```

Mở địa chỉ được Next.js in ra. Tại trang Đăng nhập, chọn vai trò demo; xem kịch bản và giới hạn tại `/demo-guide`.
Ngày tham chiếu của dữ liệu: 28/10/2026. Dữ liệu đã chỉnh sửa được giữ khi tải lại trang.

## Kiểm tra

```bash
pnpm lint
pnpm typecheck
pnpm check
pnpm build
pnpm start
```

`pnpm check` chạy kiểm thử rules CRM, Vận hành, Fulfillment, Kế toán, Backoffice, metrics, Reports/CSV,
kiểm thử xuyên store từ Lead đến Quyết toán và contrast token. Kiểm thử store dùng bộ nhớ riêng,
không sửa dữ liệu trình duyệt. Chưa thay thế E2E API hoặc kiểm thử đa người dùng.

## Màn hình và tài liệu

- Dashboard riêng theo 9 vai trò: `/dashboard`.
- CRM/Sales, Vận hành, Fulfillment, Kế toán, Marketing, Khiếu nại, HRM và Pháp chế dùng chung layout.
- Tám báo cáo có date filter, search, sorting, pagination và CSV theo quyền/tuyến: `/reports`.
- Tài khoản, quy trình trình diễn và các màn còn giữ chỗ: `/demo-guide`.
- [API Integration Guide](API_INTEGRATION_GUIDE.md): điểm thay adapter, DTO, scope, commands, lỗi, transaction và phần cần chốt.
- [Frontend Architecture](FRONTEND_ARCHITECTURE.md), [Design System](DESIGN_SYSTEM.md).
- [Báo cáo nghiệm thu FE demo](FINAL_AUDIT.md).

Chưa có Backend/auth production, upload tệp, hãng vận chuyển/ngân hàng thật hoặc nghiệp vụ HRM/đền bù đã duyệt.
Các trang COA, Khách hàng & Điều phối, nhóm phụ Sales, lương/chi phí và cài đặt vẫn được đánh dấu chưa triển khai.
