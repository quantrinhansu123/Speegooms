# Báo giá Logistics theo mặt hàng và giá gốc

- Phạm vi/từ khóa: đơn vị tính cước, kg/CBM/mặt hàng/trọn gói, giá gốc, doanh thu, lợi nhuận.
- Đối chiếu: 2026-11-12, phần cước/giá gốc đã push `main` ở `1652f86` (feature `74a39ee`); markup bổ sung trên `feat/logistics-markup` từ nền `1652f86`, chốt bàn giao vào `main` và push theo yêu cầu. Chưa xác nhận deployment.

## Quyết định và dữ liệu

- `freight.basis = item` dùng các dòng `logisticsFees` gắn `itemStt`: loại tiền riêng, `vndRate`, `rate`, `weightKg`, tổng ở `value`. Đơn giá × cân tính cước tự điền tổng; vẫn cho nhập tổng trực tiếp. Cân mặc định lấy từ quy cách đóng gói/số lượng hiện tại; sau khi nhập được lưu riêng theo dòng.
- `originalPrice` của cước và phụ phí vẫn là tổng giá gốc để tương thích dữ liệu cũ. `originalDetails` bổ sung loại tiền, tỷ giá, đơn giá và lượng tính cước riêng. FCL giữ giá gốc theo đơn vị, tổng = giá gốc × lượng + VAT như bảng FCL hiện có.
- Giá gốc vàng nhạt, giá báo Sale xanh nhạt. Lợi nhuận quy về VND = giá báo Sale − giá gốc. Ba cột ngoài danh sách dùng bản nháp hiện tại của bàn Logistics; không lấy doanh thu từ bản gửi cũ rồi trừ giá gốc mới. Đây là doanh thu báo giá, không phải tiền đã thu.
- Thiếu giá gốc/tỷ giá/dòng mặt hàng thì không coi là 0; danh sách hiện chưa đủ dữ liệu. Lưu/gửi chế độ theo mặt hàng yêu cầu đủ đơn giá, cân và tổng cho từng mặt hàng, cùng tỷ giá ngoại tệ.
- Chuyển sang kg/CBM/trọn gói giữ dữ liệu chi tiết mới của mặt hàng nhưng loại khỏi tổng bằng `activeLogisticsFees`. Phí mặt hàng dạng cũ chưa có chi tiết mới vẫn tính như trước. `both` chỉ đọc tương thích báo giá cũ.
- HTML/PDF/Excel có đơn giá và cân theo mặt hàng, cộng riêng từng loại tiền. Tỷ giá VND và giá gốc không in ra khách. Middleware loại cả `originalPrice` và `originalDetails` khỏi request/response của vai trò không được xem giá gốc; ba cột tài chính chỉ hiện theo quyền đó.
- Dữ liệu nằm trong JSON báo giá hiện có; không cần migration DB. Repository phải giữ các trường mới cho cả bản nháp và snapshot đã gửi, trên cả tuyến VN/Global.

## Markup (2026-11-12)

- Markup (%) = (giá báo Sale − giá gốc) / giá gốc × 100, không phải tỷ suất lợi nhuận trên doanh thu. Giá gốc thiếu hoặc bằng 0 hiển thị “—”; không chia cho 0.
- Mặc định nhập theo từng dòng trong bảng giá gốc Logistics; nhập % rồi rời ô hoặc nhấn Enter để áp dụng. Không tự thay giá bán chỉ vì sửa giá gốc. Phần trăm được tính lại từ các số tiền hiện có, không lưu thêm một trường tỷ lệ dễ lệch dữ liệu.
- Khác loại tiền: quy đổi giá gốc sang tiền báo Sale trước khi áp dụng %. Cước kg/CBM/trọn gói ghi tổng và bật totalManual; phí mặt hàng ghi tổng và đơn giá tương ứng với lượng tính cước của Sale. FCL tính markup trên tổng gồm VAT, giữ nguyên VAT, cập nhật đơn giá; từ chối tổng nhỏ hơn VAT để không tạo đơn giá âm.
- Danh sách thêm Markup (%) theo tổng giá gốc/doanh thu VND của bản nháp. Chỉ hiện cho vai trò được xem giá gốc. Kế toán chỉ đọc; Sale không thấy markup. HTML/PDF/Excel giữ nguyên các cột công khai, không in tỷ lệ nội bộ.
- Nguồn: helper quoteMarkupPercent/quoteAmountWithMarkup trong shared/src/quote-amounts.ts, component quote-markup-input.tsx và các bảng giá hiện có.
- Kiểm chứng markup: 97 tests liên quan qua; FE/BE TypeScript và lint ba component bảng/markup qua. Fixture Edge thật qua kg/CBM/trọn gói/both cũ, mặt hàng USD/CNY, FCL gồm VAT và từ chối giá âm, Kế toán bị khóa và Sale không có ô markup. Chưa ghi đơn thật vào DB production.

## Nguồn và kiểm chứng

- Schema: `shared/src/crm.ts`; tổng tiền/validation/tài chính: `shared/src/quote-amounts.ts`; bản in: `shared/src/quote-sheet-model.ts`.
- UI: `src/features/crm/live/freight-pricing-table.tsx`, `quote-editor.tsx`, `quote-original-prices.tsx`, `quotes-view.tsx`; xuất file: `quote-print.ts`, `quote-excel.ts` cùng thư mục.
- Lưu/đọc và quyền: `server/src/adapters/postgres/crm.repository.ts`, `server/src/middlewares/quote-original-price.ts`.
- 95 tests qua: `logistics-item-freight`, `quote-original-price`, `quote-payment`, `quote-sheet`, `quote-workflow` ở `server/src/config` và `src/features/crm/live/quote-original-prices.test.ts` (tsx --test).
- Typecheck frontend (sau `next typegen`) và backend qua. ESLint hai component bảng giá qua; các lỗi lint sẵn có trong editor/list được đối chiếu với `main`, không sửa ngoài phạm vi.
- Fixture trình duyệt Edge headless qua: nhập đơn giá tính tổng, giá gốc và giá Sale khác loại tiền, sửa tỷ giá, lợi nhuận âm. Chưa kiểm tra luồng đăng nhập/lưu trên DB production hoặc triển khai Vercel.
