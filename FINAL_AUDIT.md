# SpeeGo FE demo final audit

Phạm vi: trải nghiệm FE demo và khả năng bàn giao tích hợp Backend. Không có kết nối dịch vụ ngoài,
không thay đổi ngưỡng/phê duyệt/SLA chưa được duyệt. Tham chiếu UI/UX: skill ui-ux-pro-max và
DESIGN_SYSTEM.md hiện có; giữ AppShell, token và component dùng chung.

## Module và yêu cầu đã thực hiện

| Phần | Trạng thái FE demo | Kết quả |
|---|---|---|
| Dashboard | Hoàn thành theo 9 vai trò | Admin/Ban GĐ, Marketing, Sale VN/Global, Vận hành, Kế toán, HCNS, Pháp chế có KPI và hàng đợi phù hợp |
| Quyền | Hoàn thành ở FE demo | Menu/route trong roles.ts, action trong permissions.ts, quyền loại report trong reports.ts; RouteGate dùng chung |
| CRM/Sales | Có UI và quy trình demo | Lead, hồ sơ, RFQ, báo giá, hợp đồng, cọc và bàn giao; giữ các cổng nghiệp vụ hiện có |
| Vận hành | Có UI và quy trình demo | Sourcing, NCC, PO, QC, đơn, lô, chứng từ |
| Fulfillment | Có UI và quy trình demo | Lập phiếu từ lô đã về, nhập kho, kiện/tồn, pick/pack, giao thất bại/giao lại, POD |
| Kế toán | Có UI và quy trình demo | Đối soát cọc, thu/chi, duyệt, công nợ, quyết toán; không giao dịch thật |
| Marketing | Có UI và số liệu demo | Ba nguồn lead, chiến dịch, chuyển đổi và phản hồi Sales |
| Khiếu nại | UI đề xuất có chú thích | Ticket, đơn liên quan, timeline, bằng chứng dạng mô tả và đền bù mô phỏng |
| HRM | UI đề xuất có chú thích | Nhân viên, cơ cấu, hồ sơ, tuyển dụng, onboarding, chấm công mock |
| Pháp chế | UI đề xuất có chú thích | Hồ sơ, yêu cầu ý kiến, trình duyệt và lịch sử |
| Reports | Hoàn thành 8 báo cáo | Lead conversion, Sales VN/Global, nguồn Marketing, đơn, lô, đúng hạn, công nợ, NCC |
| Tìm/lọc/sort/phân trang | Có trên các danh sách nghiệp vụ chính | Reports có date range; 11 danh sách CRM/Vận hành bổ sung bộ công cụ chung, giữ filter và Kanban; ListView có search, sort, date khi có mốc nghiệp vụ và pagination |
| CSV | Có cho Reports và 11 danh sách CRM/Vận hành | Export toàn bộ tập đã lọc/sort, không chỉ trang hiện tại; UTF-8 BOM, escape và chống spreadsheet formula injection |
| Demo Guide | Hoàn thành | `/demo-guide`: 9 tài khoản giả lập, quyền, kịch bản 10 bước, giới hạn và màn chưa triển khai |
| Hướng dẫn Backend | Hoàn thành tài liệu bàn giao | API_INTEGRATION_GUIDE.md: adapter, DTO/ID, quyền, endpoint đề xuất, lỗi, concurrency, tiền tệ, tệp và công thức report |

Dashboard/Reports đọc cùng store với màn nghiệp vụ, phản ánh thao tác trên cùng origin. Ngày demo
cố định 28/10/2026. Chỉ số theo kỳ và số dư/hàng đợi hiện tại được ghi rõ; báo cáo không giả làm
snapshot lịch sử. VND/USD không cộng chung; công nợ demo chỉ kiểm chứng cho VND.

## Sửa lỗi phát hiện trong audit

- Lô mới trước đây không lập được phiếu nhập từ UI. Bổ sung thao tác nhập tay số dự kiến/kho,
  chỉ cho lô đã về và chưa có phiếu; cách phân bổ nhiều lô được ghi là đề xuất.
- POD trước đây chọn lô đầu tiên của đơn. Nay đi theo package → receipt → shipment và chỉ cập nhật
  đúng lô đã giao hết kiện; có kiểm thử hai lô cùng đơn để tránh ghi nhầm.
- Quyền duyệt báo giá tại UI và store trước đây khác nhau. Cả hai nay đọc cùng action permission,
  giữ nguyên các role mà action demo đã cho phép.
