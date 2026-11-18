# Cấu hình KPI theo phòng ban

Mở **Cài đặt → Cấu hình KPI theo phòng ban** (`/cai-dat`).

- Admin và Ban Giám đốc quản lý KPI của các phòng ban.
- Leader Marketing chỉ xem và sửa KPI của P.MKT; API cũng kiểm tra phạm vi này.
- Các vai trò còn lại không truy cập được trang Cài đặt và API cấu hình KPI.

P.MKT có ba KPI mặc định:

| Bộ phận | Mã KPI | Chỉ số | Đơn vị |
| --- | --- | --- | --- |
| Content | KPI_1_C_MKT | Lượt xem | Lượt |
| Content | KPI_2_C_MKT | Người xem | Người |
| Media | KPI_1_M_MKT | Số Giây xem trung bình | Giây |

Chỉ tiêu mặc định để trống. Người quản lý chọn kỳ tháng/quý/năm và nhập mức giao khi cần; `0` khác với chưa đặt chỉ tiêu. Có thể tạm ngưng KPI bằng cách sửa trạng thái. Mã KPI không được trùng trong cùng phòng ban. Nếu người khác đã sửa bản ghi, cần đóng hộp thoại và tải lại danh sách trước khi sửa tiếp.

Để cấu hình Sale, đăng nhập Admin/Ban Giám đốc, chọn **Sale Việt Nam** hoặc **Sale Global**, rồi chọn **Thêm KPI**. Bộ phận, mã, tên và đơn vị nhập được theo nghiệp vụ Sale; dùng chung bảng `app.kpi_definitions` và API `/api/settings/kpis`.

Đây là danh mục chỉ số và chỉ tiêu theo kỳ. Phần tổng hợp kết quả từ công việc, báo cáo hoặc đơn hàng cần sử dụng danh mục này khi được triển khai; bản thay đổi này không bổ sung công thức tính kết quả Sale.

Chạy migration `071_department_kpis.sql` qua `pnpm --filter @speego/server migrate` trước khi dùng. Chạy `pnpm check:kpi` để kiểm tra quyền truy cập, dữ liệu đầu vào, mã trùng và xử lý xung đột phiên bản. Kiểm thử PostgreSQL tùy chọn dùng `KPI_TEST_DATABASE_URL` trỏ tới cơ sở dữ liệu local đã migrate; dữ liệu thử được rollback sau test.
