# SpeeGo API Integration Guide

Tài liệu bàn giao cho Backend và FE. Ứng dụng hiện chạy hoàn toàn bằng seed JSON và localStorage;
chưa có API nghiệp vụ, xác thực production hoặc đồng bộ nhiều người dùng. Các endpoint và response
bên dưới là **đề xuất hợp đồng tích hợp**, cần hai đội thống nhất trước khi triển khai.

## 1. Điểm thay thế trong mã nguồn

| Phần | Hiện tại | Khi tích hợp |
|---|---|---|
| Đăng nhập/session | `src/lib/session.ts`, `src/features/auth/actions.ts`, `src/proxy.ts` | Session/token thật, thu hồi session, kiểm tra quyền phía server |
| Quyền menu/route | `src/config/roles.ts`, `src/components/shared/route-gate.tsx` | Hiển thị theo capabilities từ server; API vẫn kiểm quyền độc lập |
| Quyền thao tác | `src/config/permissions.ts`; các config module giữ export tương thích | Map permission codes từ server, giữ UI và action cùng đọc một nguồn |
| CRM | `src/services/crm/repository.ts`, `src/features/crm/store.ts` | Load tài nguyên theo scope; gọi từng command, nhận trạng thái server |
| Vận hành | `src/services/ops/repository.ts`, `src/features/operations/store.ts` | Commands sourcing, PO, logistics, chứng từ |
| Kho/giao hàng | `src/services/fulfillment/repository.ts`, `src/features/fulfillment/store.ts` | Nhập kho, tồn kho, giữ chỗ, pick/pack, POD |
| Kế toán | `src/services/accounting/repository.ts`, `src/features/accounting/store.ts` | Thu/chi, duyệt, đối soát và quyết toán có transaction |
| Marketing/HRM/khiếu nại/pháp chế | `src/features/backoffice/store.ts`, `src/types/backoffice.ts` | Tách endpoint theo tài nguyên; không gửi toàn bộ snapshot liên phòng |
| Dashboard/Reports | `src/features/reports/use-platform-data.ts`, `src/services/reports/rules.ts` | Endpoint aggregate có scope, filter và công thức đã chốt |

Các store hiện gọi `save(snapshot)` để lưu localStorage. **Không chuyển cách này thành PUT toàn bộ
snapshot lên server**: sẽ ghi đè thay đổi của người khác và cho phép sửa trường không được cấp quyền.
Thay mỗi action bằng command API, sau thành công cập nhật cache hoặc tải lại tài nguyên liên quan.

## 2. Dữ liệu và khóa liên kết

DTO hiện có trong `src/types/crm.ts`, `ops.ts`, `fulfillment.ts`, `accounting.ts` dùng snake_case.
FE dùng camelCase qua `src/services/crm/adapters.ts` (`camelizeKeys`, `snakeizeKeys`, snapshot adapters).
Backoffice hiện dùng camelCase trong model; DTO Backend tương ứng vẫn cần thống nhất.

- Lead `mess_id` → RFQ `rfq_id` → báo giá `quote_id` → hợp đồng/đơn `order_id`; khách là `customer_id`.
- Sourcing `request_id` → `quote_id` của NCC → `po_id` → `shipment_id`.
- Kho `receipt_id` → `package_id` → `outbound_id` → `delivery_id`; receipt liên kết lô hàng.
- Thu/chi `payment_id`, `receipt_id` khoản thu, `line_id` sao kê; quyết toán gắn `order_id`.
- ID do server cấp, bất biến. Không dùng thuật toán `nextSeq`/số lượng bản ghi phía FE để sinh ID thật.
- Phân biệt `quote_id` khách và `quote_id` NCC trong endpoint hoặc đặt tên trường rõ ràng.
- Trạng thái và enum hiện có là danh mục tham chiếu để bàn giao, không phải toàn bộ nghiệp vụ đã duyệt.

