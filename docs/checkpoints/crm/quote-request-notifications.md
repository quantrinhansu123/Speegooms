# Thông báo yêu cầu báo giá từ khách tiềm năng

- Phạm vi: Sale bấm Báo giá tại Khách tiềm năng; tạo RFQ, người nhận thông báo và danh sách báo giá vận hành.
- Đối chiếu: 2026-11-10, commit sửa `8c10a13` trên nhánh `fix/rfq-send-request`, nền `5dd894a`; đã ghép với main `2865c57` không có xung đột.

## Quyết định và nguồn

- `CrmService.requestQuote` gửi thông báo ngay khi repository tạo phiếu mới và có actor. Dùng `quoteAccessKind` để giữ phạm vi người nhận theo workflow LEGACY/COMBINED. Không tạo phiếu Logistics cho khách Sourcing kết hợp ở bước này.
- Mở lại phiếu (`created: false`) không gửi thêm thông báo. Không cần bấm Chuyển Sourcing/Logistics để nhận thông báo đầu tiên; các thao tác bàn giao rõ ràng hiện có vẫn dùng được và có thể gửi thông báo mới.
- Endpoint tạo phiếu được dùng chung bởi Khách tiềm năng, tạo RFQ và chuyển Mess; những nơi này đều nhận hành vi gửi thông báo lúc tạo mới. Import gọi thẳng repository nên không phát thông báo hàng loạt.
- Màn Khách tiềm năng hiện thông báo xác nhận sau khi API thành công. Danh sách vận hành dùng lại `usePolling` mỗi 30 giây, bên cạnh sự kiện từ chuông, để không phụ thuộc hoàn toàn vào số thông báo chưa đọc.
- Sale bấm Báo giá ở Khách tiềm năng chỉ gửi yêu cầu và giữ nguyên danh sách, không tự mở QuoteEditor. `requestQuote` gọi `openOrderQuote(row, false)`; phiếu đã tồn tại hiện hướng dẫn xem tại tab Báo giá (RFQ). Thao tác Nhập giá của vận hành vẫn mở form theo mặc định, form tại RFQ vẫn giữ nguyên. Thiếu hồ sơ vẫn mở dialog bổ sung như trước.
- Nguồn: `server/src/services/crm.service.ts` (`requestQuote`), `server/src/services/notification.service.ts` (`notifyQuoteRequested`), `shared/src/quote-access.ts`, `src/features/crm/live/potential-view.tsx` (`openOrderQuote`), `src/features/crm/live/quotes-view.tsx`, `server/src/config/quote-workflow.test.ts`.

## Kiểm chứng và giới hạn

### Admin xem toàn bộ báo giá Logistics (2026-11-10)

- Nền `84be9d3`, nhánh `fix/admin-logistics-quote-visibility`; chưa push/deploy trong task này.
- Đã xác minh bằng giao dịch DB chỉ đọc: khách trùng tên có phiếu ở cả Việt Nam và Global. Bộ lọc một tuyến làm người dùng tưởng thiếu phiếu; quyền nhóm khách của admin vốn đã không giới hạn. Danh sách còn bị cắt ở 200 phiếu mỗi nguồn SQL.
- `QuoteDeskView` mặc định admin tại Logistics xem **Tất cả tuyến**, gộp và sắp xếp phiếu hai tuyến theo ngày. Bỏ chọn để dùng bộ chuyển Việt Nam/Global cũ. Cột Thị trường chỉ rõ tuyến của từng phiếu; tìm kiếm và thông tin người phụ trách lấy cả hai tuyến.
- Mỗi dòng giữ tuyến gốc phía frontend để link theo dõi, lưu, gửi và tải lại editor dùng đúng tuyến. Phản hồi từ lượt tải cũ không ghi đè kết quả của bộ lọc mới. Hook `useCrmLane` và khóa tuyến Sale giữ nguyên; bàn Sourcing và các vai trò khác vẫn xem từng tuyến.
- `CrmService.listQuotes` đặt `search.unlimited` chỉ cho admin tại bàn Logistics; parser không nhận cờ này từ HTTP. Repository bỏ `limit 200` khi cờ nội bộ bật. Vẫn loại hồ sơ đã xóa, giữ các bộ lọc và điều kiện bàn giao Sourcing → Logistics; không tự tạo phiếu hay đổi người phụ trách.
- Nguồn: `src/features/crm/live/quotes-view.tsx`, `server/src/services/crm.service.ts`, `server/src/search/crm-list-search.ts`, `server/src/adapters/postgres/crm.repository.ts`.
- Kiểm chứng: 53 test API (`quote-access`, `quote-workflow`, `logistics-handoff`) qua. Hai test Edge headless (`quotes-view.test.mjs`, `lane.test.mjs`) qua; test mới chạy view thật với API giả lập và editor/output được thay bằng probe, kiểm tra tìm kiếm hai tuyến, link theo dõi, người phụ trách, lưu/gửi từng tuyến, reload, vai trò khác, phản hồi cũ và lỗi một tuyến. Typecheck FE/API và diff check qua. Service đã sửa cũng đọc được đủ các phiếu của trường hợp báo thiếu bằng giao dịch DB chỉ đọc.
- ESLint view còn một finding `react-hooks/set-state-in-effect` tại effect gọi `loadQuotes`; đã tái hiện cùng finding trên file gốc tại `84be9d3`. File test mới không có finding. Chưa chạy production build, UI production hoặc benchmark dữ liệu lớn; chế độ admin tải toàn bộ kết quả hiện chưa phân trang.

