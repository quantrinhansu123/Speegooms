# SpeeGo – Design System

Phong cách: modern enterprise logistics SaaS. Nền sáng, phẳng, viền mảnh, đổ bóng rất nhẹ. Không gradient, không glassmorphism. Desktop-first, responsive xuống 375px.

Nguồn token duy nhất: `src/app/globals.css`. Component chỉ dùng class semantic (`bg-primary`, `text-success`…), không dùng hex trực tiếp. Xem trực quan tại `/design-system`.

## Màu

| Token | Hex | Dùng cho |
|---|---|---|
| `primary` / `brand-navy` | `#082A59` | Nút chính, tiêu đề trang, avatar |
| `brand-orange` | `#F26522` | Điểm nhấn: vạch active sidebar, series biểu đồ. **Không** dùng cho chữ nhỏ (3,3:1) |
| `brand-orange-text` | `#C2410C` | Chữ/icon cam nhỏ trên nền trắng (đạt AA) |
| `background` | `#F6F8FC` | Nền trang |
| `surface` / `card` | `#FFFFFF` | Card, header, sidebar |
| `foreground` | `#0F1B2D` | Chữ chính |
| `muted-foreground` | `#526078` | Chữ phụ (đạt 4.5:1 trên trắng) |
| `border` / `input` | `#DDE3EE` / `#CFD7E5` | Viền |

Màu trạng thái (mỗi màu có bản `-soft` làm nền, chữ đạt AA trên nền soft):

| Trạng thái | Chữ | Nền soft | Ý nghĩa |
|---|---|---|---|
| `success` | `#147A3A` | `#E6F6EC` | Hoàn tất, đã cọc |
| `warning` | `#A15C07` | `#FDF1DC` | Chờ duyệt, sắp trễ |
| `danger` | `#C0392B` | `#FDECEB` | Sự cố, lỗi, nguy hiểm |
| `info` | `#1D4ED8` | `#E8EFFF` | Đang xử lý |
| `neutral` | `#475569` | `#ECEFF4` | Nháp, không xác định |

Màu biểu đồ: `chart-1` (navy), `chart-2` (cam), `chart-3` (teal), `chart-4` (tím), `chart-5` (xám xanh). Không truyền đạt thông tin chỉ bằng màu: luôn kèm icon hoặc chữ.

## Typography

Inter (subset `latin` + `vietnamese`), mono: Geist Mono. Bật `tabular-nums` (class `.tabular`) cho số liệu.

| Cỡ | px | Dùng cho |
|---|---|---|
| `text-xs` | 12 | Nhãn, caption, header cột bảng |
| `text-sm` | 13 | Chữ phụ, mô tả |
| `text-base` | 14 | Nội dung mặc định (mật độ enterprise) |
| `text-lg` | 16 | Tiêu đề thẻ |
| `text-xl` | 20 | Tiêu đề mục |
| `text-2xl` | 24 | Tiêu đề trang (`PageHeader`) |
| `text-3xl` | 30 | Giá trị KPI |

Trọng số: 400 nội dung, 500 nhãn/nút, 600 tiêu đề.

## Spacing, bo góc, bóng

- Khoảng cách theo bậc 4px của Tailwind. Gutter trang: 16px (mobile), 32px (≥ lg). Khoảng cách giữa các mục lớn: 40px (`mb-10`).
- Bo góc: `rounded-md` 6px (control), `rounded-lg` 8px, `rounded-xl` 12px (card/bảng).
- Bóng: `shadow-xs` cho card, `shadow-sm` cho phần tử nổi nhẹ, `shadow-md` dropdown, `shadow-lg` dialog. Màu bóng tint navy.
- Breakpoint: 375 / 768 / 1024 (sidebar cố định từ `lg`) / 1440 (max-width nội dung).

## Component dùng chung (`src/components/shared`)

| Component | Ghi chú |
|---|---|
| `PageHeader` | Tiêu đề + mô tả + `actions`. Mỗi trang một nút chính |
| `StatCard` | KPI: nhãn, giá trị đã format, delta (mũi tên + chữ "Tăng/Giảm") |
| `DataTable<T>` | Khung bảng: toolbar, columns khai báo, loading, empty, footer. Chưa có sort/filter/phân trang |
| `StatusBadge` | 5 tone, luôn icon + chữ |
| `EmptyState` | Icon, tiêu đề, mô tả, action |
| `TableSkeleton`, `StatCardSkeleton` | Giữ kích thước để tránh layout shift |
| `ConfirmDialog` | Dựa trên AlertDialog; `destructive` đổi nút sang màu danger |

Primitives nền (shadcn/ui, style `base-nova`, Base UI) nằm ở `src/components/ui`. Thêm bằng `pnpm dlx shadcn@latest add <tên>`.

## Quy tắc

1. Icon: Lucide, `aria-hidden` khi đứng cạnh chữ; nút chỉ có icon phải có `aria-label`.
2. Focus ring luôn hiển thị; mục tiêu bấm ≥ 32px (desktop), nút menu mobile 36px.
3. Hover/active chuyển 150ms; tôn trọng `prefers-reduced-motion`.
4. Điều hướng: mục hiện tại có nền accent + vạch cam + `aria-current="page"`.
5. Giao diện tiếng Việt; số/tiền format bằng `Intl` (`src/lib/format.ts`).
6. Chưa hỗ trợ dark mode (ngoài phạm vi giai đoạn 1).