Ngày nghiệp vụ (`due_on`, `signed_on`, `etd`, `eta`) dùng `YYYY-MM-DD`. Sự kiện (`created_at`, `at`)
nên dùng ISO 8601 có timezone/UTC theo thỏa thuận. Demo còn dùng ngày cố định 28/10/2026 và timestamp
không timezone; không đưa cách tạo thời gian demo lên production. FE đang lọc theo phần ngày của dữ liệu;
Backend cần chốt timezone báo cáo, đề xuất `Asia/Ho_Chi_Minh`.

Tiền có `amount` và `currency`, không cộng VND với USD. Chốt số nguyên đơn vị nhỏ nhất hoặc decimal
string và quy tắc làm tròn tại API boundary. CRM có VND/USD nhưng mô hình thu/chi và công nợ demo chỉ
được kiểm chứng cho VND; báo cáo công nợ loại hợp đồng ngoại tệ thay vì giả định tỷ giá.

## 3. Xác thực và quyền

Cookie demo `speego_demo_session` chỉ chứa ID, không ký; mật khẩu chung được công khai tại Demo Guide.
`proxy.ts` chỉ hỗ trợ điều hướng demo. Không dùng cookie/password này cho production.

Backend phải kiểm tra session, tenant, role/capability, tuyến và quyền trên **từng bản ghi** cho mọi
request đọc, ghi, tải tệp, aggregate và export. Không tin `actor_id`, `role`, `tenant_id`, giá trị đã
tính, trạng thái hoặc scope gửi từ FE. Actor lấy từ session server. Sale VN/Global hiện lọc theo
tuyến của dữ liệu; cần chốt thêm quyền sở hữu cá nhân/nhóm. HRM và pháp chế cần scope dữ liệu riêng.

Đề xuất `GET /api/v1/me` trả user, permissions và scope đã tính trên server. Menu FE chỉ cải thiện UX.
Các quyền xác nhận cọc, chi tiền và tách người nhập/duyệt/chi phải được kiểm tra lại trong transaction.
Admin demo **không** có quyền xác nhận cọc hoặc ghi nhận chi thay Kế toán.

## 4. Endpoint đề xuất

| Nhóm | Tài nguyên/command cần cung cấp |
|---|---|
| Auth | `POST /session`, `DELETE /session`, `GET /me` |
| CRM | `/customers`, `/leads`, `/leads/{id}/profile`, `/leads/{id}/interactions`, `/leads/{id}/rfqs`, `/rfqs/{id}/price-requests` |
| Báo giá/hợp đồng | `/rfqs/{id}/quotations`, `/quotations/{id}/submit`, `/review`, `/send`, `/response`; `/quotations/{id}/contracts`; `/contracts/{id}/board-review`, `/sign` |
| Cọc/bàn giao | `/contracts/{id}/deposit/request`, `/confirm`, `/mismatch`, `/contracts/{id}/handover`, `/orders/{id}/handover/review` |
| Sourcing/PO | `/sourcing-requests`, `/supplier-quotes`, `/sourcing-requests/{id}/selection`, `/suppliers`, `/orders/{id}/purchase-orders`, `/purchase-orders/{id}/place`, `/advance`, `/qc` |
| Logistics | `/orders/{id}/shipments`, `/shipments/{id}/milestones/{key}/complete`, `/tracking-events`, `/costs`, `/documents` và `/documents/{id}/review` |
| Kho/giao hàng | `/inbound-receipts`, `/inbound-receipts/{id}/receive`, `/packages`, `/outbounds`, `/outbounds/{id}/pick`, `/pack`, `/dispatch`, `/deliveries/{id}/pod`, `/failure`, `/redispatch` |
| Kế toán | `/payments`, `/payments/{id}/submit`, `/review`, `/paid`, `/reconcile`; `/customer-receipts`, `/statement-lines`, `/settlements/{order_id}/start`, `/close` |
| Marketing | `/campaigns`, `/lead-feedback`; attribution lead–campaign chưa có model được chốt |
| Hỗ trợ | `/complaints`, `/complaints/{id}/activities`, `/compensation/request`, `/compensation/review`; `/legal-requests` và `/review` |
| HRM | `/employees`, `/departments`, `/positions`, `/candidates`, `/onboarding`, `/attendance` |
| Phân tích | `/dashboard`, `/reports/{kind}`, `/reports/{kind}/export` |

