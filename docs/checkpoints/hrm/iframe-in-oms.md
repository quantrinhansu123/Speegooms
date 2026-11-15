# HRM nhúng trong OMS

**Phạm vi:** menu HCNS, iframe, HRM, chấm công, đăng nhập riêng.

**Đối chiếu:** 2026-11-15, nền main `619b6dc`, code `465e42e` trên `feat/hrm-embed`; bàn giao main local theo yêu cầu. Push đang bị chặn, chưa xác nhận deployment.

## Quyết định

- Một mục “Hành chính nhân sự” dẫn thẳng `/hcns`, nhúng cố định `https://hrmspeego.vercel.app/`; giữ giao diện OMS và có liên kết mở HRM ở tab riêng.
- Sáu route HCNS cũ (kể cả chi tiết nhân viên) chuyển về `/hcns`, không hiển thị các trang Backoffice mẫu. Bỏ layout `ModuleShell` của HCNS để HRM không phụ thuộc kho dữ liệu Backoffice local. `AppShell`/`RouteGate` và đăng nhập OMS vẫn áp dụng.
- Giữ quyền menu hiện tại: admin, ban-gd, hcns. HRM tự xác thực/phân quyền; chưa có SSO, đồng bộ dữ liệu hay đăng xuất liên thông.
- Iframe có tiêu đề truy cập và `allow="geolocation"` phục vụ chấm công; trình duyệt vẫn yêu cầu người dùng cấp vị trí. Không truyền tài khoản/token qua URL hoặc postMessage.
- Chỉ sửa OMS. Chưa thay đổi source, header hoặc bản triển khai HRM.

## Nguồn

- `src/config/navigation.ts`, `src/config/roles.ts`, `src/app/(app)/hcns/`, `src/components/layout/sidebar-nav.test.tsx`.

## Kiểm chứng và việc còn mở

- TypeScript `tsc --noEmit`, ESLint phần thay đổi, `git diff --check`: qua.
- Sáu test navigation chọn lọc qua, gồm ranh giới quyền HCNS. Test menu ngang thất bại do hai bản React trong thư viện junction; tái hiện cùng lỗi trên main `619b6dc` chưa sửa.
- Local: FE `http://127.0.0.1:3010`, API bộ nhớ riêng ở `4010`; đặt `TURBOPACK_ROOT` về repo gốc để giải quyết junction thư viện. Dữ liệu OMS thật không bị dùng/sửa. Tài khoản seed local của backend chỉ dùng xem trước.
- Self-check HTTP `.next/verify-hrm.mjs` (không commit): CSRF + login local, HTML `/hcns` có iframe/link/quyền vị trí, sáu redirect cũ qua. Người chưa đăng nhập được chuyển về login.
- Chưa xác nhận render HRM, phiên đăng nhập trong iframe, tải/in file hay vị trí thực tế trên trình duyệt. Computer Use dừng vì không xác định được URL cửa sổ Chrome; không dùng cách khác để điều khiển trình duyệt. Cần kiểm tra response headers HRM và chặn storage bên thứ ba khi xem thực tế.
- Bàn giao: GitHub connector xác nhận main remote vẫn ở `619b6dce548a9d428d3e32f05c7ded8bf4dda1e3`. Terminal `git fetch origin` không kết nối được github.com:443; connector `create_tree` bị GitHub trả 403 `Resource not accessible by integration`. Chưa ghi thay đổi lên GitHub. Cần push main từ môi trường có mạng và quyền ghi; không force push.
