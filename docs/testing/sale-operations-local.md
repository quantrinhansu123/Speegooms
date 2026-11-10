# Kiểm thử Sale → Sourcing/Logistics local

Chuẩn bị ngày 2026-11-10, nhánh `fix/sale-operations-data-flow`. Chỉ dùng database local `127.0.0.1:55442/speego_rfq_local`.

## Mở ứng dụng

- Frontend: http://127.0.0.1:3002/login
- Health qua frontend: http://127.0.0.1:3002/api/health — phải trả `status: ok`.
- Sale: `salevn@speego.vn`; Sourcing: `sourcing@speego.vn`; Logistics: `logistics@speego.vn`.
- Mật khẩu chung local: `speego@demo`.
- Giới hạn đăng nhập chỉ tính các lần thất bại: 10 lần trong 15 phút. Đăng nhập đúng để chuyển vai trò không dùng hết hạn mức. Đã kiểm tra 12 lượt đăng nhập thành công liên tiếp qua FE local và test riêng vẫn chặn lượt sai thứ 11.
- Dùng Chrome cho Sale, Edge cho Logistics, cửa sổ riêng tư cho Sourcing để không ghi đè cookie đăng nhập. Tất cả chọn tuyến Việt Nam.
- Sale: `/sale-viet-nam/mess`, `/sale-viet-nam/tiem-nang`, `/sale-viet-nam/rfq`.
- Sourcing: `/van-hanh/sourcing-bao-gia`; Logistics: `/van-hanh/logistics-bao-gia`.
- Mở phiếu vận hành: tìm mã trong bảng → nút ba chấm → Báo giá → chọn tab Logistics hoặc Sourcing.

## Phiếu sẵn để thử ngay

Các phiếu đã đi từ mess → tiềm năng → lưu đơn → bàn giao bằng API thật. Chưa nhập giá/chưa gửi. Tìm theo mã hoặc tên khách, bỏ bộ lọc ngày nếu không thấy.

| Tên khách | Mã báo giá | Dữ liệu | Kết quả cần thấy |
|---|---|---|---|
| TEST-FLOW-KG | BGL-20261110-0002 | 2 đơn vị × 25 kg, không có kiện | 50 kg |
| TEST-FLOW-AIR | BGL-20261110-0003 | 2 kiện, mỗi kiện 50×40×30 cm, 8 kg | 24 kg |
| TEST-FLOW-SEA | BGL-20261110-0004 | Cùng đóng gói như AIR, phương thức SEA/LCL | 20 kg; 0,12 CBM |
| TEST-FLOW-SOURCING | BGS-20261110-0010 | Đơn Sourcing có mặt hàng, quy cách, số lượng 2 và ghi chú | Sourcing đọc đủ; chuyển Logistics sau khi báo giá |
| TEST-FLOW-FCL | BGL-20261110-0005 | Shanghai → Los Angeles, Clothes, 5000 kg, 1×40HC | Mở form FCL, chuyển không đòi đóng gói từng kiện |

## 1. Tự đi từ đầu bằng giao diện

1. Sale vào Mess → Tạo mess. Tên khách `MANUAL-TEST-01`, thị trường Mỹ, nhu cầu Vận chuyển, chọn nguồn Logistics. Nhập các trường bắt buộc có dấu *.
2. Mở thông tin sản phẩm/đơn hàng: thêm mặt hàng, số lượng 2, cân tính cước 25 kg mỗi đơn vị; chưa thêm kiện. Lưu đơn rồi lưu mess.
3. Bấm Chuyển sang khách tiềm năng. Điền SĐT, đối tượng, kênh chăm sóc, địa chỉ, ghi chú, yêu cầu. Chọn SEA/LCL, điền trọng lượng hồ sơ, kích thước, địa chỉ nhận và lý do chuyển.
4. Nếu thiếu trường, phải báo lỗi tại ô. Điền đủ rồi Chuyển. Luồng chuyển sẽ tạo phiếu báo giá và đưa đơn nháp sang; ghi lại mã phiếu.
5. Logistics vào danh sách, tìm mã vừa tạo. Chờ tối đa khoảng 30 giây hoặc tải lại trang. Mở phiếu → Sale kiểm tra mặt hàng/số lượng/quy cách/ghi chú → Logistics kiểm tra cân 50 kg và địa chỉ gửi/nhận.
6. Trọng lượng dạng chữ ở hồ sơ chỉ là thông tin tham chiếu; số dùng tính cước phải nằm trong dòng hàng hoặc đóng gói.

## 2. Nhập giá → gửi Sale → in/tải → trả lại → gửi lại

1. Dùng TEST-FLOW-KG. Logistics → tab Logistics: hiệu lực 7 ngày, đơn vị Theo kg, tiền USD, tỷ giá VND 25000, giá/kg 12.
2. Cân phải là 50 kg, tiền cước 600 USD. Thêm phí chung 10 USD → tổng 610 USD. Cân không phải ô nhập trực tiếp ở Logistics.
3. Mở Thiết lập thanh toán; chọn tiền báo giá USD, tiền thanh toán USD và tài khoản nhận tiền đầy đủ. Nếu chọn VND thì nhập tỷ giá thanh toán; đó là trường riêng với tỷ giá tổng hợp VND.
4. Lưu, đóng rồi mở lại: giá, phí, ghi chú và tài khoản phải còn. Bấm Gửi báo giá và xác nhận. Nếu thiếu hiệu lực/thanh toán, sửa theo lỗi hiện trên form rồi gửi lại.
5. Sale vào Báo giá (RFQ), tìm cùng mã. Kiểm tra trạng thái đã có báo giá, chi phí và ghi chú vận hành. In/tải PDF/Excel bằng tiếng Việt: cân 50 kg, cước 600 USD, phí 10 USD, tổng 610 USD. Bản tiếng Anh cần nhập nội dung tiếng Anh trước.
6. Sale chọn Gửi lại báo giá (khách Sourcing kết hợp có Gửi lại Sourcing/Gửi lại Logistics). Vận hành phải thấy trạng thái yêu cầu báo giá lại.
7. Logistics đổi giá/kg thành 13, gửi lại. Tổng mới phải là 660 USD; hiệu lực tính lại từ lần gửi mới. Sale mở lại kiểm tra bản mới.

