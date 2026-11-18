# Kiểm tra workbook Marketing cập nhật

Nguồn: `docs/resources/SpeeGo_Mau_giao_viec_Marketing_7.11.2026.xlsx`.

File gốc được giữ nguyên. Bản chỉnh sửa: `docs/resources/SpeeGo_Mau_giao_viec_Marketing_7.11.2026_Da_kiem_tra.xlsx` (tài nguyên cục bộ, không commit).

## Kết quả đối chiếu

| Vị trí trong file gốc | Công thức hiện tại | Đánh giá |
| --- | --- | --- |
| Ads!E2 — Số mess | `D2/C2` = 270/250 = 108% | Đúng: sản lượng càng cao càng tốt |
| Ads!H2 — CP/Mess TT | `F2/G2` = 140.000/130.000 = 107,69% | Đúng: chi phí càng thấp càng tốt |
| SEO!E2 — Hiển thị/click | `D2/C2` = 270/250 = 108% | Đúng nếu đây là một chỉ số được định nghĩa thống nhất |
| SEO!H2 — Từ khóa top 20 | `F2/G2` = 107,69% | Đảo chiều; cần `G2/F2` = 92,86% |
| SEO!K2 — AI Impressions | `I2/J2` = 107,69% | Đảo chiều; cần `J2/I2` = 92,86% |

Media/Content đang là mẫu trống, chưa có công việc để kiểm tra nghiệp vụ. Hai sheet này còn tiêu đề Ngày giao việc/Deadline; hệ thống vẫn hỗ trợ tiêu đề cũ.

Ads/SEO mới có số liệu KPI, chưa có ngày, người nhận, tên việc, kênh, tháng và số thứ tự. Thử nhập file gốc trả 0 việc và báo rõ sheet thiếu STT ads/STT seo. Cần chuẩn hóa thành mẫu công việc trước khi lưu lên hệ thống.

Các giá trị 140.000/130.000 cho Từ khóa top 20 và AI Impressions được giữ nguyên khi chuyển mẫu, nhưng cần người lập xác nhận đây là chỉ tiêu thật hay dữ liệu sao chép minh họa. Từ khóa dùng đơn vị từ khóa; AI Impressions dùng lượt hiển thị, không dùng định dạng tiền. “Lượt hiển thị và click tìm kiếm” hiện là một KPI đúng theo tên file; nếu cần theo dõi hai số độc lập, tạo hai loại riêng trong Cài đặt.

## Bản chỉnh sửa

- Bốn sheet Media/Content/Ads/SEO cùng cấu trúc giao việc: ngày bắt đầu/kết thúc, tên việc, người nhận, kênh, trạng thái và nghiệm thu.
- Giữ số liệu Ads/SEO từ file gốc, sửa chiều tỷ lệ SEO và bảo vệ phép chia 0.
- Ô vàng ở các dòng Ads/SEO: tháng kế hoạch, tài khoản nhận, Từ ngày và Đến ngày. **Phải điền trước khi import.** Kênh Khác và tên KPI Ads/KPI SEO là giá trị chuẩn hóa tạm, cần đổi theo công việc thực tế.
- Công thức cần Excel tính lại khi mở file; cấu hình fullCalcOnLoad đã bật. Hệ thống tự tính số giao/nghiệm thu và kiểm tra chỉ tiêu, không tin số công thức trong workbook.
- Danh mục, dropdown và hướng dẫn hỗ trợ đủ bốn nhóm. File gốc không bị ghi đè.

## Kiểm tra hệ thống

`pnpm check:marketing` kiểm tra mẫu giao việc/báo cáo, import, khoảng ngày và quyền sửa KPI.

Kiểm tra SQL thật với PostgreSQL demo đã migrate và có tài khoản Admin:

```powershell
$env:MARKETING_TEST_DATABASE_URL = 'postgresql://postgres@127.0.0.1:55443/speego_local'
pnpm --filter @speego/server exec tsx --test src/controllers/marketing.integration.test.ts
```

Kiểm thử chỉ chấp nhận database loopback tên speego_local; tạo rồi dọn dữ liệu kiểm thử riêng, không thay đổi cấu hình KPI. Kiểm tra bao gồm hai biên ngày, công việc giao nhiều tháng, Ads/SEO, tổng hợp KPI tối thiểu/tối đa, loại việc Hủy, chi tiết theo loại và cập nhật báo cáo mới nhất.
