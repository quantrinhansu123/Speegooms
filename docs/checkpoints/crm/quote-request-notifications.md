# Thông báo yêu cầu báo giá từ khách tiềm năng

- Phạm vi: Sale bấm Báo giá tại Khách tiềm năng; tạo RFQ, người nhận thông báo và danh sách báo giá vận hành.
- Đối chiếu: 2026-11-10, nền `5dd894a`, nhánh `fix/rfq-send-request`; checkpoint được commit cùng các file thay đổi nêu dưới.

## Quyết định và nguồn

- `CrmService.requestQuote` gửi thông báo ngay khi repository tạo phiếu mới và có actor. Dùng `quoteAccessKind` để giữ phạm vi người nhận theo workflow LEGACY/COMBINED. Không tạo phiếu Logistics cho khách Sourcing kết hợp ở bước này.
- Mở lại phiếu (`created: false`) không gửi thêm thông báo. Không cần bấm Chuyển Sourcing/Logistics để nhận thông báo đầu tiên; các thao tác bàn giao rõ ràng hiện có vẫn dùng được và có thể gửi thông báo mới.
- Endpoint tạo phiếu được dùng chung bởi Khách tiềm năng, tạo RFQ và chuyển Mess; những nơi này đều nhận hành vi gửi thông báo lúc tạo mới. Import gọi thẳng repository nên không phát thông báo hàng loạt.
- Màn Khách tiềm năng hiện thông báo xác nhận sau khi API thành công. Danh sách vận hành dùng lại `usePolling` mỗi 30 giây, bên cạnh sự kiện từ chuông, để không phụ thuộc hoàn toàn vào số thông báo chưa đọc.
- Sale bấm Báo giá ở Khách tiềm năng chỉ gửi yêu cầu và giữ nguyên danh sách, không tự mở QuoteEditor. `requestQuote` gọi `openOrderQuote(row, false)`; phiếu đã tồn tại hiện hướng dẫn xem tại tab Báo giá (RFQ). Thao tác Nhập giá của vận hành vẫn mở form theo mặc định, form tại RFQ vẫn giữ nguyên. Thiếu hồ sơ vẫn mở dialog bổ sung như trước.
- Nguồn: `server/src/services/crm.service.ts` (`requestQuote`), `server/src/services/notification.service.ts` (`notifyQuoteRequested`), `shared/src/quote-access.ts`, `src/features/crm/live/potential-view.tsx` (`openOrderQuote`), `src/features/crm/live/quotes-view.tsx`, `server/src/config/quote-workflow.test.ts`.

## Kiểm chứng và giới hạn

- `pnpm.cmd typecheck` và `pnpm.cmd typecheck:api`: qua.
- Test tập trung quote-request, handoff và quote-access: 11/11 qua; bao gồm hai tuyến, hai nhóm khách, hai workflow và mở lại phiếu không gửi trùng.
- Hai file quote-workflow/quote-access: 43/46 qua. Ba lỗi chuyển Mess đã tái hiện từ file test gốc tại `5dd894a`: kỳ vọng requirements rỗng bị từ chối không còn khớp schema; hai fixture market rỗng. Không sửa ngoài phạm vi.
- Local preview: FE `127.0.0.1:3002` → API `127.0.0.1:4002` → PostgreSQL riêng `127.0.0.1:55442/speego_rfq_local`. Cluster ở thư mục tạm `speego-rfq-local-pg`; không dùng database cloud trong `server/.env`. Migration đến 047 và 14 tài khoản demo đã seed trên DB local.
- Kiểm tra HTTP thật qua FE rewrite bằng Playwright request context: đăng nhập Sale/Vận hành, tạo phiếu từ khách tiềm năng, Vận hành nhận `quote.request`, mở lại không tăng số thông báo, trang tiềm năng trả HTTP 200 đều qua. Năm khách LOCAL TEST đã tạo local: số 5 đã gửi yêu cầu để kiểm tra, số 1–4 chưa có báo giá, dành cho người dùng thử.
- Kiểm tra UI local bằng Playwright/Edge headless sau thay đổi bỏ tự mở form: Sale bấm Báo giá với phản hồi tạo mới, phiếu đã có, và lỗi API đều ở lại danh sách, không mở dialog, hiện đúng xác nhận/lỗi. Ba phản hồi POST được mock, không ghi thêm dữ liệu local; đăng nhập, trang và thao tác menu chạy thật. Frontend typecheck qua.
- Chưa deploy production. Không backfill thông báo cho phiếu đã tạo trước bản sửa.
- Tạo phiếu và lưu thông báo vẫn là hai thao tác DB riêng theo kiến trúc hiện tại: nếu lưu thông báo lỗi sau khi tạo phiếu, API báo lỗi nhưng mở lại phiếu không tự gửi lại. Có thể dùng thao tác bàn giao hiện có để gửi lại; chưa bổ sung cơ chế retry bền vững.
