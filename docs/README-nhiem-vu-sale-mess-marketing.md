# Nhiệm vụ: Sale, Mess, Marketing

23/11/2026. Làm lần lượt theo bảng, mỗi nhiệm vụ một commit. Xong mục "Hoàn thành khi" mới sang nhiệm vụ tiếp theo.

| # | Nhiệm vụ | Trạng thái |
|---|----------|------------|
| 1 | Sale: tạo thẳng khách tiềm năng (không từ Mess) = khách tự tìm | ☑ 23/11 |
| 2 | Sale: tab Giao mục tiêu (tháng, tuần), cấu hình từng người, tải mẫu, import Excel | ☑ 23/11 |
| 3 | Sale: tab Báo cáo Sale (tuần, tháng, xử lý khách hàng L1–L8), chọn 1 người hoặc nhóm | ☑ 23/11 |
| 4 | Sale: link Sale với khách tiềm năng, báo giá, hợp đồng; link khách cũ từ datalake | ◐ migration 079 viết xong, chưa chạy |
| 5 | Sale: cho tạo hợp đồng chưa có báo giá | ☑ đã có sẵn |
| 6 | Sale: cho thanh toán lớn hơn giá trị hợp đồng | ☑ 23/11 |
| 7 | Mess: số liệu L cộng dồn | ☑ 23/11 |
| 8 | Marketing: quản trị mục tiêu tháng, tuần như Sale | ☑ 23/11 |

---

## 1. Tạo thẳng khách tiềm năng = khách tự tìm

1. Thêm nút **Thêm khách tiềm năng** ở màn Khách tiềm năng (Sale VN, Sale Global).
2. Khách tạo từ nút này không gắn Mess, tự gán nguồn **Tự tìm** (`SELF_SOURCED`) và Sale phụ trách là người tạo.
3. Cột **Khách tự tìm** có trong mục tiêu (nhiệm vụ 2) và báo cáo (nhiệm vụ 3).

**Hoàn thành khi:** Sale tạo 1 khách tự tìm → khách hiện trong danh sách tiềm năng, báo cáo của Sale đó tăng 1 ở cột Khách tự tìm.

---

## 2. Tab Giao mục tiêu

1. Tạo tab **Giao mục tiêu** gồm 2 tab con:
    - **Mục tiêu tháng được giao**
    - **Mục tiêu tuần**
2. Mỗi tab là bảng người × chỉ tiêu (Khách tự tìm, Khách tiềm năng, Tỷ lệ báo giá, Tỷ lệ chốt, Doanh số) cho kỳ đang chọn, sửa trực tiếp trong ô.
3. **Cài đặt**: cấu hình từng người được giao mục tiêu và các chỉ tiêu áp dụng cho người đó.
4. **Tải mẫu**: file Excel có sheet Tháng và sheet Tuần.
5. **Import Excel**: đọc file mẫu, báo lỗi theo dòng, import lại cùng kỳ thì cập nhật, không tạo trùng.
6. Lưu mục tiêu theo người (ID), loại kỳ (tháng/tuần), kỳ, chỉ tiêu. Bảng này dùng chung cho Marketing (nhiệm vụ 8).

**Hoàn thành khi:** giao mục tiêu tháng và tuần cho 2 Sale bằng tay và bằng import, báo cáo hiện đúng mục tiêu của từng người.

---

## 3. Tab Báo cáo Sale

Đã có trang `/bao-cao-sale` với 3 tab và bộ chọn người (commit `1990d0b`). Việc còn lại:

1. **Báo cáo tuần, Báo cáo tháng**: cột Mục tiêu lấy từ tab Giao mục tiêu (nhiệm vụ 2), thay cho KPI phòng chia đều như hiện tại.
2. **Báo cáo xử lý khách hàng**: các mức L1–L8, mỗi người có cột **Số lượng** và **Tỷ lệ** trên tất cả khách của người đó. Thêm số cộng dồn của nhiệm vụ 7.
3. **Kết quả phòng Sale** tự động trên OMS: tích chọn 1 người hoặc nhóm 2, 3 người. Chọn nhóm thì mục tiêu và kết quả cộng lại, tỷ lệ tính trên tổng của nhóm.

**Hoàn thành khi:** chọn 1 người, nhóm 2 người, nhóm 3 người, số liệu khớp tính tay trên 1 tuần và 1 tháng mẫu.

---

## 4. Link Sale với khách tiềm năng, báo giá, hợp đồng

Hiện chỉ link được Sale với Mess.

1. Khách tiềm năng, báo giá, hợp đồng tạo mới đều lưu Sale phụ trách (ID).
2. Báo giá, hợp đồng lấy Sale từ khách tiềm năng gốc.
3. Xem datalake để lấy khách tiềm năng cũ, link theo chuỗi `mess → rfq → order → contract` và gán Sale theo tên Sale trong datalake.
4. Bản ghi không xác định được Sale: xuất danh sách để gán tay.

**Hoàn thành khi:** mở 3 khách cũ thấy đúng Sale, báo giá, hợp đồng; báo cáo Sale tính được số liệu của khách cũ.

---

## 5. Tạo hợp đồng chưa có báo giá

