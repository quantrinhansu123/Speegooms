"use client";

import { useListTools } from "@/components/shared/list-tools";
import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { docStatusMeta, docTypeLabels } from "@/config/operations";
import { usePagination } from "@/features/crm/hooks";
import { formatDate } from "@/lib/format";
import { matchesQuery } from "@/lib/text";
import type { DocStatus, OpsDocument } from "@/types/ops";
import { useOps } from "../hooks";
import { DocBadge } from "./ops-badges";

/** Cột thao tác chứng từ: tải lên (mô phỏng, chỉ ghi tên file), duyệt/từ chối. */
function DocActions({ doc, onMessage }: { doc: OpsDocument; onMessage: (m?: string) => void }) {
  const { actions, can } = useOps();
  const [file, setFile] = useState("");
  if (!can()) return null;
  const report = (r: { ok: boolean; error?: string }) => onMessage(r.ok ? undefined : r.error);

  if (doc.status === "thieu" || doc.status === "tu-choi") {
    return (
      <div className="flex items-center gap-2">
        <Input aria-label={`Tên file ${docTypeLabels[doc.type]}`} className="h-8 w-40" placeholder="Tên file (mô phỏng)" value={file} onChange={(e) => setFile(e.target.value)} />
        <Button size="sm" variant="outline" onClick={() => { report(actions.addDocument(doc.shipmentId, doc.type, file)); setFile(""); }}>Tải lên</Button>
      </div>
    );
  }
  if (doc.status === "cho-duyet") {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => report(actions.reviewDocument(doc.docId, true, ""))}>Duyệt</Button>
        <Input aria-label={`Lý do từ chối ${docTypeLabels[doc.type]}`} className="h-8 w-36" placeholder="Lý do từ chối" value={file} onChange={(e) => setFile(e.target.value)} />
        <Button size="sm" variant="destructive" onClick={() => report(actions.reviewDocument(doc.docId, false, file))}>Từ chối</Button>
      </div>
    );
  }
  return null;
}

export function DocumentsTable({ docs, showShipment = true }: { docs: OpsDocument[]; showShipment?: boolean }) {
  const [msg, setMsg] = useState<string>();
  const columns: Column<OpsDocument>[] = [
    { key: "type", header: "Chứng từ", cell: (d) => <span className="font-medium">{docTypeLabels[d.type]}</span> },
    ...(showShipment
      ? [{ key: "ship", header: "Lô hàng", cell: (d: OpsDocument) => <Link href={`/van-hanh/logistics/${d.shipmentId}`} className="font-mono text-xs text-primary hover:underline">{d.shipmentId}</Link> }]
      : []),
    ...(showShipment ? [{ key: "order", header: "Đơn hàng", cell: (d: OpsDocument) => <Link href={`/van-hanh/don-hang/${d.orderId}`} className="font-mono text-xs text-muted-foreground hover:underline">{d.orderId}</Link>, className: "hidden lg:table-cell" }] : []),
    { key: "file", header: "File", cell: (d) => <span className="text-xs text-muted-foreground">{d.fileName ?? "Chưa có"}</span>, className: "hidden md:table-cell" },
    { key: "status", header: "Trạng thái", cell: (d) => <div><DocBadge value={d.status} />{d.note && <p className="mt-0.5 text-xs text-muted-foreground">{d.note}</p>}</div> },
    { key: "date", header: "Cập nhật", cell: (d) => <span className="tabular text-muted-foreground">{formatDate(d.updatedAt)}</span>, className: "hidden md:table-cell" },
    { key: "act", header: "Thao tác", cell: (d) => <DocActions doc={d} onMessage={setMsg} /> },
  ];
  return (
    <div className="space-y-3">
      {msg && <InlineAlert>{msg}</InlineAlert>}
      <DataTable columns={columns} rows={docs} getRowId={(d) => d.docId} className="rounded-none border-x-0 shadow-none" empty={<EmptyState title="Chưa có chứng từ" className="py-8" />} />
    </div>
  );
}

export function DocumentsView() {
  const { ops } = useOps();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<DocStatus | "">("");
  const filtered = [...ops.documents]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.docId.localeCompare(a.docId))
    .filter((d) => (!status || d.status === status) && matchesQuery(query, d.shipmentId, d.orderId, docTypeLabels[d.type], d.fileName));
  const listTools = useListTools(filtered, { filename: "speego-documents.csv", name: (r) => r.fileName ?? r.type, date: (r) => r.updatedAt, dateLabel: "Ngày cập nhật", columns: [{ label: "Mã", value: (r) => r.docId }, { label: "Tên / nội dung", value: (r) => r.fileName ?? r.type }, { label: "Ngày cập nhật", value: (r) => r.updatedAt }, { label: "order_id", value: (r) => r.orderId }, { label: "shipment_id", value: (r) => r.shipmentId }, { label: "status", value: (r) => r.status }] });
  const paging = usePagination(listTools.rows, 15, listTools.resetKey);
  const pending = ops.documents.filter((d) => d.status === "cho-duyet").length;
  const missing = ops.documents.filter((d) => d.status === "thieu").length;

  return (
    <>
      <PageHeader title="Chứng từ" description={`Chứng từ các lô hàng: ${pending} chờ duyệt, ${missing} còn thiếu. Tải lên chỉ ghi tên file (demo), không lưu tệp thật.`} />
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <div className="relative min-w-60 flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Tìm chứng từ" placeholder="Tìm lô hàng, đơn hàng, loại chứng từ, file…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-8" />
        </div>
        <NativeSelect aria-label="Lọc trạng thái chứng từ" className="w-48" value={status} onChange={(e) => setStatus(e.target.value as DocStatus | "")}>
          <option value="">Mọi trạng thái</option>
          {(Object.keys(docStatusMeta) as DocStatus[]).map((s) => <option key={s} value={s}>{docStatusMeta[s].label}</option>)}
        </NativeSelect>
      </div>
      {listTools.toolbar}
      <div className="space-y-4">
        <div className="overflow-hidden rounded-xl border bg-card shadow-xs"><DocumentsTable docs={paging.slice} /></div>
        <Pagination page={paging.page} pages={paging.pages} total={paging.total} pageSize={paging.pageSize} onPageChange={paging.setPage} />
      </div>
    </>
  );
}
