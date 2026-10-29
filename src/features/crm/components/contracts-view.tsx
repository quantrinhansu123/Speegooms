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
import { StatusBadge } from "@/components/shared/status-badge";
import { Input } from "@/components/ui/input";
import { depositMeta } from "@/config/crm";
import { formatDate, formatMoney } from "@/lib/format";
import { matchesQuery } from "@/lib/text";
import type { Contract, DepositStatus, RouteCode } from "@/types/crm";
import { useCrm, usePagination } from "../hooks";
import { ContractBadge, DepositBadge } from "./meta-badges";

export function ContractsView({ routeScope, accounting = false }: { routeScope?: RouteCode; accounting?: boolean } = {}) {
  const { data, all, user } = useCrm(routeScope);
  const [query, setQuery] = useState("");
  // Kế toán vào thẳng hàng đợi cần xác nhận cọc
  const [deposit, setDeposit] = useState<DepositStatus | "">(!accounting && user.role === "ke-toan" ? "cho-ke-toan" : "");
  const customerName = new Map(all.customers.map((c) => [c.customerId, c.name]));

  const filtered = data.contracts.filter(
    (c) => (!deposit || c.deposit.status === deposit) && matchesQuery(query, c.orderId, c.contractNo, c.rfqId, c.messId, customerName.get(c.customerId)),
  );
  const listTools = useListTools(filtered, { filename: "speego-contracts.csv", name: (r) => r.contractNo, date: (r) => r.createdAt, dateLabel: "Ngày tạo", columns: [{ label: "Mã", value: (r) => r.orderId }, { label: "Tên / nội dung", value: (r) => r.contractNo }, { label: "Ngày tạo", value: (r) => r.createdAt }, { label: "currency", value: (r) => r.currency }, { label: "value", value: (r) => r.value }, { label: "status", value: (r) => r.status }, { label: "deposit_status", value: (r) => r.deposit.status }] });
  const paging = usePagination(listTools.rows, 15, listTools.resetKey);

  const columns: Column<Contract>[] = [
    { key: "order", header: "order_id", cell: (c) => <Link href={`/crm/hop-dong/${c.orderId}`} className="font-mono text-xs font-medium text-primary hover:underline">{c.orderId}</Link> },
    { key: "no", header: "Hợp đồng", cell: (c) => <span className="text-xs text-muted-foreground">{c.contractNo}</span>, className: "hidden xl:table-cell" },
    { key: "customer", header: "Khách hàng", cell: (c) => <span className="font-medium">{customerName.get(c.customerId) ?? c.customerId}</span> },
    { key: "value", header: "Giá trị", align: "right", cell: (c) => formatMoney(c.value, c.currency) },
    { key: "status", header: "Hợp đồng", cell: (c) => <ContractBadge value={c.status} /> },
    { key: "deposit", header: "Cọc", cell: (c) => accounting ? <Link href={`/ke-toan/hop-dong/${c.orderId}`} className="inline-flex flex-wrap items-center gap-2 text-primary hover:underline"><DepositBadge value={c.deposit.status} /><span className="text-xs">Đối soát cọc</span></Link> : <DepositBadge value={c.deposit.status} /> },
    {
      key: "handover",
      header: "Bàn giao",
      cell: (c) =>
        c.handover.status === "da-ban-giao" ? <StatusBadge tone="success">Đã bàn giao</StatusBadge> : <span className="text-xs text-muted-foreground">Chưa</span>,
      className: "hidden lg:table-cell",
    },
    { key: "date", header: "Ngày tạo", cell: (c) => <span className="tabular text-muted-foreground">{formatDate(c.createdAt)}</span>, className: "hidden md:table-cell" },
  ];

  return (
    <>
      <PageHeader title={accounting ? "Hợp đồng" : "Hợp đồng và cọc"} description="Mỗi hợp đồng ứng với một đơn (order_id). Chỉ Kế toán xác nhận Đã cọc; chưa cọc thì chưa bàn giao đặt xưởng." />
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <div className="relative min-w-60 flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Tìm hợp đồng" placeholder="Tìm order_id, số hợp đồng, rfq_id, khách…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-8" />
        </div>
        <NativeSelect aria-label="Lọc trạng thái cọc" className="w-56" value={deposit} onChange={(e) => setDeposit(e.target.value as DepositStatus | "")}>
          <option value="">Mọi trạng thái cọc</option>
          {(Object.keys(depositMeta) as DepositStatus[]).map((s) => (
            <option key={s} value={s}>
              {depositMeta[s].label}
            </option>
          ))}
        </NativeSelect>
      </div>
      {listTools.toolbar}
      <div className="space-y-4">
        <DataTable columns={columns} rows={paging.slice} getRowId={(c) => c.orderId} empty={<EmptyState title="Không có hợp đồng phù hợp" description="Hợp đồng được tạo từ báo giá mà khách đã chấp nhận." />} />
        <Pagination page={paging.page} pages={paging.pages} total={paging.total} pageSize={paging.pageSize} onPageChange={paging.setPage} />
      </div>
    </>
  );
}
