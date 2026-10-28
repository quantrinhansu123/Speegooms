"use client";

import { useListTools } from "@/components/shared/list-tools";
import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Input } from "@/components/ui/input";
import { requestStatusMeta } from "@/config/operations";
import { routeLabels } from "@/config/crm";
import { usePagination } from "@/features/crm/hooks";
import { formatDate } from "@/lib/format";
import { matchesQuery } from "@/lib/text";
import { cn } from "@/lib/utils";
import type { RequestStatus, SourcingRequest } from "@/types/ops";
import { useOps } from "../hooks";
import { RequestBadge } from "./ops-badges";

export function SourcingRequestsView() {
  const { ops, crm, staffName, today } = useOps();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<RequestStatus | "">("");
  const [route, setRoute] = useState("");
  const [assignee, setAssignee] = useState("");

  const rfqById = new Map(crm.rfqs.map((r) => [r.rfqId, r]));
  const customerName = new Map(crm.customers.map((c) => [c.customerId, c.name]));
  const quoteCount = new Map<string, number>();
  for (const q of ops.supplierQuotes) quoteCount.set(q.requestId, (quoteCount.get(q.requestId) ?? 0) + 1);

  const filtered = [...ops.requests]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.requestId.localeCompare(a.requestId))
    .filter(
      (r) =>
        (!status || r.status === status) &&
        (!route || r.route === route) &&
        (!assignee || r.assigneeId === assignee) &&
        matchesQuery(query, r.requestId, r.rfqId, rfqById.get(r.rfqId)?.goodsName, customerName.get(r.customerId)),
    );
  const listTools = useListTools(filtered, { filename: "speego-sourcing-requests.csv", name: (r) => r.rfqId, date: (r) => r.createdAt, dateLabel: "Ngày tạo", columns: [{ label: "Mã", value: (r) => r.requestId }, { label: "Tên / nội dung", value: (r) => r.rfqId }, { label: "Ngày tạo", value: (r) => r.createdAt }, { label: "status", value: (r) => r.status }, { label: "due_on", value: (r) => r.dueOn }] });
  const paging = usePagination(listTools.rows, 15, listTools.resetKey);
  const waiting = ops.requests.filter((r) => r.status === "moi" || r.status === "dang-tim").length;

  const columns: Column<SourcingRequest>[] = [
    { key: "id", header: "Yêu cầu", cell: (r) => <Link href={`/van-hanh/sourcing-bao-gia/${r.requestId}`} className="font-mono text-xs font-medium text-primary hover:underline">{r.requestId}</Link> },
    {
      key: "goods",
      header: "Hàng hóa / khách",
      cell: (r) => (
        <div className="min-w-0">
          <p className="max-w-56 truncate font-medium">{rfqById.get(r.rfqId)?.goodsName ?? "—"}</p>
          <p className="max-w-56 truncate text-xs text-muted-foreground">{customerName.get(r.customerId) ?? r.customerId}</p>
        </div>
      ),
    },
    { key: "rfq", header: "rfq_id", cell: (r) => <Link href={`/crm/rfq/${r.rfqId}`} className="font-mono text-xs text-muted-foreground hover:underline">{r.rfqId}</Link>, className: "hidden xl:table-cell" },
    { key: "route", header: "Tuyến", cell: (r) => routeLabels[r.route], className: "hidden lg:table-cell" },
    { key: "quotes", header: "Báo giá", align: "right", cell: (r) => quoteCount.get(r.requestId) ?? 0 },
    { key: "status", header: "Trạng thái", cell: (r) => <RequestBadge value={r.status} /> },
    { key: "assignee", header: "Phụ trách", cell: (r) => staffName(r.assigneeId), className: "hidden md:table-cell" },
    {
      key: "due",
      header: "Hạn",
      className: "hidden md:table-cell",
      cell: (r) => {
        const late = r.dueOn < today && (r.status === "moi" || r.status === "dang-tim");
        return <span className={cn("tabular", late ? "font-medium text-danger" : "text-muted-foreground")}>{formatDate(r.dueOn)}{late && <span className="sr-only"> (quá hạn)</span>}</span>;
      },
    },
  ];

  return (
    <>
      <PageHeader title="Sourcing – Yêu cầu tìm nguồn" description={`Yêu cầu tìm xưởng sinh từ RFQ đã gửi cho Sourcing. ${waiting} yêu cầu đang chờ báo giá.`} />
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <div className="relative min-w-60 flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Tìm yêu cầu tìm nguồn" placeholder="Tìm mã yêu cầu, rfq_id, hàng hóa, khách…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-8" />
        </div>
        <NativeSelect aria-label="Lọc trạng thái" className="w-48" value={status} onChange={(e) => setStatus(e.target.value as RequestStatus | "")}>
          <option value="">Mọi trạng thái</option>
          {(Object.keys(requestStatusMeta) as RequestStatus[]).map((s) => (
            <option key={s} value={s}>{requestStatusMeta[s].label}</option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Lọc tuyến" className="w-44" value={route} onChange={(e) => setRoute(e.target.value)}>
          <option value="">Cả hai tuyến</option>
          <option value="vn">Sale Việt Nam</option>
          <option value="global">Sale Global</option>
        </NativeSelect>
        <NativeSelect aria-label="Lọc người phụ trách" className="w-48" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Mọi người phụ trách</option>
          {ops.staff.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </NativeSelect>
      </div>
      {listTools.toolbar}
      <div className="space-y-4">
        <DataTable columns={columns} rows={paging.slice} getRowId={(r) => r.requestId} empty={<EmptyState title="Không có yêu cầu phù hợp" />} />
        <Pagination page={paging.page} pages={paging.pages} total={paging.total} pageSize={paging.pageSize} onPageChange={paging.setPage} />
      </div>
    </>
  );
}
