# CRM: mess → khách tiềm năng

- Từ khóa: mess, conversion, convertMessage, Sourcing, Logistics, quantityNote, market, order draft.
- Đối chiếu code: `8ea86e4` (main đã fetch), ngày 2026-11-08.
- Trạng thái: đã đọc các schema và luồng gọi liên quan; cần đối chiếu lại nếu chúng thay đổi. Đây không phải audit toàn bộ CRM.

## Hành vi cần giữ

- Cập nhật 2026-11-10 trên `fix/optional-customer-address` (nền `d9e300b`): địa chỉ khách/công ty được để trống khi chuyển mess hoặc tạo khách trực tiếp; bỏ dấu bắt buộc trên các form liên quan và bỏ chặn địa chỉ trống khi yêu cầu báo giá. Giữ giới hạn 300 ký tự và giữ bắt buộc `shipToAddress` cho khách Vận chuyển. Test tại `potential-quote-validation.test.ts` kiểm tra cả hai nhóm và địa chỉ nhận hàng còn bắt buộc.
- Nhãn address trên hai form chuyển mess/tạo khách trực tiếp đổi thành “Địa chỉ gửi hàng” theo yêu cầu. Đây là đổi nhãn, không đổi cột lưu và không backfill shipFromAddress. Các màn hồ sơ khác vẫn dùng address như trước.

- Tạo/sửa mess yêu cầu `market` khác rỗng. Số điện thoại/email của mess chỉ kiểm tra định dạng nếu có nhập; bước chuyển đổi có schema riêng và yêu cầu số điện thoại.
- Sourcing ghi số lượng trên từng dòng hàng. UI chuyển đổi không yêu cầu `quantityNote` cho Sourcing; schema chỉ bắt buộc trường này khi có `shippingMode`.
- Với Logistics, UI nhận diện qua `row.demand === "SHIPPING"` và yêu cầu chọn phương thức. Schema kiểm tra số lượng, trọng lượng, địa chỉ nhận, lý do chuyển; FCL được bỏ kích thước kiện. SEA cần LCL/FCL, AIR không dùng phân loại đó.
- `brand` của chuyển đổi có thể kế thừa nguồn trên mess; UI kiểm tra nguồn trước khi gửi. Không dùng giá trị brand để suy ra yêu cầu số lượng của Sourcing/Logistics.
- Luồng UI chuyển mess, tạo báo giá, rồi đưa nháp đơn hàng sang khi phù hợp. FCL dùng form cước riêng và bỏ bước đưa nháp sản phẩm sang.

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

Trong phiên ngày 2026-11-08, khi ghép main `8ea86e4` vào nhánh `fix/require-complete-mess-conversion`, suite API phát hiện 3 test cũ không khớp schema: một test vẫn bắt quantityNote khi không có shippingMode, hai test dùng fixture market rỗng.

Commit `b117738` trên nhánh đó đã điều chỉnh kỳ vọng và fixture; fixture kiểm thử DB cũng được cập nhật. Tại revision này đã quan sát: `pnpm build`, `pnpm typecheck:api`, 127 test API + test entry Vercel, và 8 test trong hai file UI/schema nêu trên đều qua. Test tích hợp DB chưa chạy.

Các sửa test trong `b117738` chưa nằm trong main `8ea86e4`. Vì vậy không dùng kết quả pass của nhánh kia để khẳng định main đã pass. Khi gặp lại lỗi này, kiểm tra Git và test hiện tại trước khi sửa; không nới schema chỉ để fixture cũ chạy được.