## 3. Kiện ưu tiên hơn cân nhập tay, AIR/SEA/CBM

1. Mở hai phiếu AIR và SEA ở trên: cân lần lượt 24 và 20 kg, cùng thể tích 0,12 CBM. Giá 12 USD/kg cho tiền cước lần lượt 288 và 240 USD.
2. Với SEA, chọn Theo CBM, giá 100 USD/CBM: cước 12 USD. Chọn Trọn gói rồi nhập tiền cước: không phụ thuộc cân/CBM.
3. Sale sửa thông tin đơn của TEST-FLOW-KG: thêm 1 kiện 10×10×10 cm, thực 20 kg. Lưu. Logistics mở lại: cân phải là 20 kg, không cộng thêm 50 kg nhập tay cũ. Ô cân dẫn xuất trong đơn có kiện không cho gõ đè.
4. Thử nhập thiếu kích thước của một kiện đã thêm: phải báo lỗi, không lưu một kiện không hợp lệ.

## 4. Sourcing → Logistics và cập nhật nội dung hàng

1. Sourcing mở BGS-20261110-0010. Kiểm tra tên hàng, số lượng 2, quy cách và ghi chú Sale. Nhập giá hàng, đóng gói (ví dụ 1 kiện 50×40×30 cm, 8 kg), chọn phương thức phù hợp nếu hồ sơ chưa có.
2. Nhập hiệu lực, hoàn thành thông tin còn thiếu theo lỗi form rồi Gửi báo giá. Bấm Gửi qua Logistics để thông báo cho bàn Logistics.
3. Logistics tìm khách TEST-FLOW-SOURCING trong danh sách tuyến Việt Nam. Kiểm tra nội dung hàng, ảnh nếu có, số lượng, đóng gói. Giá hàng Sourcing là tham chiếu; chi phí Logistics nhập riêng.
4. Logistics nhập cước và một phí chung, lưu. Ghi lại để kiểm tra không mất phí sau bước sau.
5. Sale mở RFQ của khách này hoặc Sourcing sửa đơn: đổi tên hàng, số lượng, quy cách, ghi chú; thêm một dòng; lưu. Mở lại Logistics: phải thấy đủ bản mới, các phí Logistics đã lưu vẫn còn.
6. Tiếp tục thử xóa một dòng, thay thứ tự, đổi mẫu đơn đang chọn. Logistics không được giữ dòng đã xóa hoặc gán giá của dòng cũ sang dòng mới. Kiểm tra cùng dữ liệu ở RFQ của Sale.
7. Với ghi chú cân/CBM và đặt cọc mà Sale được phép sửa: sửa, lưu, đóng rồi mở lại ở hai bàn; không được mất ghi chú.

## 5. Phiếu đang mở trong lúc Sale sửa

1. Giữ form Logistics đang mở. Ở cửa sổ Sale sửa/lưu một thông tin của đúng phiếu.
2. Chờ khoảng 30 giây. Form Logistics phải hiện thông báo có dữ liệu mới và nút Tải dữ liệu mới; nội dung đang gõ chưa bị tự xóa.
3. Bấm Tải dữ liệu mới: form dùng dữ liệu mới. Nút này bỏ thay đổi chưa lưu trong form, nên lưu/ghi lại phần đang nhập trước khi bấm nếu cần.

## 6. FCL

1. Sale mở TEST-FLOW-FCL ở RFQ → Sale: kiểm tra form lô hàng, sửa commodity/weight/volume, Lưu rồi Chuyển logistics. Không cần tạo đơn có kiện.
2. Logistics mở cùng phiếu → Logistics: thấy Shanghai, Los Angeles, trọng lượng và container; thêm dòng cước container và các phụ phí FCL.
3. Hoàn thành hiệu lực/thanh toán, lưu rồi Gửi báo giá. Sale xem/in bản FCL phải có cả thông tin lô hàng và phí.
4. Thử xóa commodity, weight hoặc volume rồi Chuyển logistics: phải báo thiếu dữ liệu. Nhập lại và chuyển thành công.

## Giới hạn phiên local

- Đã kiểm tra API thật cho 5 bộ dữ liệu và kiểm tra trình duyệt Edge headless cho cân 50/24/20 kg, tiền cước 600 và form FCL. Các bước gửi/trả lại/tải file ở trên để người dùng tiếp tục kiểm tra; chưa khẳng định đã thao tác hết bằng UI.
- Chưa bật upload ảnh lên Cloudinary ở phiên local để không ghi tài sản lên dịch vụ thật. Nội dung ảnh có sẵn trong dữ liệu/API vẫn theo cơ chế hiện tại.
- Phạm vi này kết thúc ở báo giá và báo giá lại, chưa phải nghiệm thu giao hàng/kế toán/quyết toán. Không dùng thông tin tài khoản ngân hàng thật khi thử.
