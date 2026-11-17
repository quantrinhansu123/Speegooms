# Nhiệm vụ: Báo giá ↔ Hợp đồng ↔ Logistics

17/11/2026. Làm **lần lượt từng nhiệm vụ**, mỗi nhiệm vụ một nhánh/commit riêng, xong mục "Hoàn thành khi" mới sang nhiệm vụ tiếp theo.

| # | Nhiệm vụ | Phạm vi | Trạng thái |
|---|----------|---------|------------|
| 1 | Nối báo giá (rfq) với hợp đồng trên datalake để hợp đồng có đủ Sourcing | Datalake + kiểm tra app | ☐ |
| 2 | In hình + kích thước trên báo giá **thuần Logistics** khi Sale đã điền đủ | App (bản in/PDF/Excel) | ☑ 17/11 |
| 3 | Sale điền **cân nặng quy đổi** → tự nối sang cân nặng thực tế, cho Sale xuất báo giá | App (form Sale + chặn xuất) | ☑ 17/11 |

---

## Nhiệm vụ 1 — Datalake: hợp đồng thiếu Sourcing

### Hiện trạng (đã kiểm tra, chỉ đọc)

- Sheet: `data-lake-speego` (link trong yêu cầu). Chuỗi khóa: `mess.mess_id → rfq.mess_id`, `rfq.rfq_id → order.rfq_id`, `order.order_id → contract.order_id`.
- Tab `order`: **31/45 dòng có `rfq_id` trống** (ví dụ `OD-S00-260802-001`, `OD-S00-260731-001`). Mất mắt xích này nên `contract` không lần được về `rfq`/`rfq_price` (tên hàng, quy cách, cân nặng, giá Sourcing).
- Tab `contract` không có cột `rfq_id`; chỉ nối qua `order_id`. Nguồn của nhiều dòng là file `HỢP ĐỒNG SOURCING + VC`, file này không ghi mã báo giá.
- Script ETL (`tools/37_...py`, `tools/...`) **không nằm trong repo này**, cần lấy từ chủ tài khoản quản trị datalake.

### Việc cần làm

1. Lấy script ETL datalake; tìm chỗ dựng tab `order` (cột `rfq_id`).
2. Bổ sung luật ghép khi sheet nguồn không ghi mã báo giá, theo thứ tự ưu tiên, dừng ở luật đầu tiên khớp **đúng 1** rfq:
   1. Mã báo giá ghi trong ghi chú/tên hàng (regex `RQ-S\d+-\d{6}-\d{3}`, `BGS-\d{8}-\d{4}`).
   2. `customer_id` trùng + `ten_hang` gần giống (chuẩn hóa: bỏ dấu, lowercase, bỏ khoảng trắng thừa) + `ngay_bao_gia <= ngay_ky`.
   3. Khớp >1 hoặc 0 rfq → **để trống**, ghi `kiem_tra = "thieu_rfq"` (không đoán).
3. Thêm cột `contract.rfq_id` (lấy qua `order`) để báo cáo không phải join 2 bước.
4. Chạy lại ETL (theo README datalake: không xóa dòng, script chạy lại được).
5. Với dòng vẫn `thieu_rfq`: xuất danh sách cho Sale điền mã báo giá vào sheet nguồn.

### Kiểm tra phía app (cùng triệu chứng)

App lưu liên kết ở `crm.hop_dong.ma_bao_gia`. `createContract` (`server/src/adapters/postgres/crm.repository.ts:2182`) đã đọc báo giá Sourcing + `logisticsSheet`. Ghi chú `docs/checkpoints/crm/contract-source-type.md` còn mở lỗi in `/quotes/null/contract-source`. Đếm số hợp đồng `ma_bao_gia is null` trên DB (chỉ đọc). Nếu > 0 thì tách thành việc riêng, **không** sửa dữ liệu khi chưa được duyệt.

### Hoàn thành khi

- Tỷ lệ `order.rfq_id` trống giảm, mỗi dòng còn trống đều có `kiem_tra = thieu_rfq`.
- Kiểm tay 3 hợp đồng mẫu (`OD-S00-260802-001`, `OD-S00-260731-001`, một dòng `RQ-S02-…`): lần được tên hàng/giá Sourcing từ `contract`.

---

## Nhiệm vụ 2 — In hình và kích thước cho báo giá thuần Logistics

### Hiện trạng

