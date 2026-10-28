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
import { approvalMeta, quoteStatusMeta } from "@/config/crm";
import { formatDate, formatMoney } from "@/lib/format";
import { matchesQuery } from "@/lib/text";
import { quoteTotals } from "@/services/crm/rules";
import type { Quotation, QuoteStatus } from "@/types/crm";
import { useCrm, usePagination } from "../hooks";
import { QuoteBadge } from "./meta-badges";

export function QuotationsView() {
  const { data, all } = useCrm();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<QuoteStatus | "">("");
  const customerName = new Map(all.customers.map((c) => [c.customerId, c.name]));

  const filtered = data.quotations.filter((q) => (!status || q.status === status) && matchesQuery(query, q.quoteId, q.rfqId, q.messId, customerName.get(q.customerId)));
  const listTools = useListTools(filtered, { filename: "speego-quotations.csv", name: (r) => r.rfqId, date: (r) => r.createdAt, dateLabel: "Ngày tạo", columns: [{ label: "Mã", value: (r) => r.quoteId }, { label: "Tên / nội dung", value: (r) => r.rfqId }, { label: "Ngày tạo", value: (r) => r.createdAt }, { label: "currency", value: (r) => r.currency }, { label: "status", value: (r) => r.status }] });
  const paging = usePagination(listTools.rows, 15, listTools.resetKey);

  const columns: Column<Quotation>[] = [
    { key: "id", header: "Báo giá", cell: (q) => <Link href={`/crm/bao-gia/${q.quoteId}`} className="font-mono text-xs font-medium text-primary hover:underline">{q.quoteId}</Link> },
    { key: "customer", header: "Khách hàng", cell: (q) => <span className="font-medium">{customerName.get(q.customerId) ?? q.customerId}</span> },
    { key: "rfq", header: "rfq_id", cell: (q) => <Link href={`/crm/rfq/${q.rfqId}`} className="font-mono text-xs text-muted-foreground hover:underline">{q.rfqId}</Link>, className: "hidden lg:table-cell" },
    { key: "total", header: "Tổng", align: "right", cell: (q) => formatMoney(quoteTotals(q).total, q.currency) },
    { key: "status", header: "Trạng thái", cell: (q) => <QuoteBadge value={q.status} /> },
    { key: "approval", header: "Phê duyệt (mô phỏng)", cell: (q) => <span className="text-xs text-muted-foreground">{approvalMeta[q.approval.state]}</span>, className: "hidden xl:table-cell" },
    { key: "date", header: "Ngày tạo", cell: (q) => <span className="tabular text-muted-foreground">{formatDate(q.createdAt)}</span>, className: "hidden md:table-cell" },
  ];

  return (
    <>
      <PageHeader title="Báo giá" description="Tách tiền hàng, cước và phụ phí. Tạo báo giá từ RFQ đã có giá hàng/cước." />
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <div className="relative min-w-60 flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Tìm báo giá" placeholder="Tìm mã báo giá, rfq_id, khách…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-8" />
        </div>
        <NativeSelect aria-label="Lọc trạng thái báo giá" className="w-48" value={status} onChange={(e) => setStatus(e.target.value as QuoteStatus | "")}>
          <option value="">Mọi trạng thái</option>
          {(Object.keys(quoteStatusMeta) as QuoteStatus[]).map((s) => (
            <option key={s} value={s}>
              {quoteStatusMeta[s].label}
            </option>
          ))}
        </NativeSelect>
      </div>
      {listTools.toolbar}
      <div className="space-y-4">
        <DataTable columns={columns} rows={paging.slice} getRowId={(q) => q.quoteId} empty={<EmptyState title="Không có báo giá phù hợp" />} />
        <Pagination page={paging.page} pages={paging.pages} total={paging.total} pageSize={paging.pageSize} onPageChange={paging.setPage} />
      </div>
    </>
  );
}
