# Sale → Sourcing/Logistics: dữ liệu xử lý báo giá

- Phạm vi: mess, nội dung Sale, cân tính cước, chuyển bàn, FCL, dữ liệu mới khi form đang mở.
- Đối chiếu: 2026-11-10, điều tra từ `80d8451`, nhánh giao cuối `fix/optional-customer-address` từ main `d9e300b`. Nguồn thay đổi và test được commit cùng ghi chú này; chưa xác nhận deployment production.

## Hành vi sau sửa

- Hồ sơ khách, yêu cầu, ảnh và thông tin vận chuyển vẫn đọc từ khách tiềm năng. Báo giá thuần Logistics hiện khối thông tin vận chuyển gồm địa chỉ gửi/nhận, phương thức, kích thước và cân hồ sơ.
- Cân tính phí: có packages thì tính từ kiện; không có packages thì weightKg × quantity (quantity null dùng 1 theo quy ước hiện có), làm tròn lên bội 0,5 kg từng dòng. weightKg là kg MỖI ĐƠN VỊ, không phải tổng cả lô. Không phân tích chuỗi cân tự do ở hồ sơ khách.
- orderPackageMetrics dùng thống nhất cho ô tiền cước, tổng Logistics, bảng đơn hàng và model bản in/PDF/Excel. Có đóng gói thì khóa ô cân dẫn xuất, tránh nhập tay một số không được dùng.
- Lưu/chuyển đơn thường chấp nhận đóng gói hoặc cân nhập tay dương. FCL không yêu cầu package order; bàn giao yêu cầu commodity, weight, volume trong notes.fcl. Vẫn dùng schema và chính sách quyền hiện có.
- logisticsOrderFromSourcing nhận optional previous: lấy nội dung hiện tại theo mẫu được chọn, giữ giá Logistics theo order.id và stt, không ghép theo vị trí; dòng mới không lấy giá hàng Sourcing. Dòng xóa/mẫu đổi không tiếp tục dùng nội dung cũ. Notes/phí Logistics và snapshot đã gửi vẫn giữ riêng.
- Backend toLogisticsQuote và RFQ logisticsQuote đều dùng helper trên để không đọc hai phiên bản đóng gói khác nhau. sourcingContext dùng cùng mẫu hiện tại.
- preserveQuotePrices nhận các trường notes Sale được phép nhập (weightNote/En, totalLabel, deposit/En), giữ các trường vận hành khác. Khách thuần Logistics vẫn dùng applyLogisticsDeskSave để giữ cước/phụ phí.
- Danh sách định kỳ tiếp tục tải dữ liệu. Nếu phiếu đang mở khác bản mới trong rows, QuoteEditor hiện nút Tải dữ liệu mới và nói rõ sẽ bỏ phần chưa lưu; chỉ remount editor khi người dùng bấm, không tự xóa bản nháp đang nhập.
- Địa chỉ hồ sơ được để trống khi chuyển mess/tạo khách và khi yêu cầu báo giá; địa chỉ nhận hàng vẫn bắt buộc cho khách Vận chuyển. Theo yêu cầu người dùng, nhãn ô address ở form chuyển mess/tạo khách trực tiếp là “Địa chỉ gửi hàng”; chỉ đổi nhãn, vẫn lưu address của hồ sơ, chưa chuyển dữ liệu sang shipFromAddress.
- Giới hạn đăng nhập chỉ tính lần thất bại (10 lần/15 phút), giữ giới hạn request chung. Đã kiểm tra 12 lần đăng nhập đúng liên tiếp qua local.

## Bổ sung: sửa sản phẩm trên mess đồng bộ báo giá

