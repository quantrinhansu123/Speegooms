# Bố cục bản in báo giá

- **Phạm vi:** RFQ, bản xem trước, in và tải PDF; lưu ý vận chuyển, màu tổng chi phí, cột kg/CBM/m².
- **Đối chiếu:** 2026-11-11, nguồn `e15f757`; hợp nhất với main `41c68ec` trong commit chứa ghi chú này. Chưa xác nhận deployment.
- **Quyết định:** bỏ cột kg/CBM/m² khỏi bảng sản phẩm trên bản in, căn lại tổng/đặt cọc và cột tiền bổ sung. Dữ liệu và phép tính cước giữ nguyên. Trong bảng vận chuyển, chỉ số tiền tổng logistics cuối cùng tô vàng; tiền cước và phụ phí không tô vàng.
- **Phân trang:** `.freight-note` tránh ngắt giữa khối bằng CSS khi in. Luồng tải PDF chụp canvas có thuật toán cắt trang riêng nên phải thêm khối này vào `protectedBlocks`; chỉ sửa CSS sẽ không đủ cho PDF.
- **Hợp nhất với `41c68ec`:** giữ khung head/footer lặp theo trang của main và bảo vệ `.masthead`, `.closing`, hàng bảng, ngân hàng/chữ ký khi cắt PDF; thêm lưu ý vào cùng danh sách bảo vệ. Browser xác nhận head/footer có đúng một bản trong frame, masthead không lặp trong thân, lưu ý vẫn `break-inside: avoid`, đúng một ô vàng trong bảng vận chuyển; ảnh mẫu đã xem. Production build FE và 20 test frontend/bản in/Excel/sidebar qua trên kết quả hợp nhất.
- **Nguồn:** `src/features/crm/live/quote-print.ts` (`quoteItemsHtml`, `quoteSheetHtml`, `quotePrintCss`, `downloadQuotePdf`); hồi quy ở `src/features/crm/live/quote-print.test.ts`.
- **Kiểm chứng:** 13/13 test trong `quote-print.test.ts`, `rfq-print.test.ts`, `quote-payment-output.test.ts` qua. Edge headless xác nhận đúng một ô vàng trong bảng vận chuyển (`sum-row-value`), lưu ý một lần với `break-inside: avoid`, và không còn cột metric; đã xem ảnh mẫu và tạo PDF bằng trình duyệt.
- **Giới hạn:** khối lưu ý dài hơn toàn bộ một trang vẫn cần tách trang. Chưa kiểm tra máy in thực tế hoặc dữ liệu production; chưa chạy thử tải PDF tương tác. File Excel báo giá chưa đổi trong mục này.