Các hậu tố rút gọn trong bảng gắn với tài nguyên ngay trước đó. Không có endpoint nào ở bảng này
đã được nối trong FE. Quy trình ký hợp đồng, lưu chứng từ, phân bổ nhiều lô và đề xuất đền bù cần
xác nhận nghiệp vụ trước khi Backend biến thành command chính thức.

## 5. Filter, phân trang và response

Đề xuất list query: `from`, `to` (inclusive), `q`, `status`, `route`, `assignee_id`, `sort`, `page`,
`page_size`. Whitelist trường sort/filter, giới hạn page_size và dùng ID làm tie-breaker. Với bảng lớn,
có thể thống nhất cursor thay cho page; không trộn hai mô hình trong cùng endpoint.

```json
{
  "data": [{ "order_id": "DH-2026-0001", "status": "da-ky", "version": 3 }],
  "meta": { "page": 1, "page_size": 15, "total": 120 },
  "request_id": "req-example"
}
```

Response command trả tài nguyên đã lưu, `version` mới và các tài nguyên liên quan đã thay đổi.
FE hiện dùng `Result = {ok:true,id?} | {ok:false,error:string}` hoặc `string | null` trong Backoffice;
adapter async nên ánh xạ response API về kết quả UI rõ ràng, không sửa toàn bộ view cùng lúc.

```json
{
  "error": {
    "code": "HANDOVER_INCOMPLETE",
    "message": "Còn thiếu thông tin bàn giao",
    "field_errors": { "handover.items.i5": "Thiếu địa chỉ giao hàng" },
    "request_id": "req-example"
  }
}
```

Thống nhất 401 (đăng nhập lại), 403 (không đủ quyền), 404 (không tồn tại/không thuộc scope),
409 (version/state conflict), 422 (validation), 429 và 5xx. Không trả stacktrace hoặc thông tin
nhạy cảm cho FE. Khi lỗi validation/conflict, giữ dữ liệu form và cung cấp tải lại tài nguyên.

## 6. Transaction và cổng nghiệp vụ hiện có

Các hàm `src/services/*/rules.ts` và kiểm thử là mô tả hành vi demo để đối chiếu, không thay thế
validation server. Giữ các cổng đang có trong lúc chuyển adapter:

1. RFQ từ lead Hot, xác định xuất xứ và chưa mất khách. Tiêu chí hồ sơ Hot còn cấu hình đề xuất.
2. Tạo báo giá sau khi RFQ có giá. Báo giá giảm vượt ngưỡng mô phỏng cần duyệt trước gửi.
3. Hợp đồng từ báo giá khách chấp nhận; ký sau duyệt cần thiết; chỉ Kế toán xác nhận cọc.
4. Bàn giao/đặt xưởng sau xác nhận cọc và Vận hành nhận đủ checklist; QC trước sẵn sàng.
5. Mốc lô theo thứ tự; nhập kho từ lô đã về; pick đủ rồi pack/dispatch. POD liên kết qua
   kiện → phiếu nhập → đúng lô, chỉ hoàn tất khi mọi kiện của lô đã giao.
6. Đề nghị chi: nhập → duyệt theo cấp → ghi chi; người nhập khác người duyệt, người chi khác người duyệt.
7. Quyết toán demo đang chặn theo bốn điều kiện: mọi lô đã giao, thu đủ, mọi đề nghị còn hiệu lực đã chi,
   mọi chứng từ của đơn đã duyệt. Chi phí thực tế được ghi nhận nhưng **chưa là cổng bắt buộc**;
   không tự thêm cổng này khi tích hợp nếu chưa được phê duyệt.

Dùng transaction/locking cho giữ tồn, phân bổ kiện, thu/chi, xác nhận cọc, POD và quyết toán. Đề xuất
`Idempotency-Key` cho commands ghi nhận tài chính/POD và `If-Match` hoặc `expected_version` cho sửa/
chuyển trạng thái. Retry không được tạo thêm phiếu thu/chi, trừ tồn hai lần hoặc lặp phê duyệt.
Audit log append-only lấy actor/time từ server và lưu trước/sau thay đổi cần thiết.

