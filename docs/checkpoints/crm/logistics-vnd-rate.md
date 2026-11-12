# Tỷ giá VND của báo giá Logistics

- Phạm vi: tổng báo giá Logistics báo thiếu tỷ giá dù đã nhập; đọc lại nháp và bản đã gửi.
- Đối chiếu: 2026-11-12, nền `49b4a44`, bản sửa trên `fix/logistics-vnd-rate-read` được commit cùng ghi chú này.
- Phát hiện: `ghi_chu.freight.vndRate` và `ban_da_gui.notes.freight.vndRate` có thể đã lưu đủ trong DB, nhưng `asFreight` bỏ sót trường khi chuyển dữ liệu thành DTO. Không kết luận người dùng chưa nhập chỉ từ cảnh báo trên màn hình.
- Sửa: `asFreight` đọc `vndRate` qua `optionalAmount`, dùng chung cho nháp, bản đã gửi và sheet Logistics kết hợp. Không thay dữ liệu DB hay tự lấy tỷ giá mới.
- Nguồn: `server/src/adapters/postgres/crm.repository.ts` (`asFreight`, `asNotes`, `asSent`, `asSheet`); `shared/src/quote-amounts.ts` (`quoteVndAmount`); test hồi quy trong `server/src/config/quote-payment.test.ts`.
- Kiểm chứng: test hồi quy thất bại trước sửa vì nhận `undefined` thay tỷ giá đã lưu; sau sửa 87 test payment/workflow/handoff/sheet/contract-readiness qua, API typecheck và `git diff --check` qua. Test bao phủ hai tuyến, nháp/bản gửi, tỷ giá có/không có và tiền chính đơn VND trong khi cước USD.
- Đã đọc lại hai báo giá người dùng yêu cầu bằng repository đã sửa trong giao dịch DB READ ONLY: cả nháp và bản gửi giữ tỷ giá, tổng VND đúng. Chưa kiểm tra giao diện sau deployment; cần backend triển khai commit mới để màn hình nhận trường này.
