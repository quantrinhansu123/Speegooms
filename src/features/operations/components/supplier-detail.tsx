"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Field, NativeSelect } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { countryLabels, supplierStatusMeta } from "@/config/operations";
import { formatDate, formatVnd } from "@/lib/format";
import type { PurchaseOrder, SupplierQuote, SupplierStatus } from "@/types/ops";
import { useOps } from "../hooks";
import { PoBadge, Rating, SupplierBadge } from "./ops-badges";

export function SupplierDetail({ supplierId }: { supplierId: string }) {
  const { ops, actions, can } = useOps();
  const s = ops.suppliers.find((x) => x.supplierId === supplierId);
  if (!s) return <div className="rounded-xl border bg-card"><EmptyState title="Không tìm thấy nhà cung cấp" /></div>;

  const quotes = ops.supplierQuotes.filter((q) => q.supplierId === supplierId);
  const pos = ops.pos.filter((p) => p.supplierId === supplierId);
  const won = quotes.filter((q) => q.status === "da-chon").length;

  const quoteCols: Column<SupplierQuote>[] = [
    { key: "q", header: "Báo giá", cell: (q) => <Link href={`/van-hanh/sourcing-bao-gia/${q.requestId}`} className="font-mono text-xs text-primary hover:underline">{q.quoteId}</Link> },
    { key: "r", header: "Yêu cầu", cell: (q) => <span className="font-mono text-xs text-muted-foreground">{q.requestId}</span> },
    { key: "p", header: "Đơn giá", align: "right", cell: (q) => formatVnd(q.goodsUnitPrice) },
    { key: "l", header: "Sản xuất", align: "right", cell: (q) => `${q.leadTimeDays} ngày` },
    { key: "s", header: "Kết quả", cell: (q) => <StatusBadge tone={q.status === "da-chon" ? "success" : q.status === "loai" ? "neutral" : "info"}>{q.status === "da-chon" ? "Được chọn" : q.status === "loai" ? "Không chọn" : "Chờ chọn"}</StatusBadge> },
  ];
  const poCols: Column<PurchaseOrder>[] = [
    { key: "po", header: "PO", cell: (p) => <Link href={`/van-hanh/po/${p.poId}`} className="font-mono text-xs text-primary hover:underline">{p.poId}</Link> },
    { key: "o", header: "Đơn hàng", cell: (p) => <Link href={`/van-hanh/don-hang/${p.orderId}`} className="font-mono text-xs text-muted-foreground hover:underline">{p.orderId}</Link> },
    { key: "a", header: "Giá trị", align: "right", cell: (p) => formatVnd(p.amount) },
    { key: "r", header: "Dự kiến sẵn sàng", cell: (p) => <span className="tabular">{formatDate(p.expectedReadyOn)}</span>, className: "hidden md:table-cell" },
    { key: "s", header: "Trạng thái", cell: (p) => <PoBadge value={p.status} /> },
  ];

  return (
    <>
      <Link href="/van-hanh/nha-cung-cap" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Danh sách nhà cung cấp
      </Link>
      <div className="mb-6 rounded-xl border bg-card p-5 shadow-xs">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">{s.name}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground"><span className="font-mono">{s.supplierId}</span> · {countryLabels[s.country]} · {s.city}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3"><SupplierBadge value={s.status} /><Rating value={s.rating} /></div>
        {s.note && <p className="mt-3 text-sm text-muted-foreground">{s.note}</p>}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Thông tin">
          <dl className="divide-y text-sm">
            {[
              ["Loại hàng", s.categories.join(", ")],
              ["Liên hệ", `${s.contactName} · ${s.phone}`],
              ["MOQ", s.moq],
              ["Sản xuất", `${s.leadTimeDays} ngày`],
              ["Giao đúng hạn", `${s.onTimeRate}% (demo)`],
              ["Báo giá / được chọn", `${quotes.length} / ${won}`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
            ))}
          </dl>
          {can() && (
            <Field label="Đổi trạng thái hợp tác" htmlFor="sd-status" className="mt-4">
              <NativeSelect id="sd-status" value={s.status} onChange={(e) => actions.setSupplierStatus(supplierId, e.target.value as SupplierStatus)}>
                {(Object.keys(supplierStatusMeta) as SupplierStatus[]).map((k) => <option key={k} value={k}>{supplierStatusMeta[k].label}</option>)}
              </NativeSelect>
            </Field>
          )}
        </SectionCard>
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title={`Lịch sử báo giá (${quotes.length})`} bodyClassName="p-0 pt-3">
            <DataTable columns={quoteCols} rows={quotes.slice(0, 10)} getRowId={(q) => q.quoteId} className="rounded-none border-x-0 border-b-0 shadow-none" footer={quotes.length > 10 ? `Hiển thị 10/${quotes.length} báo giá` : undefined} empty={<EmptyState title="Chưa có báo giá" className="py-8" />} />
          </SectionCard>
          <SectionCard title={`Purchase Order (${pos.length})`} bodyClassName="p-0 pt-3">
            <DataTable columns={poCols} rows={pos.slice(0, 10)} getRowId={(p) => p.poId} className="rounded-none border-x-0 border-b-0 shadow-none" footer={pos.length > 10 ? `Hiển thị 10/${pos.length} PO` : undefined} empty={<EmptyState title="Chưa có PO" className="py-8" />} />
          </SectionCard>
        </div>
      </div>
    </>
  );
}