Đã có nút tạo hợp đồng trực tiếp ở màn Hợp đồng (`DirectContractCreateDialog`).

1. Kiểm tra bằng tài khoản Sale VN, Sale Global: tạo được hợp đồng không cần báo giá.
2. Hợp đồng này vẫn tính vào doanh số báo cáo Sale.

**Hoàn thành khi:** Sale tạo được hợp đồng không có báo giá và doanh số hiện trong báo cáo.

---

## 6. Thanh toán lớn hơn giá trị hợp đồng

1. Bỏ chặn "thanh toán không được lớn hơn tổng giá trị" ở form và server:
    - `shared/src/crm.ts:523`, `shared/src/crm.ts:674`
    - `server/src/adapters/postgres/crm.repository.ts:2346`, `:2511`
    - `server/src/services/crm.service.ts:585`
    - `src/features/crm/live/contracts-live-view.tsx:981`
2. Phần còn lại âm thì hiện là khách trả dư, không tính là nợ.

**Hoàn thành khi:** lưu được thanh toán lớn hơn giá trị hợp đồng, màn hợp đồng và công nợ hiện đúng số dư.

---

## 7. Mess: số liệu L cộng dồn

Tính theo yêu cầu:

- Tư vấn = L1 + L2
- L3 = L1 + L2 + L3
- Tương tự các mức sau: L4 = L1 + … + L4, …, L8 = L1 + … + L8

1. Viết 1 hàm dùng chung tính số cộng dồn, dùng cho màn Mess và tab Báo cáo xử lý khách hàng.
2. Màn Mess: số đếm và danh sách của các nút lọc L1–L8 cũng cộng dồn (bấm L3 hiện Mess ở L1, L2, L3).
3. Báo cáo xử lý khách hàng: mỗi người chỉ có hai cột Số lượng và Tỷ lệ, số lượng của mỗi mức là số cộng dồn, tỷ lệ tính trên toàn bộ Mess của người đó.

**Hoàn thành khi:** với L1 = 5, L2 = 3, L3 = 2 → Tư vấn = 8, L3 = 10, trên cả màn Mess và báo cáo.

---

## 8. Marketing: mục tiêu tháng, tuần

Hiện Marketing nhập mục tiêu trên từng bài.

1. Tạo tab **Giao mục tiêu** Marketing giống Sale: 2 tab con Mục tiêu tháng, Mục tiêu tuần.
2. Cấu hình từng người trong Cài đặt, chỉ tiêu lấy từ danh mục KPI Marketing đã có.
3. Tải mẫu, import Excel như Sale.
4. Tổng hợp KPI Marketing hiện thêm Mục tiêu kỳ và % hoàn thành. Mục tiêu từng bài vẫn giữ.

**Hoàn thành khi:** giao mục tiêu tháng cho 1 người Marketing, Tổng hợp KPI hiện đúng mục tiêu, kết quả, % hoàn thành.

---

## Ghi chú triển khai (23/11/2026)

- **Migration mới** (đã đăng ký trong `server/src/scripts/migrate.ts`):
    - `077_hop_dong_thanh_toan_vuot.sql`: bỏ ràng buộc thanh toán ≤ giá trị hợp đồng.
    - `078_muc_tieu_theo_nguoi.sql`: bảng `app.kpi_targets` (mục tiêu theo người, tháng/tuần).
    - `079_lien_ket_sale_du_lieu_cu.sql`: điền Sale cho khách tiềm năng và hợp đồng cũ khi tên khớp đúng 1 tài khoản. **Sửa dữ liệu thật, chạy thử trên bản sao DB trước.**
- **Giao mục tiêu**: menu `Giao mục tiêu` (`/giao-muc-tieu`) và mục `Mục tiêu theo người` trong Cài đặt. Quyền: Admin, Ban GĐ (cả 3 nhóm), Trưởng Sale Global (Sale Global), Leader Marketing (Marketing). Báo cáo Sale ưu tiên mục tiêu giao riêng từng người; người chưa được giao thì dùng KPI phòng chia đều như trước.
- **Mess L cộng dồn**: nút lọc trên màn Mess và báo cáo xử lý khách hàng đều cộng dồn.
- **Khách tự tìm**: nút `Tạo khách tiềm năng` luôn đặt nguồn `Tự tìm`.
- **Marketing**: mục tiêu giao theo đúng các loại KPI của Giao việc (`app.marketing_kpi_settings`, migration `080` nới mã chỉ tiêu). Trang `Tổng hợp KPI` có khối "Mục tiêu so với kết quả" (tháng/tuần): mục tiêu giao riêng từng người so với kết quả đã nghiệm thu Đạt trong kỳ; KPI tối đa lấy trung bình, % = mục tiêu / kết quả. Chọn 1 người hoặc nhóm nhiều người như báo cáo Sale; từ 2 người có dòng "Tổng nhóm" (KPI tối thiểu cộng, KPI tối đa lấy trung bình). Mục tiêu nhập từng bài vẫn giữ nguyên.
- **Chưa làm**: màn gán tay Sale cho bản ghi datalake không xác định được người.

Kiểm tra: `pnpm check:targets`, `pnpm --filter @speego/server exec tsx --test src/config/targets.test.ts`.
