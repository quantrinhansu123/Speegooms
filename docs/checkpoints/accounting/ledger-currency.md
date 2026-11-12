# Thu chi: đối tượng, chứng từ, ngoại tệ và tên khách

## Tìm đơn khi nhập thu chi (2026-11-12)

- **Đối chiếu:** nền `8592f2f`, nhánh `feat/ledger-order-search`; người dùng yêu cầu merge/push `main`.
- **Hành vi:** `EntryDialog` trong `src/features/accounting/live/ledger-live-view.tsx` dùng một ô Combobox của Base UI: vừa gõ tìm mã đơn/tên khách, vừa bấm mũi tên xổ danh sách; có nút bỏ chọn. Dùng `matchesQuery` (`src/lib/text.ts`) để bỏ qua dấu tiếng Việt, hoa thường và khoảng trắng đầu/cuối. Áp dụng cho nhập mới, sửa thu chi và nhập sao kê vì dùng chung form. Chỉ lựa chọn trong danh sách mới đổi mã đơn; Escape hủy từ khóa và khôi phục nhãn đơn đã chọn. Chọn đơn vẫn tự gợi ý tên khách khi thu và ô đối tượng trống, không ghi đè người nộp/nhận đã nhập. Giữ đơn cũ ngoài danh sách khi sửa.
- **Kiểm chứng:** Next typegen + TypeScript, ESLint file thay đổi và `git diff --check` qua. `node scripts/check-ledger-order-search.mjs` qua: Playwright Edge ở 390px với API giả lập, kiểm tra một ô combobox, mở dropdown, tìm tên không dấu/mã đơn, chọn bằng bàn phím, không có kết quả, Escape, bỏ chọn, tự điền người nộp và mã đơn gửi khi lưu; không ghi DB thật.
- **Giới hạn:** tìm trong danh sách API đã tải (500 đơn mới nhất theo giới hạn hiện có). Chưa build production hoặc xác nhận deployment. Regression script dùng cổng local 3317/4317 và Edge có sẵn.

- **Phạm vi:** `/ke-toan/thu-chi`, nhập/sửa thu chi, nhập sao kê, đối soát và tìm theo khách.
- **Đối chiếu:** 2026-11-11, nền `b11afdf`, thay đổi trên nhánh `fix/accounting-ledger-currency`.
- **Quyết định:** Đối tượng là người/đơn vị nộp hoặc nhận tiền; thu tự gợi ý tên khách khi chọn đơn nếu ô đang trống, vẫn được sửa. Mã giao dịch/số chứng từ tùy chọn, không nhập lại mã đơn.
- **Tiền:** `amount`/`so_tien` là nguyên tệ; `currency`, `exchangeRate` lưu theo giao dịch (1 ngoại tệ = số VND). Ngoại tệ bắt buộc tỷ giá dương, tối đa 6 số lẻ; VND tỷ giá 1. `amountVnd` là cột DB sinh tự động, ngoại tệ làm tròn đến đồng; VND cũ giữ nguyên. Tổng thu/chi dùng `amountVnd`. FE dùng số nguyên BigInt để tránh sai số tại mốc làm tròn.
- **Đối soát:** chung helper `ledgerMatchesStatement` cho FE/BE. Sao kê VND khớp `amountVnd` của thu chi; sao kê ngoại tệ phải cùng loại tiền và số nguyên tệ. Hai bên có mã đơn thì phải giống nhau; vẫn kiểm tra loại thu/chi, khóa giao dịch và chống dùng lại sao kê. Dòng đã đối soát không sửa/xóa.
- **Tên khách:** API JOIN hợp đồng theo mã đơn, danh sách và chi tiết hiện `mã đơn · tên khách`, tìm kiếm gồm tên khách. Không phụ thuộc danh sách chọn 500 đơn mới nhất; form sửa giữ được đơn cũ ngoài danh sách đó.
- **Nguồn:** `src/features/accounting/live/ledger-live-view.tsx`; `shared/src/ke-toan.ts`; `server/src/adapters/postgres/ledger.repository.ts`; migration `048_ledger_currency.sql`; runner `server/src/scripts/migrate.ts`.
- **Kiểm chứng:** FE/BE typecheck qua; 2 unit test `server/src/config/ledger-currency.test.ts` qua; integration `server/src/adapters/postgres/ledger.repository.test.ts` qua khi `LEDGER_DB_TEST=1` (Postgres, toàn bộ dữ liệu test rollback). Integration kiểm tra tạo/sửa/list, tên khách, đối soát sai ngoại tệ, khớp sao kê VND, khóa sửa/xóa, xóa dòng chưa đối soát. Migration 048 đã áp dụng riêng vào DB cấu hình local, dữ liệu cũ mặc định VND. HTTP `/login` 200 và `/api/health` 200.
- **Còn mở:** chưa thử tương tác trình duyệt có đăng nhập, chưa build production. Tỷ giá nhập tay; không tự tải tỷ giá ngân hàng. Các luồng đề nghị thanh toán khác không nằm trong thay đổi này. Local worktree dùng `next dev --webpack` vì dependency liên kết ra ngoài root khiến Turbopack không resolve được Next.

