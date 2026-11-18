# Nhiệm vụ: Kế toán, hợp đồng và sổ thu chi

18/11/2026. Làm **lần lượt từng nhiệm vụ**. Nhiệm vụ 1 làm trước vì kế toán đang bị chặn. Nhiệm vụ 2–4 sửa chung hai file (`ke-toan-list-search.ts`, `ledger-live-view.tsx`) nên gộp được một commit. Chỉ chuyển sang nhiệm vụ tiếp theo khi đã đạt mục "Hoàn thành khi".

| # | Nhiệm vụ | Phạm vi | Trạng thái |
|---|----------|---------|------------|
| 1 | Không cho xóa hợp đồng nữa; khôi phục HD-20261109-0034 (Lưu Hương) để kế toán nhập thu chi | Quyền + UI CRM + dữ liệu | ◐ 18/11: code xong; còn khôi phục dữ liệu |
| 2 | Xem tổng thu, tổng chi trong 1 tháng | UI sổ thu chi | ☑ 18/11 |
| 3 | Lọc theo **ngày giao dịch** (hiện chỉ lọc được theo ngày ghi sổ) | API search + UI | ☑ 18/11 |
| 4 | Xem tổng thu chi của **1 đối tượng** | API search + UI | ☑ 18/11 (ô nhập chữ, chưa có gợi ý) |

---

## Nhiệm vụ 1: Cấm xóa hợp đồng, xử lý HD-20261109-0034

### Hiện trạng (đã đọc code)

- Quyền xóa: `"contract.delete": ["ke-toan"]` (`server/src/config/permissions.ts:38`). Route: `router.delete("/contracts/:id", requirePermission("contract.delete"), …)` (`server/src/routes/crm.routes.ts:57`).
- Xóa là **xóa hẳn**: `deleteContract` (`server/src/adapters/postgres/crm.repository.ts:2437`) đưa báo giá Sourcing/Logistics về `trang_thai_hop_dong = 'CHUA_TAO'`, sau đó `delete from crm.hop_dong`. Không có bản ghi lịch sử hay xóa mềm.
- Nút "Xóa" chỉ hiện ở màn kế toán: `canDelete = mode === "accounting" && user.role === "ke-toan"` (`src/features/crm/live/contracts-live-view.tsx:415`), menu ở `:777`, hộp xác nhận ở `:806`.
- Ô "Đơn hàng" khi nhập thu chi lấy dữ liệu từ `listLedgerOrders` (`server/src/adapters/postgres/ledger.repository.ts:118`): `select … from crm.hop_dong order by tao_luc desc limit 500`. Vì vậy:
  - hợp đồng đã xóa thì **không còn trong danh sách**, đây là nguyên nhân khả năng cao nhất;
  - khi có hơn 500 hợp đồng, hợp đồng cũ cũng không tìm được. HD-20261109 mới tạo nên ít khả năng rơi vào trường hợp này.
- `ke_toan.so_thu_chi.ma_don_hang` và `ke_toan.sao_ke.ma_don_hang` nối với hợp đồng bằng `left join … on h.ma_hien_thi = l.ma_don_hang`, **không có khóa ngoại**. Dòng thu chi của hợp đồng đã xóa vẫn còn, chỉ mất tên khách.

### Việc cần làm

1. **Chặn xóa ở API** (đây là chỗ chặn thật): sửa `"contract.delete": []` trong `server/src/config/permissions.ts`. Giữ nguyên route để trả 403 rõ ràng, không cần thêm cơ chế xóa mềm.
2. **Bỏ nút Xóa ở UI**: trong `contracts-live-view.tsx`, bỏ `canDelete`, mục menu `delete`, state `removing`, hàm gọi `DELETE` (`:580`) và `ConfirmDialog` "Xóa hợp đồng?". Xóa luôn `deleteContract` ở controller/service/repository nếu không còn chỗ nào gọi (kiểm tra bằng `grep -rn deleteContract server/src`).
3. **Kiểm tra DB (chỉ đọc)**:
   ```sql
   select id, ma_hien_thi, ten_khach_hang, ma_bao_gia, tao_luc
     from crm.hop_dong where ma_hien_thi = 'HD-20261109-0034';
   select id, ngay, loai, so_tien, ma_don_hang
     from ke_toan.so_thu_chi where ma_don_hang = 'HD-20261109-0034';
   ```
