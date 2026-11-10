# Thông báo yêu cầu báo giá từ khách tiềm năng

- Phạm vi: Sale bấm Báo giá tại Khách tiềm năng; tạo RFQ, phân công/quyền, người nhận thông báo và danh sách báo giá vận hành; admin Logistics xem mọi tuyến/phiếu.
- Đối chiếu mới nhất: 2026-11-10, sửa admin Logistics tại `1c394fa` trên nhánh `fix/admin-logistics-quote-visibility`, ghép main `678813b` (gồm quyền phân công `458f231`). Các kết quả ở từng mục gắn với revision được ghi rõ.

## Phân công và quyền theo người nhận (2026-11-10)

- Main đã có chia xoay vòng từ `abe5a9a`: `crm.chia_don` lưu người phụ trách theo `(tuyen, ban, bao_gia_id)`. Seed migration 048 cấu hình Logistics: Dương Thị Thanh Thảo / Trịnh Ngọc Quốc Anh; Sourcing: Trần Thị Hương Thanh / Hoàng Thị Kim Anh. Seed nối theo tên người dùng đang có trong DB; đây là cấu hình nguồn, chưa xác nhận danh sách/phiếu thực tế production. Off tay hoặc nghỉ phép cả ngày đã duyệt thì bỏ qua; phiếu đã chia giữ nguyên người.
- Hai lỗi đã xác minh ở code nền: danh sách/sửa báo giá chỉ kiểm tra vai trò và nhóm khách, chưa dùng phân công; Sourcing gửi lần đầu đã tự bàn giao dữ liệu Logistics trong repository nhưng service không chia người/thông báo cho bước tự động này.
- Sau sửa, danh tính request từ `crmActor` giới hạn nhân viên `sourcing` / `logistics` vào các phiếu được chia cho chính họ tại bàn tương ứng vai trò, theo đúng tuyến. Lọc ID ở SQL trước limit 200, áp dụng cả tracking và đường mở phiếu Logistics từ khách; sửa/gửi/chuyển Logistics cũng kiểm tra phân công, trả 404 khi ngoài phạm vi. Logistics xem phần Sourcing vẫn phải vượt qua desk/kind policy, đồng thời có phân công Logistics cùng mã phiếu. API assignees không trả mã phiếu ngoài phạm vi nhân viên.
- Admin, Vận hành (`van-hanh`), Ban giám đốc giữ phạm vi quản lý hiện có. Danh sách Khách tiềm năng và Hợp đồng/Đơn hàng sau ký vẫn theo chính sách riêng hiện có; thay đổi này giới hạn phiếu báo giá vận hành, không phải audit quyền toàn CRM.
- Tạo RFQ mới và bàn giao rõ ràng dùng cùng cơ chế chia người + thông báo riêng. Lần gửi đầu của Sourcing COMBINED cũng gọi cơ chế này cho Logistics; không cần bấm thêm để nhận thông báo. Trả lại/làm lại báo giá gửi đúng người phụ trách. Không chia được hoặc nguồn chia lỗi thì chỉ báo Admin/Vận hành; phiếu chưa chia không hiện cho nhân viên. Dùng Chia đơn kiểm tra người nhận/off rồi bàn giao lại để xử lý phiếu cũ/chưa chia; không tự backfill hay chạy migration production.
- Chống trùng thông báo chưa đọc bao gồm `duong_dan`, tránh gộp nhầm Sourcing và Logistics khi phiếu gộp dùng cùng mã và cùng người nhận. Mở lại RFQ đã có vẫn không tự gửi lại thông báo; bàn giao rõ ràng vẫn gửi lại theo cơ chế chống trùng.
- Nguồn: `server/src/services/crm.service.ts` (`assignedQuoteIds`, `assertQuoteAssignment`, `sendQuote`, `notifyQuoteReturn`), `server/src/search/crm-list-search.ts` (`QuoteListSearch.quoteIds`), `server/src/controllers/chia-don.controller.ts`, `server/src/services/notification.service.ts`, `server/src/adapters/postgres/notification.repository.ts`, `server/src/adapters/postgres/chia-don.repository.ts`, `server/db/migrations/048_chia_don.sql`, `src/features/crm/live/quotes-view.tsx`.
- Kiểm chứng: toàn bộ danh sách test trong script `test:api` chạy qua trực tiếp bằng tsx: 163 qua / 1 DB integration bỏ qua; build API và test native Vercel entry qua; typecheck API và frontend (`next typegen` + `tsc --noEmit`) qua; diff check qua. Test mới trong `chia-don-service.test.ts` và `notification-dedupe.test.ts` kiểm tra phạm vi, chặn sửa/gửi/chuyển qua ID người khác, tracking, endpoint assignees, tự bàn giao, thông báo đúng người/đúng bàn và fallback quản lý.
- Chưa kiểm tra trình duyệt, API/DB production hoặc DB integration thật cho bản sửa này; chưa xác nhận deployment production. Lưu phiếu, phân công và thông báo vẫn là các thao tác DB riêng; lỗi thông báo sau khi lưu cần bàn giao lại, chưa có outbox/retry bền vững. Các kiểm chứng local DB phía dưới không thay thế giới hạn này.

## Quyết định và nguồn