## 7. Reports và CSV

`src/config/reports.ts` định nghĩa quyền và cách đọc; `src/services/reports/rules.ts` có phép tính demo:

- Conversion/Marketing: cohort theo ngày tạo lead; distinct mess_id có RFQ chưa hủy/hợp đồng đã ký.
- Sales: cohort lead theo tuyến/người phụ trách hiện tại; giá trị ký tách VND/USD.
- Orders: hợp đồng đã ký theo ngày tạo; tiến độ hiện tại từ cọc/bàn giao/PO/lô.
- Shipments: ETD trong kỳ; trạng thái và độ chậm mốc hiện tại.
- On-time: chỉ lượt giao thành công có POD, lọc ngày giao; thiếu hạn không tính mẫu số. Đây là chỉ số đề xuất.
- Debt: số dư hiện tại của hợp đồng/đề nghị tạo trong kỳ, không phải ảnh chụp cuối kỳ; chỉ VND.
- Suppliers: PO tạo trong kỳ; điểm và tỷ lệ đúng hạn của hồ sơ vẫn là mock toàn kỳ.

Nếu cần báo cáo lịch sử/as-of, Backend cần event ledger hoặc snapshot và công thức riêng đã duyệt.
Không suy ra lịch sử từ trạng thái hiện tại. Export phải dùng cùng quyền/scope/filter/sort với list,
toàn bộ kết quả đã lọc, không chỉ trang đang xem. Demo CSV UTF-8 có BOM, quote/escape trường và
neutralize công thức spreadsheet. Export lớn nên là job có expiry, giới hạn số dòng và audit tải.

## 8. Tệp, lỗi và dữ liệu chưa sẵn sàng

Tệp demo chỉ là tên/mô tả, không có upload/download thật. Cần thống nhất API upload, quota,
content-type/size, kiểm tra nội dung và quyền tải riêng; không dùng URL công khai cho HRM/bill/POD.

UI dùng TableSkeleton/EmptyState/ErrorState/InlineAlert. Hooks có trạng thái lỗi tải và thử lại.
Repository local vẫn fallback seed khi localStorage lỗi; đây không phải chiến lược xử lý lỗi API.
Adapter thật phải xử lý pending/cancel/retry và chỉ báo success sau khi server xác nhận, giữ bản
nháp khi save lỗi. Không đưa success của lệnh lưu local đồng bộ thành success trước response mạng.

## 9. Checklist bàn giao và phần cần chốt

- Chốt schema/OpenAPI, enum, tiền tệ/timezone, scope tenant/tuyến/cá nhân, danh mục quyền.
- Chốt các ngưỡng phê duyệt, QC, lead Hot, SLA kho/khiếu nại, bồi thường, HRM và pháp chế.
- Chốt phân bổ số lượng của đơn nhiều lô. Demo lập phiếu nhập tay, một phiếu/lô và một outbound/đơn;
  chưa hỗ trợ xuất nhiều đợt hoặc một đơn pick tại nhiều kho. Không mở rộng ngầm các giới hạn này.
- Cấp sandbox/staging, tài khoản kiểm thử và contract samples; thay repository từng module.
- Kiểm thử command idempotency, race conditions, rollback, stale versions, 401/403/409/422/5xx và file access.
- Chạy `pnpm check`, `pnpm lint`, `pnpm typecheck`, `pnpm build` trước bàn giao mỗi adapter.
- `pnpm check:flow` chạy store thật trong bộ nhớ riêng, không sửa localStorage trình duyệt;
  kiểm tra luồng xuyên module và các cổng quyền, không phải E2E API hoặc nhiều người dùng.

Mức sẵn sàng: UI/model/điểm thay adapter và kiểm thử demo đã có. Chưa sẵn sàng production cho đến
khi có API, auth/quyền server, transaction, lưu tệp và nghiệp vụ chưa chốt được phê duyệt.