4. **Nhánh A: hợp đồng vẫn còn trong DB** (lỗi do giới hạn 500): chuyển ô "Đơn hàng" sang tìm phía server. Thêm `?q=` vào `GET /api/ke-toan/ledger-orders`, lọc `ma_hien_thi ilike` hoặc `ten_khach_hang ilike`, `limit 50`. Combobox gọi API theo chữ người dùng gõ.
5. **Nhánh B: hợp đồng đã bị xóa**:
   1. Tìm báo giá gốc của khách Lưu Hương (trạng thái `CHUA_TAO`, ngày quanh 09/11/2026).
   2. Sale **tạo lại hợp đồng** từ báo giá đó qua app (`createContract`). Không insert tay vào DB.
   3. Hợp đồng mới sẽ có mã mới. Nếu đã có dòng thu chi/sao kê ghi theo mã cũ thì cập nhật sau khi được duyệt:
      ```sql
      update ke_toan.so_thu_chi set ma_don_hang = '<mã mới>' where ma_don_hang = 'HD-20261109-0034';
      update ke_toan.sao_ke     set ma_don_hang = '<mã mới>' where ma_don_hang = 'HD-20261109-0034';
      ```
   4. Báo kế toán mã mới.

### Kết quả kiểm tra DB (18/11, chỉ đọc)

- `crm.hop_dong` có 45 bản ghi, **không còn HD-20261109-0034** → hợp đồng đã bị xóa (nhánh B). Nhánh A (giới hạn 500) không áp dụng, bỏ.
- `ke_toan.so_thu_chi` còn 2 dòng THU_KHACH của Lưu Hương gắn mã này: 141 (17/10/2026) và 141 (25/10/2026).
- **Còn tồn đọng:** Sale tạo lại hợp đồng → báo mã mới → đổi `ma_don_hang` của 2 dòng trên (cần duyệt).

### Hoàn thành khi

- Đăng nhập role `ke-toan`: không còn nút Xóa; gọi `DELETE /api/crm/contracts/:id` trả 403.
- Kế toán tìm được hợp đồng của Lưu Hương trong ô "Đơn hàng" và lưu được dòng thu chi.

---

## Nhiệm vụ 2: Tổng thu, tổng chi trong 1 tháng

### Hiện trạng

- API đã tính tổng theo đúng bộ lọc hiện tại: `summary.thu`, `summary.chi` tính bằng VND (`ledger.repository.ts:69`).
- UI đã hiển thị tổng (`ledger-live-view.tsx:235–236`).
- Muốn xem một tháng thì hiện phải tự chọn "từ ngày" và "đến ngày". Việc còn thiếu chỉ là thao tác nhanh.

### Việc cần làm

1. Thêm `<input type="month">` "Tháng" cạnh ô ngày trong `ListSearchBar` của sổ thu chi (`ledger-live-view.tsx:281`). Khi chọn `YYYY-MM`, gán `from = YYYY-MM-01` và `to =` ngày cuối tháng (`new Date(y, m, 0).getDate()`).
2. Tổng tháng tính theo cột ngày đang chọn ở nhiệm vụ 3 (ngày ghi sổ hoặc ngày giao dịch).
3. Không thêm API mới.

### Hoàn thành khi

- Chọn tháng 11/2026 thì danh sách và tổng thu/chi chỉ gồm các dòng từ 01/11 đến 30/11.
- Đối chiếu tổng với file Excel xuất (`LedgerExcelActions`) cùng bộ lọc: hai con số bằng nhau.

---

## Nhiệm vụ 3: Lọc theo ngày giao dịch

### Hiện trạng

