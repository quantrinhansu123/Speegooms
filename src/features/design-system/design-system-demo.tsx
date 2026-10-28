"use client";

import { useState } from "react";
import { Activity, Plus, Search, Trash2, Truck, Users, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCardSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatVnd } from "@/lib/format";
import type { StatusTone } from "@/types/status";
import type { DemoChartPoint, DemoRow, DemoStat } from "@/types/demo";

const statIcons = [Activity, Users, Truck, Wallet];

const swatches = [
  { name: "Navy", token: "primary", cls: "bg-primary", hex: "#082A59" },
  { name: "Orange", token: "brand-orange", cls: "bg-brand-orange", hex: "#F26522" },
  { name: "Nền phụ", token: "background", cls: "bg-background border", hex: "#F6F8FC" },
  { name: "Surface", token: "surface", cls: "bg-surface border", hex: "#FFFFFF" },
  { name: "Success", token: "success", cls: "bg-success", hex: "#15803D" },
  { name: "Warning", token: "warning", cls: "bg-warning", hex: "#A15C07" },
  { name: "Danger", token: "danger", cls: "bg-danger", hex: "#C0392B" },
  { name: "Info", token: "info", cls: "bg-info", hex: "#1D4ED8" },
];

const tones: { tone: StatusTone; label: string }[] = [
  { tone: "success", label: "Hoàn tất" },
  { tone: "info", label: "Đang xử lý" },
  { tone: "warning", label: "Chờ duyệt" },
  { tone: "danger", label: "Có sự cố" },
  { tone: "neutral", label: "Nháp" },
];

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-1 mb-4 text-sm text-muted-foreground">{description}</p>}
      {!description && <div className="mb-4" />}
      {children}
    </section>
  );
}

export function DesignSystemDemo({
  stats,
  rows,
  chart,
}: {
  stats: DemoStat[];
  rows: DemoRow[];
  chart: DemoChartPoint[];
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [statLoading, setStatLoading] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);

  const columns: Column<DemoRow>[] = [
    { key: "name", header: "Hạng mục", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "owner", header: "Phụ trách", cell: (r) => r.owner },
    { key: "status", header: "Trạng thái", cell: (r) => <StatusBadge tone={r.status.tone}>{r.status.label}</StatusBadge> },
    { key: "amount", header: "Giá trị", align: "right", cell: (r) => formatVnd(r.amount) },
  ];

  return (
    <>
      <PageHeader
        title="Design System"
        description="Trang kiểm tra tính đồng nhất của token và component dùng chung. Dữ liệu trên trang là dữ liệu mẫu."
        actions={
          <Button onClick={() => setConfirmOpen(true)} variant="outline">
            <Trash2 /> Thử hộp thoại xác nhận
          </Button>
        }
      />

      <Section title="Màu sắc" description="Chỉ dùng token semantic. Cam dùng cho điểm nhấn; chữ cam nhỏ dùng brand-orange-text (#C2410C) để đạt AA.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {swatches.map((s) => (
            <div key={s.name} className="rounded-xl border bg-card p-3">
              <div className={`h-14 rounded-md ${s.cls}`} />
              <p className="mt-2 text-sm font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">
                {s.hex} · <code className="font-mono">{s.token}</code>
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography" description="Inter (hỗ trợ tiếng Việt). Thang 12 / 13 / 14 / 16 / 20 / 24 / 30.">
        <div className="space-y-2 rounded-xl border bg-card p-5">
          <p className="text-3xl font-semibold tracking-tight text-primary">Tiêu đề trang 30</p>
          <p className="text-2xl font-semibold text-primary">Tiêu đề trang 24</p>
          <p className="text-xl font-semibold">Tiêu đề mục 20</p>
          <p className="text-lg font-semibold">Tiêu đề thẻ 16</p>
          <p className="text-base">Nội dung chính 14 — Vận chuyển, thông quan, giao hàng chặng cuối.</p>
          <p className="text-sm text-muted-foreground">Nội dung phụ 13 — chú thích, mô tả.</p>
          <p className="text-xs text-muted-foreground">Nhãn nhỏ 12 · <span className="tabular">0123456789</span></p>
        </div>
      </Section>

      <Section title="Button & Input">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-5">
          <Button size="lg"><Plus /> Chính</Button>
          <Button size="lg" variant="secondary">Phụ</Button>
          <Button size="lg" variant="outline">Viền</Button>
          <Button size="lg" variant="ghost">Ghost</Button>
          <Button size="lg" variant="destructive">Nguy hiểm</Button>
          <Button size="lg" disabled>Vô hiệu</Button>
          <div className="relative w-64">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Tìm kiếm mẫu" placeholder="Tìm kiếm…" className="h-9 pl-8" />
          </div>
        </div>
      </Section>

      <Section title="StatusBadge" description="Luôn gồm icon và chữ, không truyền đạt chỉ bằng màu.">
        <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-5">
          {tones.map((t) => (
            <StatusBadge key={t.tone} tone={t.tone}>{t.label}</StatusBadge>
          ))}
        </div>
      </Section>

      <Section title="StatCard">
        <div className="mb-3">
          <Button variant="outline" size="sm" onClick={() => setStatLoading((v) => !v)}>
            {statLoading ? "Hiện dữ liệu" : "Xem skeleton"}
          </Button>
        </div>
        {statLoading ? (
          <StatCardSkeleton />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((s, i) => (
              <StatCard key={s.id} label={s.label} value={s.value} delta={s.delta} deltaLabel={s.deltaLabel} icon={statIcons[i % statIcons.length]} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Biểu đồ (Recharts)" description="Màu series lấy từ token chart-*, có legend và tooltip.">
        <div className="rounded-xl border bg-card p-5">
          <div className="h-64" role="img" aria-label="Biểu đồ cột so sánh kỳ này và kỳ trước, 6 tháng">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ left: -16 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="current" name="Kỳ này" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="previous" name="Kỳ trước" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>

      <Section title="DataTable" description="Khung bảng gồm toolbar, trạng thái rỗng/loading và footer. Chưa có sort/filter/phân trang.">
        <DataTable
          columns={columns}
          rows={showEmpty ? [] : rows}
          getRowId={(r) => r.id}
          toolbar={
            <>
              <span className="text-sm font-medium">Danh sách mẫu</span>
              <Button variant="outline" size="sm" className="ml-auto" onClick={() => setShowEmpty((v) => !v)}>
                {showEmpty ? "Hiện dữ liệu" : "Xem trạng thái rỗng"}
              </Button>
            </>
          }
          empty={<EmptyState title="Không có kết quả" description="Thử đổi bộ lọc hoặc thêm mục mới." action={<Button><Plus /> Thêm mới</Button>} />}
          footer={`${showEmpty ? 0 : rows.length} hạng mục`}
        />
      </Section>

      <Section title="EmptyState">
        <div className="rounded-xl border bg-card">
          <EmptyState title="Chưa có dữ liệu" description="Khi có dữ liệu, nội dung sẽ hiển thị tại đây." />
        </div>
      </Section>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Xóa hạng mục này?"
        description="Hành động này không thể hoàn tác. Dữ liệu liên quan sẽ bị gỡ khỏi hệ thống."
        confirmLabel="Xóa"
        destructive
        onConfirm={() => {}}
      />
    </>
  );
}
