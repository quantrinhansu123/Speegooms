# Test giá gốc và các thay đổi báo giá/Data lạnh

Đối chiếu 2026-11-11, nhánh `feat/quote-original-cost`, nền `fdc1a3c`. Cả ba phần được tích hợp trong bản local này; chưa merge/push. Dùng **http://127.0.0.1:3002/login**. API 4002, PostgreSQL `127.0.0.1:55441/speego_quote_cost_local`, tách khỏi DB thật. Không dùng các cổng 3000/3001 cho checklist này.

## Tài khoản

Mật khẩu chung chỉ dành cho DB local: `speego@demo`.

| Vai trò | Email |
|---|---|
| Sourcing | sourcing@speego.vn |
| Logistics | logistics@speego.vn |
| Vận hành | vanhanh@speego.vn |
| Kế toán | ketoan@speego.vn |
| Sale VN | salevn@speego.vn |
| Admin | admin@speego.vn |

Đăng xuất rồi đăng nhập lại khi đổi vai trò, hoặc dùng các cửa sổ riêng tư tách biệt để giữ nhiều phiên.

## 1. Giá gốc Sourcing

1. Đăng nhập Sourcing, mở `/van-hanh/sourcing-bao-gia`, chọn tuyến Việt Nam.
2. Tìm khách `TEST-GIA-GOC-SOURCING`, mã `BGS-20261111-0001`. Bấm ba chấm → Báo giá → tab Sourcing.
3. Trong **Giá gốc nội bộ**, dòng Ghế mẫu có giá gốc **70.000 VND**, cách tính theo đơn vị. Giá bán vẫn 100.000 × 2 = 200.000 VND.
4. Đổi giá gốc thành 71.000 → Lưu → mở lại. Giá gốc giữ đúng; giá bán và tổng gửi khách không thay đổi. Nếu muốn cập nhật snapshot đã gửi, dùng nút gửi lại báo giá.

## 2. Giá gốc Logistics và FCL

1. Đăng nhập Logistics, mở `/van-hanh/logistics-bao-gia`, tuyến Việt Nam.
2. Mở `TEST-GIA-GOC-LOGISTICS`, mã `BGL-20261111-0001` → tab Logistics.
3. **Giá gốc nội bộ**: tổng giá gốc cước **450 USD**, giá gốc phụ phí địa chỉ **7 USD**. Giá bán cước 600 USD + phụ phí 10 USD = 610 USD vẫn giữ nguyên. Đổi giá gốc → Lưu → mở lại để kiểm tra.
4. Mở `TEST-GIA-GOC-FCL`, mã `BGL-20261111-0002`: dòng Ocean Freight có giá gốc **6.000 USD/cont**, giá bán 7.000 USD/cont. Thử sửa, lưu, mở lại tương tự.
5. Ngay mục Giá gốc nội bộ, chọn **Loại tiền cước / giá gốc** (ví dụ CNY): ô loại tiền cước bên dưới cũng đổi CNY. Đổi ở ô loại tiền cước thì mục giá gốc đổi theo. Lưu/mở lại phải giữ lựa chọn. FCL cũng có dropdown này. Đổi loại tiền giữ nguyên các con số, không tự quy đổi; nhập lại tỷ giá nếu cần.

## 3. Quyền xem và bản in

1. Kế toán mở được cả hai đường dẫn trên, thấy giá gốc nhưng các ô bị khóa, không có nút Lưu. API cũng chặn PATCH bằng 403.
2. Vận hành mở được cả hai bàn, xem/sửa theo quyền xử lý hiện có. Sourcing/Logistics vẫn chỉ xử lý các phiếu được phân công; không mở rộng phạm vi phiếu vì thêm giá gốc.
3. Sale VN mở `/sale-viet-nam/rfq`, tìm các mã trên, mở báo giá: không có mục/cột giá gốc. API Sale cũng không trả khóa `originalPrice` trong bản nháp, snapshot đã gửi hoặc phần Logistics lồng nhau. Sale sửa nội dung không xóa hay ghi đè giá gốc.
4. Từ báo giá, thử In, Tải PDF, Tải Excel (cả Việt/Anh): không có nhãn hoặc số tiền giá gốc. Giá bán, tổng chi phí vẫn đúng.
5. Phần sửa bản in trước đó cũng có trong bản local này: không còn cột kg/CBM/m²; trong bảng vận chuyển chỉ ô tổng logistics cuối cùng tô vàng. Lưu ý được giữ trong cùng một trang nếu chiều cao khối đủ một trang; có thể thêm nhiều mặt hàng để đẩy khối xuống ranh giới trang.

## 4. Data lạnh

1. Sale VN mở `/sale-viet-nam/data-lanh`: có Tạo khách hàng, Tải mẫu, Import Excel, Tải Excel.
2. Tạo khách tên `TEST-DATA-01`, SĐT thử → Lưu. Khách tự được giao cho Sale đang đăng nhập.
3. Tải mẫu → mở Excel → thêm tên/SĐT mới, để trống Mã khách hàng/STT; lưu .xlsx → Import Excel. SĐT nên để dạng Text. Một dòng SĐT trùng sẽ được bỏ qua; thiếu cả tên và SĐT sẽ báo dòng lỗi.
4. Tải Excel để kiểm tra dữ liệu. File lấy toàn bộ khách trong quyền xem, không áp dụng bộ lọc trên màn hình. Import lại file xuất không tạo thêm các dòng có Mã khách hàng.
5. Admin tạo/import thì khách vào danh sách chưa giao để chia vòng tròn. Intern/Ban GĐ chỉ có nút tải Excel, không tạo/import.

## Dữ liệu mẫu và kiểm chứng tự động

- Tạo mẫu: `node --import tsx server/src/scripts/seed-quote-cost-local.ts`. Script chỉ chấp nhận DB local có tên trên; chạy lại sẽ đặt lại các phiếu mẫu về giá ban đầu, không chạy khi người dùng đang sửa chúng.
- Kiểm thử trình duyệt thật + API/DB local: `node scripts/check-quote-original-prices.mjs`. Script đổi rồi khôi phục giá mẫu, kiểm tra API Sale không lộ giá gốc và không ghi đè được bằng payload giả; Kế toán bị chặn sửa.
- Kiểm thử Data lạnh qua browser fixture: `node scripts/check-data-lanh-excel.mjs`.
- Tài khoản test và giá trong checklist chỉ áp dụng cổng 3002, không áp dụng website online.