- Sale nhập cho khách Logistics ở `src/features/crm/live/potential-view.tsx:576-580`: **Kích thước kiện hàng** và **Trọng lượng** là ô chữ tự do (`weightKg`, dimensions). Chưa có trường ảnh.
- Trong editor, khối đóng gói bị ẩn với thuần Logistics: `quote-editor.tsx:2581` và `:3186` (`quote.customerKind !== "LOGISTICS"`).
- Bản in đã có sẵn cột ảnh và quy cách (`quote-print.ts:146-159`, `shared/src/quote-sheet-model.ts:259,273`), nhưng chỉ lấy theo **dòng hàng** (`QuoteLine.images`, `spec`, `packages`). Thông tin Sale điền ở khách tiềm năng không đổ vào dòng hàng nên không lên bản in.

### Việc cần làm (ưu tiên dùng lại, không tạo bản in mới)

1. Xác nhận Sale điền ảnh/kích thước ở đâu (khách tiềm năng hay tab "Thông tin đơn hàng" `quote-editor.tsx:2604`). Nếu ở tab đơn hàng thì dữ liệu đã nằm trong `QuoteLine`, chỉ cần bỏ điều kiện ẩn.
2. Nếu ở khách tiềm năng: khi Sale bàn giao đơn Logistics (`handoffOrder("logistics")`), chép ảnh + kích thước vào dòng hàng (`images`, `packages`) của báo giá Logistics.
3. "Điền đầy đủ" = mỗi dòng có ≥1 ảnh **và** mỗi kiện có D×R×C. Thiếu thì bản in giữ như hiện tại (không in ô trống).
4. Áp dụng cho cả In, PDF, Excel (`quote-print.ts`, `quote-excel.ts`) vì chúng dùng chung `buildQuoteSheet`.

### Kiểm thử

- Thêm ca vào `src/features/crm/live/quote-print.test.ts`: khách `LOGISTICS`, dòng có ảnh + kiện → HTML có `<img` và chuỗi kích thước. Dòng thiếu → không có.
- Chụp màn hình bản in (có sẵn mẫu `scripts/screenshots/e54-quote-print.ts`).

### Hoàn thành khi

Báo giá thuần Logistics Sale đã điền đủ in ra có ảnh + kích thước trên cả In/PDF/Excel. Báo giá Sourcing không đổi.

---

## Nhiệm vụ 3 — Cân nặng quy đổi → cân nặng thực tế, cho Sale xuất báo giá

### Hiện trạng

- Công thức kiện: `orderPackageMetrics`/`packageMetrics` (`src/services/crm/quote-lines.ts`) tính `actualKg`, `cbm`, `chargeableKg` = max(cân thực, cân thể tích = D×R×C / `VOLUMETRIC_DIVISOR`). Xem `quote-editor.tsx:982`.
- Ô cân tính cước trong phần cước chỉ đọc (`quote-editor.tsx:207`). Chặn gửi khi kiện thiếu kích thước hoặc kg/kiện (`docs/bao-gia-sourcing-logistics.md`).
- Chặn xuất: `quoteOutputProblem` (`src/features/crm/live/quote-sheet.ts`).

### Cần chốt với người yêu cầu trước khi code

- "Cân nặng quy đổi" là **cân tính cước** (Sale đã tự quy đổi) hay **cân thể tích**? README này giả định là *cân tính cước Sale nhập tay khi không có số đo kiện*.
- "Link sang cân nặng thực tế" = chép số vào ô cân thực khi ô đó còn trống (không ghi đè số Sale/Sourcing đã nhập).

### Việc cần làm

1. Trong form Sale đơn Logistics: khi có cân quy đổi và chưa có cân thực → dùng cân quy đổi làm `actualKg`/`chargeableKg` (một chỗ, trong hàm tính metrics, không rải ở từng caller).
2. Nới `quoteOutputProblem` và luật chặn gửi: Sale được xuất khi **có cân quy đổi** dù thiếu D×R×C. Các trường hợp thiếu khác vẫn chặn.
3. Bản in ghi rõ "Cân tính cước (Sale quy đổi)" để không nhầm với cân đã đo.

### Kiểm thử

- Test đơn vị cho hàm metrics: chỉ có cân quy đổi → `chargeableKg` = số đó. Có cả cân thực → giữ cân thực.
- Test `quoteOutputProblem`: thiếu kích thước + có cân quy đổi → không chặn. Thiếu cả hai → chặn.

### Hoàn thành khi

Sale nhập cân quy đổi, ô cân thực tự có số, nút Xuất báo giá bật, bản in hiện đúng cân và cước.

---

## Quy ước chung

- Đọc `node_modules/next/dist/docs/` trước khi sửa frontend (xem `AGENTS.md`).
- Không sửa Supabase/`.env`/dữ liệu production khi chưa được duyệt.
- Chạy typecheck + test liên quan trước mỗi commit. Chỉ push lên `origin` (quantrinhansu123/Speegooms).
