# Data lạnh (Sale Việt Nam)

**Phạm vi và từ khóa:** trang `/sale-viet-nam/data-lanh`, chia vòng tròn, bàn giao Sale care, thông báo chuông, quyền xem, `crm.data_lanh`.

**Đối chiếu:** cập nhật 2026-11-11, nguồn `e15f757`; thay đổi Data lạnh được giao cùng bản in/giá gốc và hợp nhất với main `41c68ec` trong commit chứa ghi chú này. Chưa xác nhận deployment. Kiểm chứng lịch sử ở cuối ghi chú.

## Quyết định

- Khách lấy từ sheet "Data khach hang - Da loc trung" của file Excel nguồn (887 dòng). Nạp bằng `server/src/scripts/seed-data-lanh.ts`; chạy lại không trùng vì khóa là `stt`.
- **Quyền xem:** Admin và Ban GĐ thấy tất cả. Mọi vai trò khác chỉ thấy khách có `intern_id` hoặc `sale_care_id` là mình (`DataLanhController.scope`). Sale VN không còn xem toàn bộ.
- **Tạo/import:** Admin, Sale VN và Sale Global có `datalanh.create`. Khách Sale tạo/import được gán `intern_id` từ tài khoản đang đăng nhập, không nhận người phụ trách từ file/body. Admin tạo/import để chưa giao. Intern và Ban GĐ không có quyền tạo/import. Chỉ Admin chia vòng tròn và xóa (`datalanh.assign`, `datalanh.delete`).
- **Người nhận chia vòng tròn** nằm ở bảng `crm.data_lanh_nguoi_nhan` (thứ tự = `thu_tu`), không suy từ vai trò. Đổi bằng `server/src/scripts/set-data-lanh-pool.ts` (`--redistribute` chia lại từ đầu; từ chối nếu đã có trạng thái hoặc bàn giao, trừ khi `--force`). Hiện 6 người: Diệu Linh, Thiên Nhi, Thùy Linh, Mỹ Trâm, Trúc Ly, Như Loan (148/148/148/148/148/147).
- Chia tiếp nối từ người kế sau người được giao gần nhất trong danh sách người nhận (`assignRoundRobin`); chỉ chia dòng chưa giao. Khách Sale tự tạo không làm lệch lượt chia.
- **Bàn giao Sale care:** chọn Sale trong cột "Bàn giao Sale care" thì lưu ngay và gửi thông báo `datalanh.handover` tới Sale đó (`NotificationService.notifyDataLanhHandover`). Danh sách chọn là `sale-vn` và `sale-global`. Bàn giao lại đúng Sale cũ trả 409; chưa có thao tác bỏ bàn giao.
- Trạng thái chăm Facebook và Telesale dùng đúng danh mục sheet `DanhMuc_TrangThai` (`shared/src/data-lanh.ts`).
- Tạo/import chặn trùng SĐT bằng chữ số. Transaction và cùng advisory lock bảo vệ kiểm tra trùng/cấp STT giữa các thao tác API đồng thời. Lỗi trùng không tiết lộ tên khách ngoài quyền xem.
- **Excel:** `/api/data-lanh/export` lấy toàn bộ khách trong quyền xem, không áp dụng bộ lọc giao diện hoặc giới hạn 2.000 dòng của màn hình; `?template=1` tải mẫu trống. Import `/api/data-lanh/import` nhận .xlsx tối đa 20MB/5.000 dòng, dùng cùng schema tạo khách, báo dòng lỗi (tối đa 50 chi tiết), bỏ SĐT trùng trong DB/file và dòng có Mã khách hàng. Chỉ thêm khách mới, không ghi đè trạng thái hoặc phân công của khách cũ. Dòng hợp lệ được ghi theo lô trong một transaction, lỗi DB hoàn tác cả lô. Giữ SĐT dạng Text để tránh mất số 0 khi soạn Excel.

## Đường dẫn

`server/src/adapters/postgres/data-lanh.repository.ts`, `server/src/controllers/data-lanh.controller.ts`, `server/src/routes/data-lanh.routes.ts`, `server/src/services/data-lanh-excel.ts`, `shared/src/data-lanh.ts`, `src/features/sales/data-lanh-view.tsx`, hook dùng chung `src/features/crm/live/excel-import.tsx`, migration `044`, `045`, `046` (không thêm migration).

## Kiểm chứng và việc còn mở

- Lịch sử 2026-11-09 (DB thật, tài khoản demo): chia 887 → 148/148/148/148/148/147; người không được giao thấy 0 khách; Sale Global được bàn giao thấy đúng 1 khách và sửa được; Sale VN bấm chia hoặc thêm khách nhận 403 (quyền thêm đã thay thế ở trên); chuông Sale có thông báo và bấm vào nhảy đúng trang, tô vàng dòng.
- 2026-11-11: `data-lanh-excel.test.ts` qua 10/10 khi đặt `DATA_LANH_TEST_URL` tới DB PostgreSQL 17 tạm `data_lanh_excel_test` trên localhost. Kiểm tra batch SQL thật: bỏ trùng DB/file, hoàn tác lỗi FK, scope, STT duy nhất khi tạo/import đồng thời, giữ lượt vòng tròn. Test tích hợp tự bỏ qua nếu không đặt URL test; từ chối URL ngoài localhost hoặc sai tên DB.
- Build API và toàn bộ bộ test khai báo trong `server/package.json` qua: 181 pass, 3 skip (test DB cần URL riêng), thêm Vercel entry 1/1 pass. Chạy trực tiếp các lệnh Node tương đương vì pnpm trong worktree muốn cài lại dependencies đang dùng chung. PostgreSQL tạm đã dừng sau kiểm tra.
- FE/BE typecheck, ESLint FE, `scripts/check-data-lanh-excel.mjs` và `scripts/check-table-columns.mjs` qua (có một lần bảng cột lỗi thời điểm mở menu, chạy lại qua; main cũng qua). Browser fixture kiểm tra tạo, validation, tải mẫu/Excel, import, báo lỗi/thử lại, quyền theo vai trò. Local FE cổng 3001/API 4001 dùng DB đã cấu hình; `/api/health` trả ok. Chưa thử ghi khách bằng tài khoản thật hoặc import file production.
- Chưa kiểm tra bằng tài khoản thật của 6 người (không có mật khẩu).
- Trước push trên kết quả hợp nhất `41c68ec` + `e15f757`: production build FE, typecheck FE/BE, API build, 185 test API pass/3 skip, Vercel entry 1/1 và browser fixture tạo/import/export/quyền Data lạnh qua.
- Chưa có: bỏ bàn giao, lịch sử thay đổi, phân trang phía server (hiện tải tối đa 2000 dòng, phân trang ở client, 50 dòng/trang). Khách không có SĐT và không có Mã khách hàng trong file không có khóa để chống import lặp.
