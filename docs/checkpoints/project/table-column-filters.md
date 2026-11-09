# Nút Cột hiển thị cho bảng nhiều cột

- Phạm vi/từ khóa: chọn cột, ẩn/hiện cột, bảng nhiều trường, `Table`, `TableHScroll`.
- Đối chiếu: 2026-11-09, thay đổi trên nhánh `feat/data-lanh-status-filter`, nền `ec47f7e`; nguồn và kiểm chứng ở các đường dẫn bên dưới.
- Yêu cầu: một nút nhỏ kiểu bộ lọc; bấm mở menu checkbox, mặc định chọn tất cả các cột. Áp dụng trên các trang có bảng nhiều cột, không chỉ Data lạnh.
- `src/components/ui/filterable-table.tsx` dùng chung cho `Table` và bảng HTML trực tiếp trong `TableHScroll`. Hiện nút với bảng có từ 6 cột, một hàng tiêu đề và không gộp ô tiêu đề. Bảng FCL và so sánh báo giá nhà cung cấp cũng dùng `Table`; các bảng nhỏ và mẫu in riêng giữ nguyên.
- Lựa chọn chỉ thuộc từng bảng đang mở, không lưu vào database/localStorage. Đổi trang dữ liệu giữ lựa chọn; rời trang/tải lại mặc định chọn tất cả. Giữ ít nhất một cột để còn đọc được bảng.
- Đọc danh sách cột từ tiêu đề thực tế theo quyền. Dùng `colgroup` với `visibility: collapse` để thu gọn cả những bảng có dòng rỗng colspan. CSS ẩn ô tương ứng khỏi truy cập bàn phím và cây accessibility; giữ nguyên các input trong DOM để không mất dữ liệu đang nhập.
- Nguồn: `src/components/ui/filterable-table.tsx`, `src/components/ui/table.tsx`, `src/features/crm/live/table-h-scroll.tsx`, `src/features/crm/live/fcl-quote-form.tsx`, `src/features/operations/components/sourcing-request-detail.tsx`.
- Kiểm chứng: `node scripts/check-table-columns.mjs` chạy Playwright trên Edge headless với hai khung bảng thật và dữ liệu giả: chọn mặc định, ẩn/hiện, không mất nội dung input, độc lập giữa bảng, dòng rỗng, đổi trang, đổi bộ cột và giới hạn một cột. Test bộ lọc trạng thái Data lạnh cũng qua. Chưa đi qua mọi trang có đăng nhập hoặc kiểm tra Firefox/Safari; chưa push/deploy.
- `pnpm.cmd exec tsc --noEmit`, ESLint các file code thay đổi và `git diff --check` qua. API chạy trong sandbox từng bị chặn database (`EACCES`). Sau khi chính sách cho phép và duyệt chạy `pnpm.cmd dev:api` ngoài sandbox, FE 3000/BE 4000 hoạt động: `/api/security/csrf` qua frontend trả 200 có token và `/api/health` trả 200 (2026-11-09). Chưa kiểm tra đăng nhập và dữ liệu thật từng trang.
