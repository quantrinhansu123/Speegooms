# SpeeGo – Frontend Architecture

## Stack

Next.js 16 (App Router, Cache Components bật) · React 19 · TypeScript · pnpm · Tailwind CSS 4 · shadcn/ui (Base UI) · Lucide React · Recharts · React Hook Form + Zod (đã cài, chưa dùng ở giai đoạn 1).

> Next 16 có breaking change so với các bản trước. Khi nghi ngờ API, đọc `node_modules/next/dist/docs/`.

## Cấu trúc thư mục

```
src/
├─ app/                      # Routing, chỉ chứa page/layout mỏng
│  ├─ layout.tsx             # Font Inter, TooltipProvider, metadata
│  ├─ globals.css            # Design tokens
│  ├─ page.tsx               # redirect → /dashboard
│  └─ (app)/                 # Route group dùng AppShell
│     ├─ layout.tsx
│     ├─ design-system/      # Trang demo component
│     └─ [...slug]/          # Trang giữ chỗ cho mọi module trong sidebar
├─ components/
│  ├─ ui/                    # shadcn/ui primitives (sinh bằng CLI)
│  ├─ layout/                # AppShell, Sidebar, Header, Breadcrumbs, UserMenu
│  └─ shared/                # PageHeader, StatCard, DataTable, StatusBadge, EmptyState, skeleton, ConfirmDialog
├─ features/                 # Code theo module nghiệp vụ (mỗi module một thư mục)
│  └─ design-system/         # Chỉ trang demo
├─ config/navigation.ts      # Cây module/phòng ban + breadcrumb helper
├─ services/                 # Tầng truy cập dữ liệu (hiện trả mock)
├─ mocks/                    # Dữ liệu mẫu có tổ chức
├─ types/                    # Kiểu dùng chung
└─ lib/                      # utils (cn), format
```

## Quy ước

- **Module theo phòng ban.** Cây điều hướng trong `config/navigation.ts` bám sơ đồ tổ chức (cơ cấu Ban GĐ 27/10/2026): Marketing, Sale Việt Nam, Sale Global, Vận hành, Kế toán, HCNS, Pháp chế, cùng COA và Khách hàng & Điều phối (chưa phân bổ). Sidebar, breadcrumb và trang giữ chỗ đều sinh từ file này.
- **Thêm module nghiệp vụ** (giai đoạn sau): tạo `features/<module>/` (components, hooks, schemas, types), tạo route thật `app/(app)/<module>/page.tsx` (route tĩnh tự ưu tiên hơn `[...slug]`), bỏ href tương ứng khỏi placeholder nếu cần.
- **Component trong `shared/` và `ui/` không chứa dữ liệu nghiệp vụ.** Nhận dữ liệu qua props đã format; tên cột, nhãn do trang gọi truyền vào.
- **Dữ liệu:** page (server component) gọi hàm trong `services/` rồi truyền props xuống. Hiện `services/*` đọc `mocks/*`; khi có backend chỉ đổi thân hàm sang `fetch`, giữ chữ ký async và kiểu trả về trong `types/`.
- **Client component** chỉ khi cần state/hook (sidebar active, dialog, chart). Giữ page ở server.
- **Alias:** `@/*` → `src/*`.
- **Form (về sau):** React Hook Form + Zod resolver, schema đặt cạnh feature.

## Auth demo, role và dashboard (giai đoạn 2)

> **Auth chỉ là mock để xem giao diện, không phải bảo mật production.** Cookie `speego_demo_session` chỉ chứa id người dùng, không ký, không mã hóa; mật khẩu demo dùng chung nằm trong `features/auth/schema.ts`. Khi có backend, thay `lib/session.ts`, `features/auth/actions.ts` và `proxy.ts` bằng auth thật.

