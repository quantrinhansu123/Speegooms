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
