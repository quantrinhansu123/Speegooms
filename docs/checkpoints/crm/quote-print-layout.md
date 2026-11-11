# Bố cục bản in báo giá

- **Phạm vi:** RFQ, bản xem trước, in và tải PDF; lưu ý vận chuyển, màu tổng chi phí, cột kg/CBM/m².
- **Đối chiếu:** 2026-11-11, nền `fdc1a3c`; thay đổi từ `fix/rfq-print-cleanup` được tích hợp trên `feat/quote-original-cost`. Chưa xác nhận deployment.
- **Quyết định:** bỏ cột kg/CBM/m² khỏi bảng sản phẩm trên bản in, căn lại tổng/đặt cọc và cột tiền bổ sung. Dữ liệu và phép tính cước giữ nguyên. Trong bảng vận chuyển, chỉ số tiền tổng logistics cuối cùng tô vàng; tiền cước và phụ phí không tô vàng.
- **Phân trang:** `.freight-note` tránh ngắt giữa khối bằng CSS khi in. Luồng tải PDF chụp canvas có thuật toán cắt trang riêng nên phải thêm khối này vào `protectedBlocks`; chỉ sửa CSS sẽ không đủ cho PDF.
- **Nguồn:** `src/features/crm/live/quote-print.ts` (`quoteItemsHtml`, `quoteSheetHtml`, `quotePrintCss`, `downloadQuotePdf`); hồi quy ở `src/features/crm/live/quote-print.test.ts`.
- **Kiểm chứng:** 13/13 test trong `quote-print.test.ts`, `rfq-print.test.ts`, `quote-payment-output.test.ts` qua. Edge headless xác nhận đúng một ô vàng trong bảng vận chuyển (`sum-row-value`), lưu ý một lần với `break-inside: avoid`, và không còn cột metric; đã xem ảnh mẫu và tạo PDF bằng trình duyệt.
- **Giới hạn:** khối lưu ý dài hơn toàn bộ một trang vẫn cần tách trang. Chưa kiểm tra máy in thực tế hoặc dữ liệu production; chưa chạy thử tải PDF tương tác. File Excel báo giá chưa đổi trong mục này.