- **Luồng:** `proxy.ts` chuyển người chưa có cookie về `/login`, người đã đăng nhập khỏi `/login`. `(app)/layout.tsx` đọc session phía server (trong `Suspense`), truyền xuống `SessionProvider`; client dùng `useSession()`.
- **Tài khoản demo:** `mocks/users.json`, 9 vai trò (Admin, Ban GĐ, Marketing, Sale VN, Sale Global, Vận hành, Kế toán, HCNS, Pháp chế). Trang login có nút chọn vai trò để điền sẵn.
- **Phân quyền menu tập trung:** `config/roles.ts` (`roleConfig`: module được truy cập, phạm vi dashboard). `navigationForRole()` lọc sidebar; `canAccess()` chặn trang giữ chỗ và `/design-system` bằng `<Forbidden />`. Chỉ Admin thấy nhóm "Hệ thống". Đây là kiểm tra giao diện, quyền thật phải do backend áp dụng.
- **KPI bấm được:** `config/modules.ts` liệt kê route đã có trang thật. KPI chỉ thành link khi route đích nằm trong danh sách đó và vai trò có quyền. Hiện chưa module nghiệp vụ nào được triển khai nên KPI chưa link; thêm route vào `implementedRoutes` là KPI tự bật.
- **Dữ liệu dashboard:** `mocks/data/*.json` (khách hàng, lead, RFQ, đơn hàng, công việc) có quan hệ `lead → rfq → đơn` và cùng một tuyến VN/Global. Ngày "hôm nay" cố định `2026-10-28`. `services/dashboard.service.ts` trả dữ liệu (đổi sang API sau này), `features/dashboard/metrics.ts` là hàm thuần tính chỉ số theo bộ lọc. Chạy `pnpm check:metrics` để kiểm tra quy tắc tính.
- **Quy ước chỉ số:** lead mới, RFQ, đơn, giá trị hợp đồng tính theo ngày tạo trong khoảng thời gian; RFQ đang xử lý, đơn đang thực hiện, đơn chờ cọc, công nợ là số tại thời điểm hiện tại. Bộ lọc Sale VN/Global theo tuyến; các phòng khác theo phòng đang giữ bản ghi.
- **Dashboard theo vai trò:** Admin và Ban GĐ xem toàn công ty và đổi được phòng ban. Vai trò theo phòng bị khóa vào phòng của mình. HCNS và Pháp chế chưa có chỉ số nghiệp vụ nên chỉ thấy công việc.

## CRM và Sales (giai đoạn 3)

Màn hình: `/crm/leads`, `/crm/khach-hang`, `/crm/rfq`, `/crm/bao-gia`, `/crm/hop-dong` (mỗi mục có trang chi tiết `[id]`). Phạm vi Sale VN / Sale Global theo vai trò, Ban GĐ và Admin thấy cả hai tuyến, Kế toán chỉ thấy Hợp đồng và cọc. Chưa làm Logistics, Warehouse, Accounting đầy đủ.

**Dữ liệu và lưu trữ (mock có giải thích):**
- Seed JSON ở `mocks/crm/*.json`, sinh từ cùng nguồn với dashboard nên số lượng khớp (410 lead, 259 RFQ, 124 hợp đồng). Seed tải bằng `import()` động, chỉ khi vào CRM.
- Lần đầu nạp seed vào **localStorage** (`speego_crm_demo_v1`); mọi thêm/sửa/đổi trạng thái được lưu lại và còn sau khi tải lại trang. Dữ liệu chỉ nằm trong trình duyệt này, không đồng bộ giữa người dùng/thiết bị. Nút "Đặt lại dữ liệu demo" nạp lại seed. Dashboard vẫn đọc JSON tĩnh nên **không** phản ánh dữ liệu CRM bạn tạo thêm.

**Tách lớp (để gắn backend):**
- `types/crm.ts`: DTO snake_case (`mess_id`, `rfq_id`, `order_id`, `customer_id`) và model camelCase suy ra từ DTO bằng kiểu `Camelize`.
- `services/crm/adapters.ts`: DTO ↔ model. `services/crm/repository.ts`: giao diện `CrmRepository` (hiện là bản localStorage). Khi có API, viết một repository gọi endpoint (nhận/gửi DTO) và thay trong `features/crm/store.ts`.
- `services/crm/rules.ts`: luật nghiệp vụ thuần (phân tuyến theo xuất xứ, mess_id, 6 thông tin, cổng cọc, tổng báo giá, phát hiện trùng khách). Kiểm tra bằng `pnpm check:crm`.
- `features/crm/store.ts`: external store + toàn bộ thao tác (kiểm quyền, kiểm luật, ghi lịch sử). `features/crm/hooks.ts`: `useCrm()` (dữ liệu theo phạm vi, thao tác đã gắn người thực hiện), `usePagination`.
- `features/crm/components/*`: màn hình. `app/(app)/crm/*`: route mỏng. `config/crm.ts`: nhãn, 6 thông tin, ngưỡng mô phỏng, quyền thao tác.

**Chuỗi khóa:** mọi bản ghi mang `mess_id → rfq_id → order_id` và `customer_id`. Component `ChainTrace` hiển thị chuỗi và cho nhảy tới từng bản ghi.