- Đối chiếu 2026-11-10, nhánh `fix/mess-product-sync` từ main `6e9e885`; chưa triển khai.
- Nguồn thay đổi: `server/src/adapters/postgres/crm.repository.ts` (`messageSelect`, `toMessage`, `updateMessage`); test hồi quy tại `server/src/config/quote-workflow.test.ts`, được commit cùng checkpoint này.
- Nguyên nhân: sản phẩm nhập trong bước chuyển mess có thể chỉ nằm ở báo giá, không nằm trong `thong_tin_don_hang` của mess; trước đây sửa mess chỉ cập nhật hồ sơ khách, không cập nhật `chi_tiet_don_hang` của báo giá.
- `messageSelect`/`toMessage` ưu tiên mẫu hiện tại của báo giá liên quan (mẫu đang chọn, rồi mẫu có nội dung), sau đó mới dùng nháp mess. Giá, thành tiền, giá ngoại tệ và tỷ giá vận hành không trả về qua sản phẩm mess.
- `updateMessage` lưu mess, hồ sơ và nội dung mẫu báo giá liên quan trong cùng transaction. Chỉ đồng bộ khi payload có `order`; bỏ trường này giữ nguyên báo giá. `null` xóa mẫu tương ứng, không xóa các mẫu khác. Dùng `preserveQuotePrices` để giữ quyền sở hữu giá/đóng gói hiện có; chỉ ghi cột nội dung đơn, không đổi phí, ghi chú, trạng thái hoặc bản đã gửi.
- Áp dụng cả hai tuyến và hai nhóm khách. FCL vẫn dùng form lô hàng riêng, không đồng bộ nháp sản phẩm mess vào form cước FCL. Sourcing kết hợp vẫn giữ đóng gói do vận hành sở hữu.
- Trọng lượng dạng chữ trên hồ sơ không được tự chuyển thành cân tính cước. Với cân tay, `weightKg` vẫn là kg mỗi đơn vị; tổng 50 kg cho số lượng 2 tương ứng 25 kg/đv. Chưa có kích thước thì không kết luận được cân sau quy đổi thể tích.
- Kiểm chứng: 86 test quote-workflow/logistics-handoff/quote-access/quote-sheet/quote-payment qua; API typecheck qua. Test mới kiểm tra nạp lại sản phẩm, không lộ giá, sửa/thêm/xóa/bỏ qua order, giữ mẫu khác và rollback trên cả hai tuyến/bàn. Đọc dữ liệu thật xác nhận sản phẩm cũ được nạp lại; 5 câu SQL được EXPLAIN trong transaction READ ONLY, mô phỏng cân tay ra 50 kg; không ghi production.
- API build và test Vercel entry qua; thêm test quyền bàn giao qua, test DB bàn giao bỏ qua vì chưa cấu hình DB local riêng cho test.
- Giới hạn: chưa thử lưu bằng UI production, chưa sửa dữ liệu cân cũ, chưa kiểm tra chỉnh sửa đồng thời nhiều người. Form mở sẵn cần Tải dữ liệu mới. Không thay đổi snapshot báo giá đã gửi hoặc hợp đồng.

## Bảo hiểm hàng thuần Logistics — 2026-11-11

