# Mục lục checkpoint

Tìm ngữ cảnh cũ theo chủ đề; chỉ mở ghi chú liên quan đến task hiện tại. Task không cần lịch sử thì đi thẳng tới code. Không đọc cả thư mục.

| Khi cần tìm | Checkpoint | Đối chiếu gần nhất |
|---|---|---|
| Sale tạo hợp đồng khi mới có giá Sourcing, chưa có giá Logistics; phí vận chuyển tạm tính 0 | [Điều kiện chuyển hợp đồng](crm/contract-readiness.md) | nguồn `6605e52`, đã kiểm chứng khi ghép `6c18440`, 2026-11-13; chưa xác nhận deployment |
| Sourcing tạo/sửa thông tin đơn hàng, nút thao tác luôn thấy trên laptop | [Sale → vận hành](crm/sale-operations-data-flow.md) | nền `83deddd`, `fix/quote-laptop-actions`, 2026-11-12 |
| Giá gốc nội bộ Sourcing/Logistics, quyền Kế toán, ẩn khỏi Sale và bản in | [Giá gốc báo giá](crm/quote-original-prices.md) | nguồn `e15f757` + main `41c68ec`, 2026-11-11 |
| Báo giá: ngắt trang không chừa khoảng trống lớn, lưu ý, Regions Wire/ACH, bản in/PDF/Excel, mẫu local | [Bố cục bản in báo giá](crm/quote-print-layout.md) | nguồn `ccd8758`, In/Tải PDF và nội dung dài đã kiểm chứng, 2026-11-13; chưa xác nhận deployment |
| Phân biệt loại đơn Logistics/Sourcing ở danh sách và chi tiết hợp đồng | [Loại đơn hợp đồng](crm/contract-source-type.md) | nền `f96af95`, nhánh `fix/contract-print-quote-id`, 2026-11-11; chưa triển khai |
| Sửa tên khách ở Mess/Khách tiềm năng, hợp đồng vẫn giữ tên cũ | [Tên khách trên hợp đồng](crm/contract-customer-name.md) | nguồn `979a1e6`, main `8765a1d`; 051 đã chạy production, sửa 4 tên và bật 2 trigger, 2026-11-13 |
| Thu chi: tìm/chọn đơn, tài khoản nhận, ngày giao dịch riêng, tổng ngoại tệ, import/mẫu/xuất Excel | [Thu chi ngoại tệ và Excel](accounting/ledger-currency.md) | main `9f985da`; migration 050 đã áp dụng, 13 test gồm Postgres qua, 2026-11-12; chưa xác nhận deploy |
| Gom đơn cùng khách/tên, Báo giá từ Khách tiềm năng, quyền Sourcing/Logistics, local Turbopack và DB local có dữ liệu test | [Thông báo yêu cầu báo giá](crm/quote-request-notifications.md) | Nguồn `28d936f`; DB local có 3 khách `TEST TIỀM NĂNG` chưa có báo giá, xác minh endpoint A/A/B, 2026-11-13; chưa push/deploy |
| Bàn giao Sale trong form chuyển Mess/sửa khách tiềm năng, người nhận xử lý và lịch sử | [Bàn giao CRM](crm/sale-handover.md) | nền `6c1ae66`, 2026-11-09 |
| Nút bộ lọc Cột hiển thị trên các bảng nhiều trường | [Chọn cột bảng](project/table-column-filters.md) | `ec47f7e` + column filters, 2026-11-09 |
| Data khách hàng: menu Việt Nam/Global, thông báo bàn giao, bộ lọc và số lượng Facebook/Telesale | [Bộ lọc Data lạnh](crm/data-lanh-filters.md) | nền `fd545d5` + phân nhóm/reset FB, 2026-11-10 |
| Data lạnh: tạo khách, import/tải Excel, chia vòng tròn, bàn giao Sale care, quyền xem | [Data lạnh](crm/data-lanh.md) | nguồn `e15f757` + main `41c68ec`, 2026-11-11 |
| Dữ liệu demo đã gỡ, trang chưa nối DB hiện trống | [Demo đã gỡ](project/demo-data-removed.md) | sau `5569cff`, 2026-11-09 |
| Admin-only System / Executive sections and route access | [Admin sections](project/admin-sections-access.md) | `b6f8562` + access restriction, 2026-11-09 |
| Desktop sidebar / horizontal navigation toggle | [Navigation layout](project/navigation-layout.md) | `4608443` + layout toggle, 2026-11-09 |
| Sourcing/Logistics roles, routes, and menu expansion | [Access checkpoint](operations/sourcing-and-logistics-access.md) | `ad44857` + menu fix, 2026-11-09 |
| Cấu trúc ghi chú, cách tìm context cũ, phạm vi chia sẻ | [Tổ chức checkpoint](project/context-notes.md) | `9b17d04` + quyết định 2026-11-08 |
| CRM: mess → khách tiềm năng; bỏ ô cân/kích thước trùng, chọn mã điện thoại mặc định VN +84, validation | [Chuyển đổi mess](crm/mess-conversion.md) | nền `e242d9a`, `feat/phone-country-dropdown`, 2026-11-13; chưa xác nhận deploy |

