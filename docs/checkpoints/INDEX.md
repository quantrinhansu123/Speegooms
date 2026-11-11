# Mục lục checkpoint

Tìm ngữ cảnh cũ theo chủ đề; chỉ mở ghi chú liên quan đến task hiện tại. Task không cần lịch sử thì đi thẳng tới code. Không đọc cả thư mục.

| Khi cần tìm | Checkpoint | Đối chiếu gần nhất |
|---|---|---|
| Gán người báo giá, quyền Sourcing/Logistics, gửi Sourcing thiếu hiệu lực, thông báo Sale/tự bàn giao/chia Logistics, giữ tuyến sau reload, admin Logistics xem tất cả tuyến/phiếu | [Thông báo yêu cầu báo giá](crm/quote-request-notifications.md) | Nền `d0e405c`, `fix/sourcing-send-notifications`, 2026-11-11; UI chưa deploy, phiếu thật đã xử lý theo ủy quyền |
| Bàn giao Sale trong form chuyển Mess/sửa khách tiềm năng, người nhận xử lý và lịch sử | [Bàn giao CRM](crm/sale-handover.md) | nền `6c1ae66`, 2026-11-09 |
| Nút bộ lọc Cột hiển thị trên các bảng nhiều trường | [Chọn cột bảng](project/table-column-filters.md) | `ec47f7e` + column filters, 2026-11-09 |
| Data khách hàng: menu Việt Nam/Global, thông báo bàn giao, bộ lọc và số lượng Facebook/Telesale | [Bộ lọc Data lạnh](crm/data-lanh-filters.md) | nền `fd545d5` + phân nhóm/reset FB, 2026-11-10 |
| Data lạnh: chia vòng tròn, bàn giao Sale care, quyền xem | [Data lạnh](crm/data-lanh.md) | `5569cff` + xóa demo, 2026-11-09 |
| Dữ liệu demo đã gỡ, trang chưa nối DB hiện trống | [Demo đã gỡ](project/demo-data-removed.md) | sau `5569cff`, 2026-11-09 |
| Admin-only System / Executive sections and route access | [Admin sections](project/admin-sections-access.md) | `b6f8562` + access restriction, 2026-11-09 |
| Desktop sidebar / horizontal navigation toggle | [Navigation layout](project/navigation-layout.md) | `4608443` + layout toggle, 2026-11-09 |
| Sourcing/Logistics roles, routes, and menu expansion | [Access checkpoint](operations/sourcing-and-logistics-access.md) | `ad44857` + menu fix, 2026-11-09 |
| Cấu trúc ghi chú, cách tìm context cũ, phạm vi chia sẻ | [Tổ chức checkpoint](project/context-notes.md) | `9b17d04` + quyết định 2026-11-08 |
| CRM: mess → khách tiềm năng; Sourcing/Logistics; số lượng, thị trường, dữ liệu nháp, validation | [Chuyển đổi mess](crm/mess-conversion.md) | `8ea86e4`, 2026-11-08 |

## Luồng dữ liệu báo giá

- Sale nhập nhưng Sourcing/Logistics thiếu cân, sửa mess không đồng bộ báo giá/không thấy sản phẩm cũ, FCL, địa chỉ tùy chọn: [Sale → vận hành](crm/sale-operations-data-flow.md); bổ sung nhánh `fix/mess-product-sync` từ `6e9e885`, 2026-11-10; chưa triển khai bản đồng bộ mess.

## Cách tra cứu

- Mỗi dòng là một chủ đề, không phải một phiên chat. Chỉ thêm thư mục nghiệp vụ khi có ghi chú thực tế.
- Khi chưa rõ tên chủ đề, tìm từ khóa bằng `rg -n "từ khóa" docs/checkpoints`; chỉ mở phần khớp.
- Nếu không có checkpoint phù hợp, tìm code theo task; không quét toàn repo để lấp chỗ trống.
- Ghi chú là ảnh chụp tại commit đã ghi. Kiểm tra code hiện tại ở các đường dẫn được dẫn trước khi dùng một quyết định cũ.
- Không đọc lại ghi chú đã có trong context của phiên nếu nội dung hoặc task chưa thay đổi.

[Cách ghi và cập nhật checkpoint](README.md) — chỉ đọc khi cần tạo hoặc cập nhật ghi chú.

[README dự án](../../README.md) — điểm bắt đầu cho setup và tài liệu hiện có.

- Bảo hiểm hàng thuần Logistics Có/Không, giá trị hàng Sale khai báo, Mess → báo giá và bản in: [Sale → vận hành](crm/sale-operations-data-flow.md#bảo-hiểm-hàng-thuần-logistics--2026-11-11), nền `b11afdf`, nhánh `feat/logistics-insurance`, 2026-11-11; chưa deploy.