- Nền `b11afdf`, nhánh `feat/logistics-insurance`. `QuoteOrder.insurance` lưu trong JSON đơn hàng và bản đã gửi; không cần migration. Thiếu trường ở đơn cũ được hiểu là Không.
- Theo yêu cầu cập nhật: form Sale trên Mess/báo giá chỉ chọn Bảo hiểm Có/Không và nhập nội dung hàng; không nhập giá, loại tiền hoặc tỷ giá. Khi Có, Logistics nhập đơn giá/thành tiền, chọn loại tiền và nhập tỷ giá ở tab báo giá Logistics, cả LCL/AIR và FCL. Không vẫn giữ dữ liệu giá cũ để đổi lại Có không mất dữ liệu.
- `preserveQuotePrices` giữ nguyên giá, loại tiền và tỷ giá vận hành đã lưu dù Sale đổi bảo hiểm; dòng mới không nhận giá từ Sale, mẫu thuần Logistics mới dùng VND và chưa có tỷ giá. Logistics lưu các giá trị này qua `quoteDeskPatch`. Cước/phụ phí/thanh toán do Logistics quản lý, không cộng giá trị khai bảo hiểm vào tiền cước.
- `asOrders` đọc lại cờ bảo hiểm, `toMessage` giữ giá của hàng SHIPPING có bảo hiểm khi mở sửa Mess từ báo giá liên kết. Đơn FCL có bảo hiểm cũng mang nháp sản phẩm sang, mẫu in FCL dùng chung bảng hàng để hiện/ẩn giá theo lựa chọn.
- `quoteSheetInputOf` đặt showPricing theo loại khách và bảo hiểm; model chung ẩn cả giá chính/phụ và tổng hàng khi Không. Bản in/PDF bỏ cột giá, Excel thường ẩn cột; mẫu Excel FCL vẫn là bảng cước riêng như trước.
- Theo bổ sung yêu cầu: bản in/PDF của khách thuần LOGISTICS không bảo hiểm ẩn toàn bộ bảng thông tin sản phẩm (tiêu đề, STT, mặt hàng, ảnh, số lượng, Kg/CBM/m2, quy cách, note và dữ liệu dòng), áp dụng cả mẫu FCL. Có bảo hiểm và khách SOURCING vẫn in bảng hàng; cước và thông tin thanh toán giữ nguyên. Chỉ đổi hàm dựng HTML dùng chung, không xóa sản phẩm hay ẩn form nhập.
- Kiểm chứng: 90 test liên quan qua (quote-workflow, quote-sheet, quote-payment, logistics-handoff, quote-print, mess-form, rfq-print), typecheck frontend/API và diff check qua; thao tác trình duyệt local trên MessOrderDialog (Có/Không, tự tính tổng, sửa tổng tay, lưu và mở lại). Chưa build production hoặc kiểm tra DB/API production, chưa merge/push/deploy.
- Chạy local phải dùng Turbopack (lệnh dev mặc định), không dùng `--webpack`: Tailwind được cấu hình bằng loader `@tailwindcss/turbopack`, Webpack không tạo utility CSS khiến layout dồn trái. Worktree dùng node_modules junction cần đặt `TURBOPACK_ROOT` về thư mục repo chính chứa node_modules; `next.config.ts` nhận biến này, không đặt thì giữ cách tự nhận root mặc định. Đã kiểm tra lại Mess 1440px: sidebar 256px, main x=256/y=64, không tràn ngang; form Mess và form bảo hiểm căn giữa, ô giá hiện khi Có. Không sửa CSS hoặc component layout.
- Kiểm tra cập nhật quyền: 54 test policy/in/thanh toán qua, typecheck frontend/API qua. Trình duyệt local xác nhận Sale chọn Có không có ô nhập giá/tiền tệ; tài khoản Logistics nhập USD, tỷ giá 25000 và giá hàng tại tab báo giá với fixture được thay trong response trình duyệt (không lưu DB). DB local cũ thiếu bảng chia đơn đã chạy migration có sẵn 047_de_xuat/048_chia_don/049_de_xuat_gop_y; API local đã khởi động lại với policy mới. Chưa kiểm tra thao tác lưu từ trình duyệt Logistics.
- Chốt yêu cầu tiền tệ: hàng bảo hiểm thuần Logistics dùng chung Loại tiền cước và Quy đổi VND của cước, không có bộ chọn riêng. `withInsuranceCurrency` dùng cho hiển thị, payload/in trong QuoteEditor và policy lưu/gửi backend; FCL dùng tiền báo giá của phần FCL và cùng freight.vndRate. Chỉ thay mã tiền/tỷ giá, không tự nhân chuyển đổi số giá đã nhập; khách SOURCING và đơn không bảo hiểm không đổi.
- Kiểm chứng cuối trước merge: 92 test liên quan qua, typecheck frontend/API và diff check qua. Playwright kiểm tra bộ chọn tiền/tỷ giá riêng đã ẩn, đổi cước USD, nhập 25000 và giá hàng 150: payload lưu có cùng USD/25000 ở cước và đơn; response được thay bằng fixture trong trình duyệt, không ghi dữ liệu báo giá vào DB. Merge local được người dùng yêu cầu; fetch GitHub không thành công vì không kết nối được cổng 443, không push/deploy.
- Đã merge feature `dd08598` vào main ở `f067e5c`. Sau merge, 92 test và typecheck frontend/API qua; kiểm tra thật health, đăng nhập Sale/Admin, form Sale chỉ chọn bảo hiểm và danh sách Logistics local qua. Frontend 3002 (Turbopack) và API 4002 chạy từ worktree đang giữ main `logistics-lane-persistence`, DB 55442/speego_rfq_local; không phải từ nhánh feature nữa. Chưa push/deploy; không xác nhận main remote mới hơn vì fetch thất bại.