## Luồng dữ liệu báo giá

- Logistics báo thiếu tỷ giá VND dù đã nhập; bắt buộc tỷ giá ngoại tệ khi vận hành lưu/gửi ở Sourcing và Logistics: [Tỷ giá VND Logistics](crm/logistics-vnd-rate.md), nền `ace1733`, bổ sung trên `fix/required-quote-vnd-rates`, 2026-11-12.

- Sale nhập nhưng Sourcing/Logistics thiếu cân, sửa mess không đồng bộ báo giá/không thấy sản phẩm cũ, FCL, địa chỉ tùy chọn: [Sale → vận hành](crm/sale-operations-data-flow.md); bổ sung nhánh `fix/mess-product-sync` từ `6e9e885`, 2026-11-10; chưa triển khai bản đồng bộ mess.

## Cách tra cứu

- Kế toán: chọn nhân viên và tự điền Mã nhân sự, Họ tên, Phòng ban, Vị trí khi nhập lương: [Nhân viên bảng lương](accounting/payroll-employees.md), nền `c3d53d9`, nguồn `feat/payroll-employee-select`, giao vào `main`, 2026-11-12; chưa xác nhận deployment.

- Mỗi dòng là một chủ đề, không phải một phiên chat. Chỉ thêm thư mục nghiệp vụ khi có ghi chú thực tế.
- Khi chưa rõ tên chủ đề, tìm từ khóa bằng `rg -n "từ khóa" docs/checkpoints`; chỉ mở phần khớp.
- Nếu không có checkpoint phù hợp, tìm code theo task; không quét toàn repo để lấp chỗ trống.
- Ghi chú là ảnh chụp tại commit đã ghi. Kiểm tra code hiện tại ở các đường dẫn được dẫn trước khi dùng một quyết định cũ.
- Không đọc lại ghi chú đã có trong context của phiên nếu nội dung hoặc task chưa thay đổi.

[Cách ghi và cập nhật checkpoint](README.md) — chỉ đọc khi cần tạo hoặc cập nhật ghi chú.

[README dự án](../../README.md) — điểm bắt đầu cho setup và tài liệu hiện có.

- Bảo hiểm hàng thuần Logistics Có/Không, Logistics nhập giá dùng chung loại tiền/tỷ giá cước, Mess → báo giá và bản in: [Sale → vận hành](crm/sale-operations-data-flow.md#bảo-hiểm-hàng-thuần-logistics--2026-11-11), feature `dd08598`, merge main `f067e5c`, 2026-11-11; local main 3002/4002 đang chạy, chưa push/deploy.

## Báo giá Logistics và lợi nhuận

- Đơn vị cước theo mặt hàng, chi tiết giá gốc nội bộ, tài chính và markup theo dòng/tổng: [Cước và giá gốc Logistics](operations/logistics-freight-pricing.md), cước đã push `1652f86`; markup nguồn `feat/logistics-markup` từ `1652f86`, bàn giao `main` theo yêu cầu, 2026-11-12; chưa xác nhận deployment.
