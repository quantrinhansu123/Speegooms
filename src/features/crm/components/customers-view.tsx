"use client";

import { useListTools } from "@/components/shared/list-tools";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Search } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Input } from "@/components/ui/input";
import { routeLabels } from "@/config/crm";
import { matchesQuery } from "@/lib/text";
import { findDuplicateGroups } from "@/services/crm/rules";
import type { Customer } from "@/types/crm";
import { useCrm, usePagination } from "../hooks";

export function DuplicateAlert({ customers, focusId }: { customers: Customer[]; focusId?: string }) {
  const groups = useMemo(() => {
    const g = findDuplicateGroups(customers);
    return focusId ? g.filter((x) => x.customers.some((c) => c.customerId === focusId)) : g;
  }, [customers, focusId]);
  if (groups.length === 0) return null;
  return (
    <InlineAlert tone="warning" className="mb-4">
      <p className="flex items-center gap-1.5 font-medium">
        <AlertTriangle aria-hidden className="size-4" />
        {focusId ? "Khách hàng này có thể bị trùng" : `Phát hiện ${groups.length} nhóm khách hàng có thể trùng`} (cảnh báo demo)
      </p>
      <ul className="mt-2 space-y-1.5">
        {groups.map((g) => (
          <li key={g.customers.map((c) => c.customerId).join("|")}>
            <span className="font-medium">{g.reason}: </span>
            {g.customers.map((c, i) => (
              <span key={c.customerId}>
                {i > 0 && " · "}
                <Link href={`/crm/khach-hang/${c.customerId}`} className="underline">
                  {c.customerId} {c.name}
                </Link>
              </span>
            ))}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs">Chỉ gợi ý để rà soát. Hệ thống không tự gộp khách, quy tắc chống trùng chính thức chưa được duyệt.</p>
    </InlineAlert>
  );
}

export function CustomersView() {
  const { data, all } = useCrm();
  const [query, setQuery] = useState("");
  const [route, setRoute] = useState("");

  const counts = useMemo(() => {
    const m = new Map<string, { leads: number; rfqs: number; orders: number }>();
    const get = (id: string) => m.get(id) ?? { leads: 0, rfqs: 0, orders: 0 };
    for (const l of all.leads) m.set(l.customerId, { ...get(l.customerId), leads: get(l.customerId).leads + 1 });
    for (const r of all.rfqs) m.set(r.customerId, { ...get(r.customerId), rfqs: get(r.customerId).rfqs + 1 });
    for (const c of all.contracts) m.set(c.customerId, { ...get(c.customerId), orders: get(c.customerId).orders + 1 });
    return m;
  }, [all.leads, all.rfqs, all.contracts]);
  const dupIds = useMemo(() => new Set(findDuplicateGroups(data.customers).flatMap((g) => g.customers.map((c) => c.customerId))), [data.customers]);

  const filtered = data.customers.filter((c) => (!route || c.route === route) && matchesQuery(query, c.name, c.contactName, c.phone, c.email, c.customerId));
  const listTools = useListTools(filtered, { filename: "speego-customers.csv", name: (r) => r.name, date: (r) => r.createdAt, dateLabel: "Ngày tạo", columns: [{ label: "Mã", value: (r) => r.customerId }, { label: "Tên / nội dung", value: (r) => r.name }, { label: "Ngày tạo", value: (r) => r.createdAt }, { label: "route", value: (r) => r.route }, { label: "contact", value: (r) => r.contactName }] });
  const paging = usePagination(listTools.rows, 15, listTools.resetKey);

  const columns: Column<Customer>[] = [
    { key: "id", header: "Mã", cell: (c) => <span className="font-mono text-xs">{c.customerId}</span> },
    {
      key: "name",
      header: "Khách hàng",
      cell: (c) => (
        <div className="min-w-0">
          <Link href={`/crm/khach-hang/${c.customerId}`} className="font-medium hover:text-primary hover:underline">
            {c.name}
          </Link>
          <p className="max-w-56 truncate text-xs text-muted-foreground">{c.contactName}</p>
        </div>
      ),
    },
    { key: "phone", header: "Điện thoại", cell: (c) => <span className="tabular">{c.phone}</span>, className: "hidden md:table-cell" },
    { key: "route", header: "Tuyến", cell: (c) => routeLabels[c.route], className: "hidden lg:table-cell" },
    { key: "leads", header: "Lead", align: "right", cell: (c) => counts.get(c.customerId)?.leads ?? 0 },
    { key: "rfqs", header: "RFQ", align: "right", cell: (c) => counts.get(c.customerId)?.rfqs ?? 0 },
    { key: "orders", header: "Đơn", align: "right", cell: (c) => counts.get(c.customerId)?.orders ?? 0 },
    {
      key: "dup",
      header: "Cảnh báo",
      cell: (c) =>
        dupIds.has(c.customerId) ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
            <AlertTriangle aria-hidden className="size-3.5" /> Có thể trùng
          </span>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader title="Khách hàng" description="Sổ khách hàng với lịch sử lead, RFQ, hợp đồng và đơn hàng." />
      <DuplicateAlert customers={data.customers} />
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <div className="relative min-w-60 flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Tìm khách hàng" placeholder="Tìm tên, người liên hệ, SĐT, email, mã…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-8" />
        </div>
        {!data.customers.every((c) => c.route === data.customers[0]?.route) && (
          <NativeSelect aria-label="Lọc tuyến" className="w-44" value={route} onChange={(e) => setRoute(e.target.value)}>
            <option value="">Cả hai tuyến</option>
            <option value="vn">Sale Việt Nam</option>
            <option value="global">Sale Global</option>
          </NativeSelect>
        )}
      </div>
      {listTools.toolbar}
      <div className="space-y-4">
        <DataTable columns={columns} rows={paging.slice} getRowId={(c) => c.customerId} empty={<EmptyState title="Không có khách hàng phù hợp" />} />
        <Pagination page={paging.page} pages={paging.pages} total={paging.total} pageSize={paging.pageSize} onPageChange={paging.setPage} />
      </div>
    </>
  );
}