**Các điểm bám tài liệu và các điểm chưa duyệt:**
- 6 thông tin là cấu hình tạm (`leadProfileFields`), tiêu chí chi tiết chưa duyệt (Q20). Ô bỏ trống được ghi là thiếu kèm ngày hỏi lại. Lead chưa đủ thì không sang Hot (`enforceProfileForHot`).
- Mất khách bắt buộc chọn lý do (giá, thời gian, niềm tin, hàng chưa sẵn sàng, khác; "khác" phải ghi chú).
- Affiliate chỉ hiển thị là đề xuất, không chọn được, không có dữ liệu.
- Ngưỡng duyệt A (giảm giá %) và B (giá trị hợp đồng) trong `simulatedApprovals` chỉ để mô phỏng luồng, không phải quy định. Việc duyệt do Trưởng phòng Sale hoặc Ban GĐ trong demo.
- Chỉ Kế toán xác nhận "Đã cọc"; chưa cọc thì nút bàn giao đặt xưởng bị khóa (cả ở UI lẫn trong thao tác `handOverToOperations`).
- `order_id` được cấp ngay khi tạo hợp đồng trong demo; quy trình thật do Vận hành cấp sau bàn giao (tài liệu 3.7 bước 5).
- Quyền thao tác ở client chỉ để demo, quyền thật phải do backend áp dụng.

## Vận hành (giai đoạn 4)

Màn hình dưới `/van-hanh/*` (mỗi mục có trang chi tiết `[id]`): Sourcing – Báo giá (yêu cầu tìm nguồn, so sánh báo giá nhà cung cấp), Nhà cung cấp, Purchase Order (tiến độ + QC), Đơn hàng (7 tab), Logistics – Lô hàng (6 mốc, tracking, chi phí) và Chứng từ. Fulfillment vẫn là trang giữ chỗ. Vai trò thao tác: Vận hành và Admin; Ban GĐ chỉ xem.

**Liên kết với CRM:** đơn hàng Vận hành chính là hợp đồng CRM đã ký (`order_id`), nên khách hàng, RFQ, báo giá, cọc đều đọc từ CRM store (không sao chép). Chọn báo giá nhà cung cấp sẽ gọi `returnPrices` bên CRM để RFQ chuyển sang "Đã có giá". Seed `mocks/ops/*.json` sinh từ chính dữ liệu CRM (213 yêu cầu tìm nguồn, 113 PO đúng bằng số hợp đồng đã cọc, 90 lô hàng).

**Lưu trữ:** như CRM, seed JSON nạp vào localStorage (`speego_ops_demo_v2`), chỉ nằm trong trình duyệt này; nút "Đặt lại dữ liệu Vận hành" nạp lại seed (không ảnh hưởng CRM).

**Cấu trúc:** `types/ops.ts` (DTO + model, dùng lại `Camelize`), `services/ops/{repository,rules}.ts`, `features/operations/{store,hooks,ops-shell}` và `components/*`, `config/operations.ts` (nhãn, checklist, quyền). `buildOrderViews()` dựng danh sách đơn: giai đoạn suy ra từ cọc, bàn giao, PO, lô hàng; cảnh báo thiếu thông tin, quá hạn, chờ xác nhận. Kiểm tra bằng `pnpm check:ops`.

**Luật nghiệp vụ được cưỡng chế (cả ở UI lẫn trong thao tác của store):**
- Không đặt xưởng khi Kế toán chưa xác nhận "Đã cọc" (`canPlacePo`, kiểm lại khi tạo PO, đặt xưởng và chuyển bước PO). Vận hành chỉ nhận bàn giao khi đã cọc; thiếu mục nào thì trả lại Sale kèm lý do.
- PO chỉ báo "Hàng sẵn sàng" khi QC mọi mục Đạt hoặc Không áp dụng; lô hàng chỉ tạo khi PO sẵn sàng; mốc lô hàng hoàn thành tuần tự, ngày thực tế không ở tương lai.
- Mọi thao tác ghi người làm và thời điểm vào lịch sử (đơn, yêu cầu tìm nguồn).

**Điểm chưa duyệt / giới hạn demo:**
- QC checklist và danh mục chứng từ theo loại hình là **cấu hình tạm** (`qcItems`, `requiredDocs`): tài liệu chưa có tiêu chuẩn được duyệt.
- 8 bước tiến độ đơn là bước tạm, chưa phải "8 mốc" chính thức (tài liệu không liệt kê). Checklist bàn giao lấy từ phiếu bàn giao trong tài liệu; SLA xác nhận (X giờ) chưa chốt nên không hiển thị.
- **Tracking không phải thời gian thực:** sự kiện là dữ liệu demo hoặc nhập tay, có nhãn rõ trên giao diện; mã vận đơn là mã demo. Tải chứng từ chỉ ghi tên file, không lưu tệp.
- Thanh toán xưởng, công nợ, kho/Fulfillment không thuộc phạm vi giai đoạn này.