## Nguồn

- src/services/crm/quote-lines.ts: packageMetrics, orderPackageMetrics.
- src/features/crm/live/quote-editor.tsx: FreightCostEditor, notesWithFreight, OrderPackagesBlock, orderDraftSchema, transferLogistics, logisticsLeadFacts.
- src/features/crm/live/quote-sheet.ts: buildQuoteSheet.
- shared/src/quote-handoff.ts: logisticsOrderFromSourcing.
- server/src/adapters/postgres/crm.repository.ts: toLogisticsQuote.
- src/features/crm/live/rfq-quotes-view.tsx: logisticsQuote, reload.
- src/features/crm/live/quotes-view.tsx: latest, onReload.
- server/src/services/quote-edit-policy.ts: preserveQuotePrices, applyLogisticsDeskSave.
- server/src/services/crm.service.ts: handoffLogisticsOrder.

## Kiểm chứng và giới hạn

- 91 test tập trung qua: quote-workflow, logistics-handoff, quote-payment, quote-sheet, mess-form, potential-quote-validation, quote-print, rfq-print; gồm test mới cho đổi/thêm/xóa/đảo dòng và đổi mẫu, giữ giá, cân nhập tay và ưu tiên đóng gói, ghi chú Sale, FCL thiếu/đủ dữ liệu và bàn giao cân tay.
- pnpm check:crm qua; thêm assert cân tay, nhiều dòng hỗn hợp, ưu tiên packages, quantity=0.
- Ba lỗi test cũ đã chỉnh kỳ vọng số lượng Sourcing và fixture market, không nới schema ứng dụng. Các ghi chú trước nói 3 lỗi này còn tồn tại chỉ phản ánh revision trước bản sửa này.
- Frontend và API typecheck qua. Lint còn lỗi có sẵn: so sánh HEAD với bản sửa trên quote-editor, quotes-view, rfq-quotes-view có cùng số và loại finding (22/1/2), không thêm finding mới.
- Đã kiểm tra API thật qua FE 3002 → API 4002 → PostgreSQL local 55442/speego_rfq_local: đăng nhập ba vai trò, tạo/chuyển/lưu/bàn giao/đọc lại năm bộ TEST-FLOW (KG/AIR/SEA/SOURCING/FCL). Edge headless mở phiếu Logistics thấy cân 50/24/20 kg, giá 12 cho cước 600 USD ở phiếu KG và mở được form FCL. Hướng dẫn thử đầy đủ: [local checklist](../../testing/sale-operations-local.md).
- Chưa kiểm tra API/DB production hoặc lưu đồng thời nhiều người. Các bước gửi/trả lại/tải file trong checklist còn để người dùng nghiệm thu. Cơ chế tải mới là cập nhật chủ động, không phải khóa phiên bản phía server.
- Trước merge: production build frontend và build API thành công, 144 test API qua/1 bỏ qua và test Vercel entry qua; 16 test frontend/schema/bản in qua; typecheck FE/API, check:crm, diff check qua. Kiểm tra DB integration được bỏ qua theo cấu hình test, không thay bằng kết luận production đã kiểm chứng.
- Các thay đổi de-xuat và approval-templates có sẵn thuộc việc khác, không đưa vào commit của task này.
- Khi push, remote main đã tiến đến `5235d41` (chống trùng thông báo, chia đơn, góp ý đề xuất). Ghép lại chỉ xung đột danh sách test server/package.json; giữ test của cả hai bên, không thay đổi logic hợp nhất tự động. Bản ghép chạy 154 test API qua/1 bỏ qua, Vercel entry qua, 81 test tập trung qua, typecheck FE/API qua và build API qua. Build frontend worktree qua với `next build --webpack`; Turbopack không resolve được dependency junction nằm ngoài worktree, nên chưa xác minh Turbopack cho bản ghép mới (bản trước ghép đã build Turbopack qua). Không đổi cấu hình build dự án.