## Excel thu chi (2026-11-12)

- **Đối chiếu:** 2026-11-12, nguồn `6ca37d7` trên `feat/accounting-ledger-excel`, nền `a525553`; giao vào `main` theo yêu cầu.
- **Hành vi:** tải mẫu `.xlsx` có sheet hướng dẫn; xuất toàn bộ dòng khớp bộ lọc hiện tại. Import xem trước, báo lỗi theo dòng; tối đa 1.000 dòng/file, 10 MB. Ngày YYYY-MM-DD hoặc ô ngày Excel; số tiền/tỷ giá là số, không nhận công thức hoặc chuỗi phân tách hàng nghìn.
- **Nhập lại file xuất:** `Mã dòng` trống tạo mới; UUID có sẵn cập nhật qua API PATCH hiện có. Dòng không đổi bỏ qua (kể cả đã đối soát); thay đổi dòng đã đối soát vẫn bị backend từ chối. Không nhập `Thành tiền VND` hoặc trạng thái đối soát. Giữ nguyên tiền tệ và tỷ giá; dùng schema chung để kiểm tra trước khi gửi, backend kiểm tra lại.
- **Lưu từng dòng:** dùng POST/PATCH hiện có, không thêm endpoint hoặc sửa DB. Dòng thành công được bỏ khỏi danh sách chờ; lỗi lưu giữ lại để xử lý. Dừng khi lỗi kết nối, xác thực hoặc server; có thể đã lưu dù chưa nhận phản hồi nên phải kiểm tra sổ trước khi thử lại. Nhập lại dòng mới không có UUID từ file cũ có thể tạo trùng.
- **Quyền:** tài khoản được xem trang có thể xuất dữ liệu đã tải; chỉ `ledger.write` có nút import/tải mẫu. Không thay đổi quyền API.
- **Nguồn:** `src/features/accounting/live/ledger-excel.ts`, `ledger-excel-actions.tsx`, `ledger-excel.test.ts`, tích hợp ở `ledger-live-view.tsx`; `package.json` chạy regression Excel trong `check:accounting`.
- **Kiểm chứng:** 6 test Excel và accounting rules qua; typegen/TypeScript và lint các file thay đổi qua. Playwright trên Next dev với backend giả lập: tải mẫu, xuất theo bộ lọc, nhập lại file không đổi không ghi thêm, thêm/sửa, lỗi dòng đã đối soát, quyền chỉ xem, nút không bị cắt ở màn hình 390px. Dùng Turbopack với `TURBOPACK_ROOT` trỏ root repo để resolve dependency liên kết; webpack local không sinh đủ utility Tailwind do cấu hình loader hiện có.
- **Local:** frontend tại `localhost:3000` chạy từ worktree Excel; backend Postgres tại `127.0.0.1:4000` dùng cấu hình hiện có. `/login` và `/api/health` qua frontend đều trả 200. Backend cần quyền mạng ngoài sandbox (trong sandbox lỗi EACCES).
- **Còn mở:** chưa import ghi dữ liệu DB thật, chưa build production, chưa xác nhận deployment. Các kiểm chứng DB/migration trước đây ở trên không phải kiểm chứng import Excel.