## Fulfillment và Kế toán (giai đoạn 5)

**Fulfillment** (`/fulfillment/*`): tổng quan kho, nhập kho, tồn kho (tìm SKU/mã kiện, chi tiết kiện + vị trí), Pick/Pack, giao chặng cuối và POD, yêu cầu hỏi tình trạng đơn từ Sale. **Kế toán** (`/ke-toan/*`): tài chính vận hành, cọc cần đối soát và xác nhận Đã cọc, đề nghị thanh toán, duyệt thanh toán, công nợ phải thu/phải trả, quyết toán hợp đồng, sổ thu chi và đối soát. Lương và chi phí nội bộ vẫn là trang giữ chỗ.

**Dữ liệu dùng chung, trạng thái đồng bộ:** mọi module cùng đọc/ghi các store trong một chuỗi (CRM → Vận hành → Fulfillment/Kế toán) qua `useCrm` → `useOps` → `useFulfillment`/`useAccounting`; hai store mới tạo bằng `services/store-factory.ts` + `services/repository-factory.ts` (seed JSON + localStorage, DTO snake_case, adapter chung). Các điểm đồng bộ:
- Kế toán xác nhận "Đã cọc" bằng thao tác của CRM store → Vận hành mở khóa đặt xưởng, Sale thấy trạng thái cọc.
- Xác nhận POD ghi ngược mốc "Giao hàng" của lô hàng bên Vận hành (đơn chuyển sang "Đã giao hàng").
- Sale hỏi tình trạng đơn từ chi tiết hợp đồng CRM (`OrderInquiryCard`); Fulfillment trả lời, Sale thấy câu trả lời.
- Công nợ phải thu suy ra từ hợp đồng + cọc + khoản thu và khớp KPI dashboard; PO, lô hàng và cước thực tế của Vận hành là nguồn cho đề nghị chi và quyết toán.

**Luật nghiệp vụ được cưỡng chế (cả UI và thao tác của store):** chỉ Kế toán xác nhận Đã cọc; chỉ tạo/chi đề nghị cho đơn đã cọc; chi trả tách ba bước nhập (Vận hành) → duyệt (theo cấp) → chi (Kế toán), người nhập không tự duyệt, người duyệt không tự chi, mỗi bước ghi người làm và thời điểm; nhập kho lệch số lượng phải ghi chú; chỉ đóng gói khi pick đủ; POD cần người nhận và ghi chú; chốt quyết toán khi đã giao, thu đủ, chi xong, chứng từ đủ. Kiểm tra bằng `pnpm check:fulfillment` và `pnpm check:accounting`.

**Chưa có trong tài liệu / giới hạn demo:**
- **Ngưỡng duyệt chi: CẦN CẤU HÌNH** (`config/accounting.ts`, `paymentApproval.configured = false`). Ba cấp hiển thị chỉ mô phỏng luồng; giao diện hiện banner cảnh báo ở mọi nơi dùng ngưỡng. Tài liệu chưa có ngưỡng tiền và mẫu đề nghị chi.
- **Không có thanh toán thật:** "Đã chi" chỉ là ghi nhận trạng thái; sao kê là dữ liệu demo, không kết nối ngân hàng. Giao diện ghi rõ điều này.
- Chủ quyết toán chưa được phân trong tài liệu; demo cho Kế toán chốt. Số ngày cảnh báo hàng chờ nhập kho (`inboundAlertDays`) chỉ để demo, tài liệu chưa có SLA kho. Minh chứng POD và chứng từ chỉ ghi tên file, không lưu tệp.
- Dữ liệu chỉ nằm trong trình duyệt này (localStorage), mỗi module có nút đặt lại riêng.

## Lưu ý kỹ thuật

- `[...slug]` dùng `generateStaticParams` từ navigation vì Cache Components không cho route động phụ thuộc `params`/`usePathname` mà không biết trước giá trị. Route ngoài navigation trả 404.
- shadcn sinh code import `cn` từ gói npm `cn`; đã thay bằng `clsx` + `tailwind-merge` trong `lib/utils.ts`. Khi chạy `shadcn add`, kiểm tra file mới còn import `"cn"` thì đổi lại thành `"@/lib/utils"`.
- Base UI dùng prop `render` (không phải `asChild`) để đổi phần tử gốc.

## Chạy dự án

```bash
pnpm install
pnpm dev        # http://localhost:3000 (→ /dashboard)
pnpm lint
pnpm build && pnpm start
```

Trang kiểm tra UI: `/design-system`.
