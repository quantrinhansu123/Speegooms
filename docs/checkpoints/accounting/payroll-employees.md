# Chọn nhân viên khi nhập lương

- **Phạm vi/từ khóa:** Kế toán → Lương & chi phí nội bộ, Nhập dòng lương, tự điền nhân sự.
- **Đối chiếu:** 2026-11-12, nền `c3d53d9`, nguồn thay đổi nhánh `feat/payroll-employee-select`, giao vào `main` theo yêu cầu; chưa xác nhận deployment.
- **Hành vi:** chọn nhân viên tự điền Mã nhân sự, Họ tên, Phòng ban, Vị trí. Các ô này chỉ đọc, lấy trực tiếp từ người đang chọn nên đổi/bỏ chọn không giữ thông tin người trước. Tiền lương, phụ cấp, bảo hiểm vẫn nhập theo kỳ. Không cho lưu khi chưa chọn; danh sách rỗng hoặc tải lỗi có thông báo.
- **Nguồn dữ liệu:** `public.nguoi_dung` (cùng nguồn với danh sách người nhận thanh toán), không dùng danh sách nhân sự mô phỏng. `ma_nguoi_dung`, `ho_ten`, `phong_ban`, `chuc_danh` tương ứng code/name/department/position. Không suy ra lương từ chức danh.
- **API/quyền:** `GET /api/ke-toan/payroll-employees` yêu cầu `payroll.write`, dùng lại controller/service/repository `listPaymentEmployees`. Truy vấn này bổ sung department/position vào dữ liệu trả về, nên `/payment-employees` cũng có thêm hai trường; caller thanh toán hiện chỉ đọc code/name.
- **Đường dẫn:** `src/features/accounting/live/payroll-live-view.tsx` (`CreatePayrollDialog`); `server/src/routes/ke-toan.routes.ts`; `server/src/adapters/postgres/ke-toan.repository.ts`; `server/src/repositories/ke-toan.repository.ts`.
- **Kiểm chứng:** frontend `next typegen` + `tsc --noEmit`, backend `tsc --noEmit -p server/tsconfig.json` đều qua; ESLint cho view và script qua; `tsx --test server/src/search/ke-toan-list-search.test.ts` qua 8/8. `node scripts/check-payroll-employees.mjs` qua trên Edge: chọn/đổi/bỏ chọn, payload lưu, danh sách rỗng, lỗi tải. Script bundle component và giả lập API, không kiểm tra CSS/layout.
- **Còn mở:** chưa thử với PostgreSQL thật hoặc deployment. Backend vẫn dùng schema/luồng tạo dòng lương hiện có; thay đổi này không sửa dữ liệu lương đã lưu.