- Đã bỏ các banner thông tin demo và nút reset seed khỏi giao diện theo yêu cầu; giữ cơ chế lưu dữ liệu và quyền nghiệp vụ.
- Thành công trên nền Success-soft trước đây có contrast 4,48:1. Chỉnh token lên 4,84:1 và cập nhật design system.
- Bổ sung liên kết aria-describedby/aria-invalid cho Field, vùng bảng cuộn bằng bàn phím,
  main focusable cho skip link, đóng menu mobile rõ ràng, dialog cuộn trên màn nhỏ và heading cấp 2
  cho danh sách con của dashboard/report.
- Sidebar tự mở nhóm đang active khi đổi route; gắn nhãn chưa triển khai cho màn giữ chỗ.
- Bổ sung ErrorState/thử lại và trạng thái lỗi tải ở store, giữ skeleton/empty/alert dùng chung.

## Kiểm chứng

- `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- `pnpm check`: CRM, Ops, Fulfillment, Accounting, Backoffice, metrics, Reports/CSV,
  kiểm thử xuyên store và contrast token.
- `check:flow` đi từ lead mới → Hot/profile → RFQ → sourcing → quotation → contract → cọc →
  nhận bàn giao → PO/QC → lô → phiếu nhập → pick/pack → giao thất bại/giao lại → POD → quyết toán.
  Có nhánh chặn thiếu profile, sai role, chưa cọc, thiếu bàn giao/QC, sai thứ tự mốc, thiếu POD,
  tách người duyệt/chi, thiếu điều kiện quyết toán và lỗi load/reset. Dữ liệu chạy trong bộ nhớ riêng.
- Reports kiểm tra scope tuyến/role, distinct lead, bỏ RFQ/hợp đồng hủy, ngày không hợp lệ,
  mẫu số trống, thiếu hạn giao và CSV có Unicode/dấu phẩy/quote/newline/công thức.
- Contrast kiểm tra 11 cặp màu chữ semantic trên nền đang dùng, tất cả ≥ 4,5:1.
- Kiểm tra trình duyệt production: dashboard 9 role; Marketing chỉ thấy loại report được cấp,
  chặn truy cập Kế toán; HCNS bị chặn Reports; search/sort/pagination/CSV report;
  kiểm tra mobile 375px, tablet 768px, desktop 1440px và menu bằng Enter/Escape.

Đây không phải chứng nhận WCAG hoặc E2E Backend. Chưa có kiểm thử screen reader thực,
Safari/iOS/Android vật lý, tải lớn, đa người dùng hoặc lỗi mạng với API thật.

## Các màn còn giữ chỗ

Các mục sau chưa có nghiệp vụ riêng và đã được gắn nhãn, liệt kê trong Demo Guide:

- `/coa` — COA, hệ thống/chỉ số chi tiết.
- `/khach-hang-dieu-phoi` — nhóm Khách hàng & Điều phối chưa phân bổ.
- `/sale-viet-nam`, `/sale-viet-nam/sales-mkt-intern` — trang nhóm phụ Sales VN.
- `/sale-global`, `/sale-global/sale-my` — trang nhóm phụ Sales Global.
- `/ke-toan/luong-chi-phi` — lương/chi phí nội bộ.
- `/cai-dat` — cài đặt quản trị.

Dashboard Sales theo role, CRM và report hiệu quả hai tuyến đã có; các trang nhóm phụ ở trên
không được coi là đã triển khai. Không tự bổ sung business rule cho những mục chưa chốt.

## Mức sẵn sàng Backend

**Sẵn sàng trình diễn và bắt đầu thống nhất contract/tích hợp từng module. Chưa sẵn sàng production.**

Model, màn hình, điểm thay repository, cấu hình quyền và bộ kiểm thử demo đã có. Cần Backend cung cấp
auth/session thật, quyền theo tenant/tuyến/bản ghi, validation, transaction/idempotency, audit log,
lưu tệp, pagination/filter server và aggregate report. Không gửi snapshot localStorage để cập nhật
toàn bộ dữ liệu server.

Các phần còn cần duyệt gồm ngưỡng báo giá/hợp đồng/chi, lead Hot/QC, SLA, đền bù, HRM, pháp chế,
attribution chiến dịch, định nghĩa đúng hạn/NCC, đa tiền tệ và xuất kho nhiều đợt/nhiều kho.
Demo hiện một phiếu/lô và một outbound/đơn; chưa tự chia số lượng của đơn nhiều lô.
Các cổng quyết toán hiện có được giữ nguyên, không tự thêm điều kiện chi phí thực tế.
