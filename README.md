# SpeeGo Management Platform

Ứng dụng quản trị logistics với Next.js 16, React 19, TypeScript và component dùng chung.
Đăng nhập và các màn CRM live dùng backend Express trong `server`; các màn demo còn lại dùng localStorage.

## Deploy FE lên Vercel

Tạo project FE riêng từ cùng repository với BE, chọn Root Directory `./`, preset **Next.js**,
Build Command `pnpm build`, giữ Install Command và Output Directory mặc định. Đặt env **Production** trước khi build:

```dotenv
API_URL=https://speegooms.vercel.app
ENABLE_EXPERIMENTAL_COREPACK=1
```

`API_URL` là origin BE, không kèm `/api`. FE rewrite `/api/*` tới BE; phần kiểm tra phiên phía server
gọi trực tiếp BE và chuyển tiếp cookie phiên. Thay đổi `API_URL` cần build/deploy lại FE.
Chỉ đặt URL và cấu hình công cụ trên FE; database, Cloudinary và các secret đặt trên BE.
Hướng dẫn deploy BE: [server/README.md](server/README.md).

Sau khi FE có tên miền, cập nhật `CORS_ORIGINS` trên BE theo origin FE rồi redeploy BE.
Kiểm tra `/api/health` qua tên miền FE, đăng nhập, tải lại trang, đăng xuất, ghi dữ liệu và upload ảnh.
Ở local, khi chưa đặt `API_URL`, rewrite dùng `http://127.0.0.1:4000`; chạy `pnpm dev:stack` để mở cả FE và BE.

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

Chưa có tích hợp hãng vận chuyển/ngân hàng thật hoặc nghiệp vụ HRM/đền bù đã duyệt.
Các trang COA, Khách hàng & Điều phối, nhóm phụ Sales, lương/chi phí và cài đặt vẫn được đánh dấu chưa triển khai.