- Cột `ke_toan.so_thu_chi.ngay_giao_dich` đã có, form đã nhập được (`ledger-live-view.tsx:114`), bảng đã hiển thị.
- Bộ lọc khoảng ngày đang cố định theo ngày ghi sổ: `new DateRangeCriterion(sql("l.ngay"), input.from, input.to, "date")` (`server/src/search/ke-toan-list-search.ts:28`). Nhãn UI là `dateLabel="Ngày ghi sổ"`.

### Việc cần làm

1. `LedgerListSearch` thêm `dateField: string`. Trong `ledgerSearch`, chọn cột theo **danh sách cho phép**, không ghép chuỗi từ request:
   ```ts
   const dateColumn = input.dateField === "transaction" ? sql("l.ngay_giao_dich") : sql("l.ngay");
   .add(new DateRangeCriterion(dateColumn, input.from, input.to, "date"))
   ```
2. Controller đọc `dateField` từ query (mặc định là ngày ghi sổ).
3. UI: `useAppliedSearch({ …, dateField: "" })`, thêm `FilterSelect` "Lọc theo ngày" với hai lựa chọn `[["", "Ngày ghi sổ"], ["transaction", "Ngày giao dịch"]]`. Đổi `dateLabel` theo lựa chọn.
4. Dòng có `ngay_giao_dich` trống sẽ **không** xuất hiện khi lọc theo ngày giao dịch. Đây là hành vi đúng, ghi vào hint để kế toán biết.
5. Thêm test vào `server/src/search/ke-toan-list-search.test.ts`: `dateField = "transaction"` sinh SQL có `l.ngay_giao_dich`; giá trị lạ thì dùng `l.ngay`.

### Hoàn thành khi

- Một dòng có ngày ghi sổ 01/11 và ngày giao dịch 28/10: lọc tháng 10 theo ngày giao dịch thì thấy dòng này, lọc tháng 10 theo ngày ghi sổ thì không thấy.
- Test search chạy qua.

---

## Nhiệm vụ 4: Tổng thu chi của 1 đối tượng

### Hiện trạng

- Gõ tên vào ô tìm kiếm thì tổng thu/chi đã tính theo kết quả lọc. Nhưng ô này **khớp gần đúng trên 5 cột** (`doi_tuong`, `ma_don_hang`, `ten_khach_hang`, `ma_tham_chieu`, `tai_khoan_nhan`). Ví dụ tìm "Hương" sẽ ra cả "Lưu Hương" lẫn "Nguyễn Hương", và cả dòng có tên khách chứa chữ đó. Tổng vì vậy có thể sai.

### Việc cần làm

1. `LedgerListSearch` thêm `counterparty: string`, lọc **khớp chính xác**: `.add(new ExactMatchCriterion(sql("l.doi_tuong"), input.counterparty))`.
2. API gợi ý: `GET /api/ke-toan/ledger-counterparties?q=` trả `select distinct doi_tuong from ke_toan.so_thu_chi where doi_tuong ilike $1 order by 1 limit 50` (quyền `ledger.read`).
3. UI: thêm Combobox "Đối tượng" trong `ListSearchBar` (dùng lại kiểu Combobox của ô "Đơn hàng"). Khi đã chọn đối tượng, ô tổng hiển thị thêm "Thu – Chi = Còn lại".
4. Kết hợp được với nhiệm vụ 2 và 3. Ví dụ: tổng thu chi của "Lưu Hương" trong tháng 11 theo ngày giao dịch.
5. Thêm test: `counterparty` sinh điều kiện `l.doi_tuong = $n`.
6. Bảng gom nhóm tổng theo từng đối tượng: **chưa làm**, chỉ làm khi kế toán yêu cầu.

### Hoàn thành khi

- Chọn đối tượng "Lưu Hương": chỉ hiện dòng có `doi_tuong` đúng bằng "Lưu Hương", tổng khớp với câu SQL `sum(so_tien_vnd)` cùng điều kiện.
- Lưu ý: tên đối tượng nhập tay nên có thể không thống nhất ("Lưu Hương" và "Luu Huong"). Nếu kế toán cần gộp các tên này thì tách thành việc riêng (chuẩn hóa tên khi nhập).
