# Tỷ giá VND của báo giá Logistics

- Phạm vi: tổng báo giá Logistics báo thiếu tỷ giá dù đã nhập; đọc lại nháp và bản đã gửi.
- Đối chiếu: 2026-11-12, nền `49b4a44`, bản sửa trên `fix/logistics-vnd-rate-read` được commit cùng ghi chú này.
- Phát hiện: `ghi_chu.freight.vndRate` và `ban_da_gui.notes.freight.vndRate` có thể đã lưu đủ trong DB, nhưng `asFreight` bỏ sót trường khi chuyển dữ liệu thành DTO. Không kết luận người dùng chưa nhập chỉ từ cảnh báo trên màn hình.
- Sửa: `asFreight` đọc `vndRate` qua `optionalAmount`, dùng chung cho nháp, bản đã gửi và sheet Logistics kết hợp. Không thay dữ liệu DB hay tự lấy tỷ giá mới.
- Nguồn: `server/src/adapters/postgres/crm.repository.ts` (`asFreight`, `asNotes`, `asSent`, `asSheet`); `shared/src/quote-amounts.ts` (`quoteVndAmount`); test hồi quy trong `server/src/config/quote-payment.test.ts`.
- Kiểm chứng: test hồi quy thất bại trước sửa vì nhận `undefined` thay tỷ giá đã lưu; sau sửa 87 test payment/workflow/handoff/sheet/contract-readiness qua, API typecheck và `git diff --check` qua. Test bao phủ hai tuyến, nháp/bản gửi, tỷ giá có/không có và tiền chính đơn VND trong khi cước USD.
- Đã đọc lại hai báo giá người dùng yêu cầu bằng repository đã sửa trong giao dịch DB READ ONLY: cả nháp và bản gửi giữ tỷ giá, tổng VND đúng. Chưa kiểm tra giao diện sau deployment; cần backend triển khai commit mới để màn hình nhận trường này.

## Bắt buộc tỷ giá Sourcing và Logistics — 2026-11-12

- Nền `ace1733`, nguồn `fix/required-quote-vnd-rates`; bản sửa được commit cùng ghi chú này trước khi giao vào `main` theo yêu cầu người dùng.
- Vận hành lưu hoặc gửi báo giá ngoại tệ phải nhập tỷ giá quy đổi VND hữu hạn, lớn hơn 0. Sourcing kiểm tra từng mẫu đơn; Logistics kiểm tra tỷ giá riêng `notes.freight.vndRate` theo loại tiền cước hoặc `notes.payment.quoteCurrency` của FCL (mặc định USD). VND không cần tỷ giá.
- Không lấy tỷ giá của bản đã gửi hoặc tỷ giá đơn hàng Sourcing để thay ô tỷ giá cước còn trống. Giữ cơ chế đọc/hiển thị dữ liệu cũ; báo giá cũ thiếu tỷ giá cần bổ sung khi vận hành lưu/gửi lại. Sale chỉ sửa nội dung hàng vẫn lưu được.
- Nguồn: `shared/src/quote-amounts.ts` (`quoteVndRateError`, export ở `shared/src/index.ts`); `server/src/services/crm.service.ts` (`updateQuote`, `sendQuote`) kiểm tra sau chính sách quyền sửa; `src/features/crm/live/quote-editor.tsx` (`payloadFor`, các ô quy đổi VND) dùng cùng helper và đánh dấu bắt buộc.
- Không siết `updateQuoteSchema` vì schema còn dùng để đọc/nhập nháp của Sale trước khi vận hành định giá. Kiểm tra ở service chặn cả API lưu và gửi trực tiếp.
- Kiểm chứng: 95 test payment/workflow/validity/handoff/contract-readiness/sheet qua; frontend (sau `next typegen`) và API typecheck, `git diff --check` qua. Hồi quy bao phủ thiếu tỷ giá, VND, tỷ giá không hợp lệ, FCL, nháp không dùng snapshot cũ, mẫu Sourcing chưa chọn và API lưu/gửi/Sale sửa nội dung. ESLint của quote-editor còn 17 lỗi/5 cảnh báo, bằng baseline `main`; cấu hình lint bỏ qua server/shared. Chưa kiểm tra tương tác trình duyệt hoặc triển khai.
