# CRM: mess → khách tiềm năng

- Từ khóa: mess, conversion, convertMessage, Sourcing, Logistics, quantityNote, market, order draft.
- Đối chiếu mới nhất: nền `34cd5b8`, nhánh `fix/mess-order-metrics-phone`, ngày 2026-11-13; chưa merge/push/deploy.
- Trạng thái: đã đọc các schema và luồng gọi liên quan; cần đối chiếu lại nếu chúng thay đổi. Đây không phải audit toàn bộ CRM.

## Hành vi cần giữ

- Cập nhật 2026-11-10 trên `fix/optional-customer-address` (nền `d9e300b`): địa chỉ khách/công ty được để trống khi chuyển mess hoặc tạo khách trực tiếp; bỏ dấu bắt buộc trên các form liên quan và bỏ chặn địa chỉ trống khi yêu cầu báo giá. Giữ giới hạn 300 ký tự và giữ bắt buộc `shipToAddress` cho khách Vận chuyển. Test tại `potential-quote-validation.test.ts` kiểm tra cả hai nhóm và địa chỉ nhận hàng còn bắt buộc.
- Nhãn address trên hai form chuyển mess/tạo khách trực tiếp đổi thành “Địa chỉ gửi hàng” theo yêu cầu. Đây là đổi nhãn, không đổi cột lưu và không backfill shipFromAddress. Các màn hồ sơ khác vẫn dùng address như trước.

- Tạo/sửa mess yêu cầu `market` khác rỗng. Số điện thoại/email của mess chỉ kiểm tra định dạng nếu có nhập; bước chuyển đổi có schema riêng và yêu cầu số điện thoại.
- Số điện thoại giữ nguyên định dạng quốc tế như `(+84)0346612345`, `+1 (234) 567-8900`; cho phép số, `+`, ngoặc, khoảng trắng, chấm và gạch ngang, phải có chữ số và tối đa 30 ký tự. Cùng quy tắc cho tạo/sửa mess, chuyển mess và sửa hồ sơ khách. Không tự bỏ mã quốc gia hoặc đổi sang E.164.
- Sourcing ghi số lượng trên từng dòng hàng. UI chuyển đổi không yêu cầu `quantityNote` cho Sourcing; schema chỉ bắt buộc trường này khi có `shippingMode`.
- Với Logistics, UI nhận diện qua `row.demand === "SHIPPING"` và yêu cầu chọn phương thức. Schema kiểm tra số lượng, địa chỉ nhận, yêu cầu khách và lý do chuyển. SEA cần LCL/FCL, AIR không dùng phân loại đó.
- Form tạo khách trực tiếp/chuyển mess bỏ hai ô Trọng lượng và Kích thước kiện hàng; không sao chép cân/kích thước thành chuỗi trong payload chuyển. Hồ sơ đọc cân thực/kích thước từ kiện trên đơn hàng qua `toPotential` khi chưa có ghi chú thủ công cũ; cân tay tính cước vẫn nằm trên dòng, không coi là cân thực. `missingQuoteFields` không chặn vì thiếu hai chuỗi hồ sơ. Các trường API vẫn tùy chọn để tương thích client/dữ liệu cũ; không xóa dữ liệu cũ hoặc sửa cách tính cước.
- Bàn giao Logistics vẫn kiểm tra cân/kiện trên từng dòng; FCL vẫn bắt buộc hàng hóa, trọng lượng và số lượng/loại container trong `notes.fcl` ở bước báo giá. Không thay các kiểm tra này bằng ghi chú hồ sơ.
- `brand` của chuyển đổi có thể kế thừa nguồn trên mess; UI kiểm tra nguồn trước khi gửi. Không dùng giá trị brand để suy ra yêu cầu số lượng của Sourcing/Logistics.
- Luồng UI chuyển mess, tạo báo giá, rồi đưa nháp đơn hàng sang khi phù hợp. FCL dùng form cước riêng; nháp sản phẩm có bảo hiểm vẫn được mang sang để giữ giá trị khai báo theo luồng hiện có.

## Mở đúng nơi

| Cần xem | Nguồn và điểm tìm |
|---|---|
| Payload và điều kiện bắt buộc | [shared/src/crm.ts](../../../shared/src/crm.ts): `messageFields`, `createMessageSchema`, `updateMessageSchema`, `convertMessageSchema` |
| Dialog chuyển đổi và nháp đơn hàng | [mess-convert.tsx](../../../src/features/crm/live/mess-convert.tsx): `detailsFrom`, `prefillOrder`, `convertMessageSchema.safeParse` |
| Kiểm tra hồ sơ trước khi báo giá | [potential-quote-validation.ts](../../../src/features/crm/live/potential-quote-validation.ts): `missingQuoteFields` |
| API và quyền | [crm.routes.ts](../../../server/src/routes/crm.routes.ts): `/messages/:id/convert`, `message.convert` |
| Service và lưu DB | [crm.service.ts](../../../server/src/services/crm.service.ts), [crm.repository.ts](../../../server/src/adapters/postgres/crm.repository.ts): `convertMessage` |
| Test UI/schema theo loại khách | [potential-quote-validation.test.ts](../../../src/features/crm/live/potential-quote-validation.test.ts), [mess-form.test.ts](../../../src/features/crm/live/mess-form.test.ts) |
| Test workflow/fixture API | [quote-workflow.test.ts](../../../server/src/config/quote-workflow.test.ts), [crm.repository.integration.test.ts](../../../server/src/adapters/postgres/crm.repository.integration.test.ts) |

## Bằng chứng và việc còn mở

- Bản sửa 2026-11-13: 65 test tập trung qua (`mess-form`, `potential-quote-validation`, `quote-workflow`, `potential-quote-status`); typecheck frontend/API, lint các file frontend sửa, `check:crm` và diff check qua (shared được cấu hình bỏ qua lint); `pnpm test:api` build API thành công, 200 test qua/3 bỏ qua theo cấu hình DB, test Vercel entry qua.
- Playwright trên form thật qua harness local tạm: tạo mess giữ nguyên số quốc tế; form tạo khách/chuyển mess không còn hai ô trùng; AIR/LCL gửi payload không chứa hai chuỗi, giữ kiện và tính lại cân từ đơn; FCL mở form lô hàng với cân để nhập tại đây và chưa tự bàn giao. API trong lượt UI được giả lập; không ghi production. Harness đã được dọn sau kiểm tra.
- Chưa chạy DB integration, production build frontend hoặc kiểm tra deployment Vercel cho bản sửa này.

### Lịch sử kiểm chứng 2026-11-08

Trong phiên ngày 2026-11-08, khi ghép main `8ea86e4` vào nhánh `fix/require-complete-mess-conversion`, suite API phát hiện 3 test cũ không khớp schema: một test vẫn bắt quantityNote khi không có shippingMode, hai test dùng fixture market rỗng.

Commit `b117738` trên nhánh đó đã điều chỉnh kỳ vọng và fixture; fixture kiểm thử DB cũng được cập nhật. Tại revision này đã quan sát: `pnpm build`, `pnpm typecheck:api`, 127 test API + test entry Vercel, và 8 test trong hai file UI/schema nêu trên đều qua. Test tích hợp DB chưa chạy.

Các sửa test trong `b117738` chưa nằm trong main `8ea86e4`. Vì vậy không dùng kết quả pass của nhánh kia để khẳng định main đã pass. Khi gặp lại lỗi này, kiểm tra Git và test hiện tại trước khi sửa; không nới schema chỉ để fixture cũ chạy được.
