# Data lạnh (Sale Việt Nam)

**Phạm vi và từ khóa:** trang `/sale-viet-nam/data-lanh`, chia vòng tròn, bàn giao Sale care, thông báo chuông, quyền xem, `crm.data_lanh`.

**Đối chiếu:** 2026-11-09, `5569cff` + thay đổi xóa dữ liệu demo cùng ngày. Đã kiểm chứng bằng API và trình duyệt trên DB thật (xem cuối ghi chú).

## Quyết định

- Khách lấy từ sheet "Data khach hang - Da loc trung" của file Excel nguồn (887 dòng). Nạp bằng `server/src/scripts/seed-data-lanh.ts`; chạy lại không trùng vì khóa là `stt`.
- **Quyền xem:** Admin và Ban GĐ thấy tất cả. Mọi vai trò khác chỉ thấy khách có `intern_id` hoặc `sale_care_id` là mình (`DataLanhController.scope`). Sale VN không còn xem toàn bộ.
- **Chỉ Admin** chia vòng tròn, thêm khách, xóa (`datalanh.assign`, `datalanh.delete` trong `server/src/config/permissions.ts`). Ban GĐ chỉ xem.
- **Người nhận chia vòng tròn** nằm ở bảng `crm.data_lanh_nguoi_nhan` (thứ tự = `thu_tu`), không suy từ vai trò. Đổi bằng `server/src/scripts/set-data-lanh-pool.ts` (`--redistribute` chia lại từ đầu; từ chối nếu đã có trạng thái hoặc bàn giao, trừ khi `--force`). Hiện 6 người: Diệu Linh, Thiên Nhi, Thùy Linh, Mỹ Trâm, Trúc Ly, Như Loan (148/148/148/148/148/147).
- Chia tiếp nối từ người kế sau người được giao gần nhất (`assignRoundRobin`); chỉ chia dòng chưa giao.
- **Bàn giao Sale care:** chọn Sale trong cột "Bàn giao Sale care" thì lưu ngay và gửi thông báo `datalanh.handover` tới Sale đó (`NotificationService.notifyDataLanhHandover`). Danh sách chọn là `sale-vn` và `sale-global`. Bàn giao lại đúng Sale cũ trả 409; chưa có thao tác bỏ bàn giao.
- Trạng thái chăm Facebook và Telesale dùng đúng danh mục sheet `DanhMuc_TrangThai` (`shared/src/data-lanh.ts`).
- Thêm khách chặn trùng SĐT (so sánh theo chữ số). STT mới = max + 1; hai người thêm cùng lúc có thể đụng UNIQUE.

## Đường dẫn

`server/src/adapters/postgres/data-lanh.repository.ts`, `server/src/controllers/data-lanh.controller.ts`, `server/src/routes/data-lanh.routes.ts`, `shared/src/data-lanh.ts`, `src/features/sales/data-lanh-view.tsx`, migration `044`, `045`, `046`.

## Kiểm chứng và việc còn mở

- Quan sát được (DB thật, tài khoản demo): chia 887 → 148/148/148/148/148/147; người không được giao thấy 0 khách; Sale Global được bàn giao thấy đúng 1 khách và sửa được; Sale VN bấm chia hoặc thêm khách nhận 403; chuông Sale có thông báo và bấm vào nhảy đúng trang, tô vàng dòng.
- Chưa kiểm tra bằng tài khoản thật của 6 người (không có mật khẩu).
- Chưa có: import Excel trên giao diện, bỏ bàn giao, lịch sử thay đổi, phân trang phía server (hiện tải tối đa 2000 dòng, phân trang ở client, 50 dòng/trang).
