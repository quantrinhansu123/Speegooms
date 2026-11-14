# Bố cục danh sách theo mẫu Pancake

- Phạm vi: Mess, khách tiềm năng, yêu cầu báo giá, bàn báo giá và hợp đồng; bộ lọc dùng chung.
- Đối chiếu: 2026-11-14, nền main `80e21f9`, code `75d4e0e` trên `feat/crm-pancake-filters`, worktree `.worktrees/pancake-workspace`. Tiếp nối thay đổi chưa commit từ `feat/pancake-workspace`; mẫu ở `public/example.jpg` của checkout gốc.
- `src/features/crm/live/list-search-bar.tsx`: tab Tất cả – Sourcing – Logistic; chọn tab áp dụng ngay riêng trường phân nhóm, không áp dụng các trường nháp khác. Xóa lọc đưa về Tất cả.
- `src/components/shared/filter-panel.tsx`: bộ lọc chi tiết mặc định ẩn; icon bên phải mở/đóng với aria-expanded/aria-controls và nhãn truy cập. Đóng không xóa điều kiện đã áp dụng. Tìm kiếm và tab luôn hiện.
- Mess dùng demand SOURCING/SHIPPING (Logistic tương ứng SHIPPING). Hợp đồng lọc danh sách đã tải theo quoteDesk sourcing/logistics; bản ghi không có quoteDesk chỉ hiện ở Tất cả. Khách tiềm năng/báo giá tiếp tục dùng customerKind của API. Không thay quyền hay dữ liệu lưu.
- Phần tiếp nối có sidebar desktop chuyển đầy đủ tên/chỉ icon, menu con dạng dropdown khi thu gọn, giao diện bảng và header gọn; FilterPanel cũng được dùng bởi ListView và các trang kế toán dùng ListSearchBar.
- Kiểm chứng: `next typegen` và `tsc --noEmit --pretty false` đạt; `node --test src/features/crm/live/list-search-bar.test.mjs` đạt trên Edge headless (ẩn/mở/đóng, tab, áp dụng riêng từng trường, reset, ngày không hợp lệ). Lint component bộ lọc và test đạt. Lint các view còn lỗi hooks set-state-in-effect ở code có sẵn; chưa sửa ngoài phạm vi.
- Còn mở: chưa kiểm tra toàn bộ trang với dữ liệu thật hoặc so sánh ảnh toàn trang; bàn giao để merge/push main theo yêu cầu. Kiểm thử lại 2 browser tests và TypeScript đạt trên code `75d4e0e`; đã kiểm tra đăng nhập và SSR cùng nút sidebar ở Mess/Hợp đồng không có lỗi hydration sau khi làm mới cache local.
