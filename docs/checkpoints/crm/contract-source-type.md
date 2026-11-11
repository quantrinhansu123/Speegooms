# Loại đơn trên hợp đồng

- Phạm vi: cột Loại đơn ở danh sách và phần thông tin chi tiết hợp đồng; dùng chung Sale, Vận hành và Kế toán, tuyến Việt Nam và Global.
- Đối chiếu: 2026-11-11, nền `f96af95`, nhánh `fix/contract-print-quote-id` (chỉ bổ sung hiển thị loại đơn).
- API trả `quoteDesk`: `sourcing`, `logistics` hoặc `null`, đối chiếu `hop_dong.ma_bao_gia` với bảng báo giá tương ứng trong đúng tuyến. Sourcing có kèm vận chuyển vẫn hiện Sourcing vì hợp đồng xuất phát từ báo giá Sourcing.
- Thiếu liên kết hoặc không còn báo giá nguồn: hiện “Chưa xác định”; không suy đoán từ giá trị tiền hàng/cước và không sửa liên kết dữ liệu.
- Đường dẫn: `server/src/adapters/postgres/crm.repository.ts` (`contractSelect`, `toContract`), `server/src/repositories/crm.repository.ts` (`ContractRecord`), `src/features/crm/live/contracts-live-view.tsx`.
- Kiểm chứng: 48 test trong `server/src/config/quote-workflow.test.ts` đạt, gồm loại nguồn trên cả hai tuyến và ba chế độ xem; typecheck API và frontend đạt.
- Chưa xác minh dữ liệu production hoặc triển khai. Lỗi in `/quotes/null/contract-source` và việc API in chỉ tìm Sourcing chưa được sửa trong thay đổi này.