### Giữ tuyến khi mở yêu cầu từ thông báo (2026-11-10)

- Nền `80d8451`, nhánh sửa `fix/logistics-lane-persistence`; trạng thái deploy cần kiểm tra riêng với hệ thống hosting.
- Lỗi đã xác minh: `useCrmLane` mặc định Việt Nam; thông báo đổi sang Global qua `useFocusRow`, rồi `clearOpenContractParams` xóa `id` và `lane`. Tải lại quay về Việt Nam nên đơn Global không hiện trong danh sách, không phải bằng chứng mất dữ liệu.
- `src/features/crm/live/lane.tsx`: giữ tuyến của người dùng trong `sessionStorage`, tách theo `user.id`; ưu tiên `lane` hợp lệ từ URL, sau đó tuyến đã lưu, cuối cùng Việt Nam. Khôi phục sau hydration; Sale hoặc trang cố định tuyến vẫn giữ khóa. Trình duyệt chặn storage vẫn đổi tuyến được nhưng không nhớ sau reload.
- Hook dùng chung cho Báo giá vận hành, RFQ, Khách tiềm năng, Mess và Hợp đồng. Không thay đổi bộ lọc/phân quyền API; storage chỉ giữ lựa chọn tuyến trong cùng tab.
- Test trình duyệt Edge headless `node --test src/features/crm/live/lane.test.mjs`: qua; chạy hook thật và sự kiện thông báo, kiểm tra reload, mở từ menu, ưu tiên URL, đổi thủ công, tách tài khoản, khóa Sale/trang, dữ liệu lưu không hợp lệ và storage bị chặn. Test dùng esbuild có sẵn qua tsx và Playwright; cần Edge đã cài.
- Frontend typecheck (`next typegen` và `tsc --noEmit`), ESLint hai file thay đổi và `git diff --check`: qua. Chạy CLI trực tiếp từ node_modules vì pnpm trong worktree yêu cầu cài lại dependencies.
- Chưa thử giao dịch Sale → API → DB trên production; kiểm tra này tập trung vào lỗi giữ tuyến phía giao diện.

### Kiểm chứng bản gửi thông báo trước đó

- `pnpm.cmd typecheck` và `pnpm.cmd typecheck:api`: qua.
- Trước push, đã chạy lại cả hai typecheck và 11 test tập trung trên bản merge với main `2865c57`: đều qua; staged diff check qua.
- Test tập trung quote-request, handoff và quote-access: 11/11 qua; bao gồm hai tuyến, hai nhóm khách, hai workflow và mở lại phiếu không gửi trùng.
- Hai file quote-workflow/quote-access: 43/46 qua. Ba lỗi chuyển Mess đã tái hiện từ file test gốc tại `5dd894a`: kỳ vọng requirements rỗng bị từ chối không còn khớp schema; hai fixture market rỗng. Không sửa ngoài phạm vi.
- Local preview: FE `127.0.0.1:3002` → API `127.0.0.1:4002` → PostgreSQL riêng `127.0.0.1:55442/speego_rfq_local`. Cluster ở thư mục tạm `speego-rfq-local-pg`; không dùng database cloud trong `server/.env`. Migration đến 047 và 14 tài khoản demo đã seed trên DB local.
- Kiểm tra HTTP thật qua FE rewrite bằng Playwright request context: đăng nhập Sale/Vận hành, tạo phiếu từ khách tiềm năng, Vận hành nhận `quote.request`, mở lại không tăng số thông báo, trang tiềm năng trả HTTP 200 đều qua. Năm khách LOCAL TEST đã tạo local: số 5 đã gửi yêu cầu để kiểm tra, số 1–4 chưa có báo giá, dành cho người dùng thử.
- Kiểm tra UI local bằng Playwright/Edge headless sau thay đổi bỏ tự mở form: Sale bấm Báo giá với phản hồi tạo mới, phiếu đã có, và lỗi API đều ở lại danh sách, không mở dialog, hiện đúng xác nhận/lỗi. Ba phản hồi POST được mock, không ghi thêm dữ liệu local; đăng nhập, trang và thao tác menu chạy thật. Frontend typecheck qua.
- Chưa deploy production. Không backfill thông báo cho phiếu đã tạo trước bản sửa.
- Tạo phiếu và lưu thông báo vẫn là hai thao tác DB riêng theo kiến trúc hiện tại: nếu lưu thông báo lỗi sau khi tạo phiếu, API báo lỗi nhưng mở lại phiếu không tự gửi lại. Có thể dùng thao tác bàn giao hiện có để gửi lại; chưa bổ sung cơ chế retry bền vững.