- `CrmService.requestQuote` gửi thông báo ngay khi repository tạo phiếu mới và có actor. Người nhận hiện theo phân công ở mục trên; `quoteAccessKind` vẫn giữ nhóm khách theo workflow LEGACY/COMBINED. Không tạo phiếu Logistics cho khách Sourcing kết hợp ở bước này.
- Mở lại phiếu (`created: false`) không gửi thêm thông báo. Không cần bấm Chuyển Sourcing/Logistics để nhận thông báo đầu tiên; các thao tác bàn giao rõ ràng hiện có vẫn dùng được và có thể gửi thông báo mới.
- Endpoint tạo phiếu được dùng chung bởi Khách tiềm năng, tạo RFQ và chuyển Mess; những nơi này đều nhận hành vi gửi thông báo lúc tạo mới. Import gọi thẳng repository nên không phát thông báo hàng loạt.
- Màn Khách tiềm năng hiện thông báo xác nhận sau khi API thành công. Danh sách vận hành dùng lại `usePolling` mỗi 30 giây, bên cạnh sự kiện từ chuông, để không phụ thuộc hoàn toàn vào số thông báo chưa đọc.
- Sale bấm Báo giá ở Khách tiềm năng chỉ gửi yêu cầu và giữ nguyên danh sách, không tự mở QuoteEditor. `requestQuote` gọi `openOrderQuote(row, false)`; phiếu đã tồn tại hiện hướng dẫn xem tại tab Báo giá (RFQ). Thao tác Nhập giá của vận hành vẫn mở form theo mặc định, form tại RFQ vẫn giữ nguyên. Thiếu hồ sơ vẫn mở dialog bổ sung như trước.
- Nguồn: `server/src/services/crm.service.ts` (`requestQuote`), `server/src/services/notification.service.ts` (`notifyQuoteRequested`), `shared/src/quote-access.ts`, `src/features/crm/live/potential-view.tsx` (`openOrderQuote`), `src/features/crm/live/quotes-view.tsx`, `server/src/config/quote-workflow.test.ts`.

## Kiểm chứng và giới hạn

### Admin xem toàn bộ báo giá Logistics (2026-11-10)

- Nền `84be9d3`, commit nguồn `1c394fa`, nhánh `fix/admin-logistics-quote-visibility`; bản ghép main `678813b` đã được kiểm chứng trước push. Chưa xác nhận deployment production.
- Đã xác minh bằng giao dịch DB chỉ đọc: khách trùng tên có phiếu ở cả Việt Nam và Global. Bộ lọc một tuyến làm người dùng tưởng thiếu phiếu; quyền nhóm khách của admin vốn đã không giới hạn. Danh sách còn bị cắt ở 200 phiếu mỗi nguồn SQL.
- `QuoteDeskView` mặc định admin tại Logistics xem **Tất cả tuyến**, gộp và sắp xếp phiếu hai tuyến theo ngày. Bỏ chọn để dùng bộ chuyển Việt Nam/Global cũ. Cột Thị trường chỉ rõ tuyến của từng phiếu; tìm kiếm và thông tin người phụ trách lấy cả hai tuyến.
- Mỗi dòng giữ tuyến gốc phía frontend để link theo dõi, lưu, gửi và tải lại editor dùng đúng tuyến. Phản hồi từ lượt tải cũ không ghi đè kết quả của bộ lọc mới. Hook `useCrmLane` và khóa tuyến Sale giữ nguyên; bàn Sourcing và các vai trò khác vẫn xem từng tuyến.
- `CrmService.listQuotes` đặt `search.unlimited` chỉ cho admin tại bàn Logistics; parser không nhận cờ này từ HTTP. Repository bỏ `limit 200` khi cờ nội bộ bật. Vẫn loại hồ sơ đã xóa, giữ các bộ lọc và điều kiện bàn giao Sourcing → Logistics; không tự tạo phiếu hay đổi người phụ trách.
- Giải quyết xung đột merge bằng cách giữ `assignedQuoteIds`/`quoteIds` của main và thêm `unlimited` cùng truy vấn. Nhân viên vẫn lọc phiếu được chia trước limit; admin trong danh tính request không bị giới hạn phân công. Test quyền mới dùng `crmActor` của admin và kiểm tra từ chối bất đồng bộ theo service mới.
- Nguồn: `src/features/crm/live/quotes-view.tsx`, `server/src/services/crm.service.ts`, `server/src/search/crm-list-search.ts`, `server/src/adapters/postgres/crm.repository.ts`.
- Kiểm chứng trước ghép main: 53 test API (`quote-access`, `quote-workflow`, `logistics-handoff`) qua. Hai test Edge headless (`quotes-view.test.mjs`, `lane.test.mjs`) qua; test mới chạy view thật với API giả lập và editor/output được thay bằng probe, kiểm tra tìm kiếm hai tuyến, link theo dõi, người phụ trách, lưu/gửi từng tuyến, reload, vai trò khác, phản hồi cũ và lỗi một tuyến. Typecheck FE/API và diff check qua. Service đã sửa cũng đọc được đủ các phiếu của trường hợp báo thiếu bằng giao dịch DB chỉ đọc tại revision này.
- Kiểm chứng bản merge với `678813b`: toàn bộ danh sách test API trong package script chạy trực tiếp bằng tsx, **164 qua / 1 DB integration bỏ qua**; build API và test native Vercel entry qua. Hai test Edge headless, FE/API typecheck và production build FE (`next build --webpack`) qua. Build Turbopack không giải được package Next qua junction node_modules nằm ngoài root worktree, nên dùng Webpack để kiểm chứng; không đổi config ứng dụng. Đã kiểm tra diff và giữ cả nội dung checkpoint phân công của main.
- ESLint view còn một finding `react-hooks/set-state-in-effect` tại effect gọi `loadQuotes`; đã tái hiện cùng finding trên file gốc tại `84be9d3`. File test mới không có finding. Chưa kiểm tra UI production hoặc benchmark dữ liệu lớn; chế độ admin tải toàn bộ kết quả hiện chưa phân trang.

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
