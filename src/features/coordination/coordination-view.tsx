"use client";

import { useState } from "react";
import Link from "next/link";
import { AlarmClock, ClipboardList, Handshake, Users } from "lucide-react";
import { InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { ListView } from "@/components/shared/list-view";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { roleRouteScope, routeLabels } from "@/config/crm";
import { canPerform } from "@/config/permissions";
import { useOps } from "@/features/operations/hooks";
import { formatNumber } from "@/lib/format";
import type { Customer, RouteCode } from "@/types/crm";

interface Row extends Customer { active: number; overdue: number; openLeads: number }

/** Khách hàng & Điều phối: ai phụ trách từng khách, khách nào đang có đơn thực hiện và đổi người phụ trách. */
export function CoordinationView() {
  const { ready, crm, orders, user, crmActions, staffName } = useOps();
  const [error, setError] = useState<string>();
  if (!ready) return <TableSkeleton rows={8} columns={5} />;

  const scope = roleRouteScope[user.role];
  const canAssign = canPerform(user.role, "lead.write");
  const customers = crm.customers.filter((c) => !scope || c.route === scope);
  const rows: Row[] = customers.map((c) => {
    const mine = orders.filter((o) => o.contract.customerId === c.customerId && o.stage !== "da-giao");
    return {
      ...c,
      active: mine.length,
      overdue: mine.filter((o) => o.daysOverdue > 0).length,
      openLeads: crm.leads.filter((l) => l.customerId === c.customerId && l.careStatus !== "mat" && l.careStatus !== "da-co-rfq").length,
    };
  });
  const teamFor = (route: RouteCode) => crm.staff.filter((s) => s.team === (route === "vn" ? "sale-vn" : "sale-global"));

  const assign = (customerId: string, ownerId: string) => {
    const result = crmActions.updateCustomer(customerId, { ownerId });
    setError(result.ok ? undefined : result.error);
  };

  return <>
    <PageHeader title="Khách hàng & Điều phối" description="Người phụ trách từng khách hàng và các đơn đang thực hiện. Đổi người phụ trách ngay trong bảng." />
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Khách hàng" value={formatNumber(rows.length)} icon={Users} caption={scope ? routeLabels[scope] : "Cả hai tuyến"} href="/crm/khach-hang" />
      <StatCard label="Khách có đơn đang thực hiện" value={formatNumber(rows.filter((r) => r.active > 0).length)} icon={ClipboardList} caption="Đơn chưa ở giai đoạn đã giao" />
      <StatCard label="Khách có đơn quá hạn" value={formatNumber(rows.filter((r) => r.overdue > 0).length)} icon={AlarmClock} caption="Quá hạn giao so với kế hoạch" />
      <StatCard label="Khách chưa có đơn" value={formatNumber(rows.filter((r) => r.active === 0).length)} icon={Handshake} caption="Không có đơn đang thực hiện" />
    </div>
    {error && <InlineAlert className="mb-4">{error}</InlineAlert>}
    <ListView<Row>
      headingLevel={2}
      rows={rows}
      getRowId={(r) => r.customerId}
      searchLabel="Tìm khách hàng"
      searchPlaceholder="Tên khách, người liên hệ, quốc gia…"
      searchText={(r) => [r.name, r.contactName, r.country, r.customerId]}
      exportFilename="speego-khach-hang-dieu-phoi.csv"
      sort={(a, b) => b.active - a.active || a.name.localeCompare(b.name, "vi")}
      filters={[
        { id: "route", label: "Mọi tuyến", options: Object.entries(routeLabels).map(([value, label]) => ({ value, label })), match: (r, v) => r.route === v },
      ]}
      toggles={[{ id: "active", label: "Chỉ khách có đơn đang thực hiện", match: (r) => r.active > 0 }]}
      columns={[
        { key: "name", header: "Khách hàng", sortValue: (r) => r.name, exportValue: (r) => r.name, cell: (r) => <div><Link href={`/crm/khach-hang/${r.customerId}`} className="font-medium text-primary transition-colors hover:text-primary/70">{r.name}</Link><p className="text-xs text-muted-foreground">{r.contactName}</p></div> },
        { key: "route", header: "Tuyến", exportValue: (r) => routeLabels[r.route], cell: (r) => <div>{routeLabels[r.route]}<p className="text-xs text-muted-foreground">{r.country}</p></div> },
        { key: "owner", header: "Phụ trách", sortValue: (r) => staffName(r.ownerId), exportValue: (r) => staffName(r.ownerId), cell: (r) => canAssign
          ? <NativeSelect aria-label={`Người phụ trách ${r.name}`} className="w-full min-w-44" value={r.ownerId} onChange={(e) => assign(r.customerId, e.target.value)}>
            {teamFor(r.route).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </NativeSelect>
          : staffName(r.ownerId) },
        { key: "active", header: "Đơn đang thực hiện", align: "right", sortValue: (r) => r.active, exportValue: (r) => r.active, cell: (r) => formatNumber(r.active) },
        { key: "overdue", header: "Quá hạn", align: "right", sortValue: (r) => r.overdue, exportValue: (r) => r.overdue, cell: (r) => r.overdue > 0 ? <StatusBadge tone="danger">{r.overdue} đơn</StatusBadge> : <span className="text-muted-foreground">—</span> },
        { key: "leads", header: "Lead đang chăm", align: "right", sortValue: (r) => r.openLeads, exportValue: (r) => r.openLeads, cell: (r) => formatNumber(r.openLeads) },
      ]}
    />
  </>;
}
