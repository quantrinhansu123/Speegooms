"use client";

import Link from "next/link";
import { AlarmClock, FileSignature, FileText, Flame, Inbox, Send, TrendingUp, Users } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ListView } from "@/components/shared/list-view";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { CRM_TODAY, careStatusMeta, rfqStatusMeta, routeLabels, sourceLabels, temperatureMeta, transportLabels } from "@/config/crm";
import { useCrm } from "@/features/crm/hooks";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { routeFromOrigin } from "@/services/crm/rules";
import type { CareStatus, Contract, Lead, RouteCode, Rfq } from "@/types/crm";

const sumByCurrency = (contracts: Contract[]) =>
  (["VND", "USD"] as const)
    .map((cur) => ({ cur, total: contracts.filter((c) => c.currency === cur).reduce((s, c) => s + c.value, 0) }))
    .filter((x) => x.total > 0)
    .map((x) => formatMoney(x.total, x.cur))
    .join(" + ") || "—";

/** Dữ liệu CRM của một tuyến (Sale VN / Sale Global), không phụ thuộc vai trò đang xem. */
function useRouteData(route: RouteCode) {
  const crm = useCrm();
  const { all } = crm;
  const leads = all.leads.filter((l) => routeFromOrigin(l.goodsOrigin) === route);
  const rfqs = all.rfqs.filter((r) => r.route === route);
  const contracts = all.contracts.filter((c) => c.route === route);
  const customers = all.customers.filter((c) => c.route === route);
  const customerName = (id: string) => all.customers.find((c) => c.customerId === id)?.name ?? id;
  return { crm, all, leads, rfqs, contracts, customers, customerName };
}

/** Tổng quan một tuyến bán hàng: số liệu, phễu chăm sóc, hiệu suất từng người và việc sắp tới hạn. */
export function SaleTeamView({ route }: { route: RouteCode }) {
  const { all, leads, rfqs, contracts, customers, crm } = useRouteData(route);
  const signed = contracts.filter((c) => c.status === "da-ky");
  const hot = leads.filter((l) => l.temperature === "hot" && l.careStatus !== "mat").length;
  const openRfq = rfqs.filter((r) => ["moi", "cho-gia", "da-co-gia"].includes(r.status)).length;
  const pendingQuotes = all.quotations.filter((q) => q.status === "cho-duyet" && rfqs.some((r) => r.rfqId === q.rfqId)).length;

  const stages = (Object.keys(careStatusMeta) as CareStatus[]).map((s) => ({ key: s, count: leads.filter((l) => l.careStatus === s).length }));
  const staff = all.staff.filter((s) => s.team === (route === "vn" ? "sale-vn" : "sale-global"));
  const people = staff.map((s) => ({
    id: s.id, name: s.name, title: s.title,
    leads: leads.filter((l) => l.ownerId === s.id).length,
    rfqs: rfqs.filter((r) => r.ownerId === s.id).length,
    signed: signed.filter((c) => c.ownerId === s.id),
  }));
  const tasks = leads
    .filter((l) => l.nextTask && !l.nextTask.done && l.careStatus !== "mat")
    .sort((a, b) => a.nextTask!.dueOn.localeCompare(b.nextTask!.dueOn))
    .slice(0, 8);

  const stageCols: Column<(typeof stages)[number]>[] = [
    { key: "stage", header: "Giai đoạn", cell: (r) => <StatusBadge tone={careStatusMeta[r.key].tone}>{careStatusMeta[r.key].label}</StatusBadge> },
    { key: "count", header: "Lead", align: "right", cell: (r) => formatNumber(r.count) },
    { key: "share", header: "Tỷ trọng", align: "right", cell: (r) => `${leads.length ? Math.round((r.count / leads.length) * 100) : 0}%` },
  ];
  const peopleCols: Column<(typeof people)[number]>[] = [
    { key: "name", header: "Nhân sự", cell: (p) => <div><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.title}</p></div> },
    { key: "leads", header: "Lead", align: "right", cell: (p) => formatNumber(p.leads) },
    { key: "rfqs", header: "RFQ", align: "right", cell: (p) => formatNumber(p.rfqs) },
    { key: "signed", header: "HĐ đã ký", align: "right", cell: (p) => formatNumber(p.signed.length) },
    { key: "value", header: "Giá trị ký", align: "right", cell: (p) => sumByCurrency(p.signed) },
  ];

  return <>
    <PageHeader title={routeLabels[route]} description={`Tổng quan tuyến ${route === "vn" ? "Việt Nam" : "Global"}: lead, RFQ, hợp đồng và hiệu suất từng người. Số liệu đọc từ CRM.`} />
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard label="Lead đang theo dõi" value={formatNumber(leads.filter((l) => l.careStatus !== "mat").length)} icon={Users} caption={`${customers.length} khách hàng trong tuyến`} href="/crm/leads" />
      <StatCard label="Lead Hot" value={formatNumber(hot)} icon={Flame} caption="Chưa tính lead đã mất" href="/crm/leads" />
      <StatCard label="RFQ đang mở" value={formatNumber(openRfq)} icon={FileText} caption="Mới, chờ giá hoặc đã có giá" href="/crm/rfq" />
      <StatCard label="Báo giá chờ duyệt" value={formatNumber(pendingQuotes)} icon={Send} caption="Chờ Ban Giám đốc/quản lý duyệt" href="/crm/bao-gia" />
      <StatCard label="Hợp đồng đã ký" value={formatNumber(signed.length)} icon={FileSignature} caption="Không tính hủy hoặc soạn thảo" href="/crm/hop-dong" />
      <StatCard label="Giá trị đã ký" value={sumByCurrency(signed)} icon={TrendingUp} caption="Tách theo từng loại tiền, không quy đổi" />
    </div>

    <div className="grid gap-6 xl:grid-cols-2">
      <SectionCard title="Lead theo giai đoạn chăm sóc" flush>
        <DataTable className="rounded-t-none border-0 shadow-none" columns={stageCols} rows={stages} getRowId={(r) => r.key} />
      </SectionCard>
      <SectionCard title="Hiệu suất theo nhân sự" flush>
        <DataTable className="rounded-t-none border-0 shadow-none" columns={peopleCols} rows={people} getRowId={(p) => p.id} />
      </SectionCard>
    </div>

    <SectionCard className="mt-6" title="Việc chăm sóc sắp tới hạn" description={`Tính đến ngày demo ${formatDate(CRM_TODAY)}`}>
      {!crm.ready || tasks.length === 0
        ? <p className="text-sm text-muted-foreground">Không có việc nào đang chờ.</p>
        : <ul className="divide-y">{tasks.map((l) => <li key={l.messId} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
          <div className="min-w-0">
            <Link href={`/crm/leads/${l.messId}`} className="font-medium transition-colors hover:text-primary">{l.contactName}</Link>
            <p className="text-muted-foreground">{l.nextTask!.title}</p>
          </div>
          <StatusBadge tone={l.nextTask!.dueOn < CRM_TODAY ? "danger" : "info"}>{l.nextTask!.dueOn < CRM_TODAY ? "Quá hạn" : "Hạn"} {formatDate(l.nextTask!.dueOn)}</StatusBadge>
        </li>)}</ul>}
    </SectionCard>
  </>;
}

/** Sales MKT Intern: hàng đợi lead mới từ Marketing cần được tiếp nhận và chăm sóc (tuyến Việt Nam). */
export function MktInternQueueView() {
  const { leads, all } = useRouteData("vn");
  const staffName = (id: string) => all.staff.find((s) => s.id === id)?.name ?? id;
  const queue = leads.filter((l) => l.careStatus === "moi" || l.careStatus === "dang-cham");
  const noTask = queue.filter((l) => !l.nextTask || l.nextTask.done).length;
  const overdue = queue.filter((l) => l.nextTask && !l.nextTask.done && l.nextTask.dueOn < CRM_TODAY).length;

  const columns: Column<Lead>[] = [
    { key: "lead", header: "Lead", sortValue: (l) => l.contactName, exportValue: (l) => l.contactName, cell: (l) => <div><Link href={`/crm/leads/${l.messId}`} className="font-medium text-primary transition-colors hover:text-primary/70">{l.contactName}</Link><p className="text-xs text-muted-foreground">{l.company || l.messId}</p></div> },
    { key: "source", header: "Nguồn", sortValue: (l) => l.source, exportValue: (l) => sourceLabels[l.source], cell: (l) => sourceLabels[l.source] },
    { key: "temp", header: "Phân loại", cell: (l) => <StatusBadge tone={temperatureMeta[l.temperature].tone}>{temperatureMeta[l.temperature].label}</StatusBadge> },
    { key: "status", header: "Trạng thái", cell: (l) => <StatusBadge tone={careStatusMeta[l.careStatus].tone}>{careStatusMeta[l.careStatus].label}</StatusBadge> },
    { key: "owner", header: "Phụ trách", sortValue: (l) => staffName(l.ownerId), exportValue: (l) => staffName(l.ownerId), cell: (l) => staffName(l.ownerId) },
    { key: "next", header: "Việc tiếp theo", cell: (l) => l.nextTask && !l.nextTask.done ? <div>{l.nextTask.title}<p className={l.nextTask.dueOn < CRM_TODAY ? "text-xs text-danger" : "text-xs text-muted-foreground"}>{formatDate(l.nextTask.dueOn)}</p></div> : <span className="text-muted-foreground">Chưa đặt việc</span> },
    { key: "created", header: "Ngày tạo", sortValue: (l) => l.createdAt, exportValue: (l) => l.createdAt.slice(0, 10), cell: (l) => formatDate(l.createdAt.slice(0, 10)) },
  ];

  return <>
    <div className="mb-6 grid gap-4 sm:grid-cols-3">
      <StatCard label="Lead trong hàng đợi" value={formatNumber(queue.length)} icon={Inbox} caption="Mới hoặc đang chăm sóc" />
      <StatCard label="Chưa đặt việc tiếp theo" value={formatNumber(noTask)} icon={Users} caption="Cần đặt lịch chăm sóc" />
      <StatCard label="Việc quá hạn" value={formatNumber(overdue)} icon={AlarmClock} caption={`Tính đến ${formatDate(CRM_TODAY)}`} />
    </div>
    <ListView<Lead>
      headingLevel={2}
      rows={queue}
      columns={columns}
      getRowId={(l) => l.messId}
      searchLabel="Tìm lead"
      searchPlaceholder="Tên, công ty, mã mess…"
      searchText={(l) => [l.contactName, l.company, l.messId]}
      dateValue={(l) => l.createdAt}
      exportFilename="speego-sales-mkt-intern.csv"
      filters={[{ id: "temp", label: "Mọi phân loại", options: Object.entries(temperatureMeta).map(([value, m]) => ({ value, label: m.label })), match: (l, v) => l.temperature === v }]}
      toggles={[{ id: "notask", label: "Chưa đặt việc", match: (l) => !l.nextTask || l.nextTask.done }]}
      sort={(a, b) => b.createdAt.localeCompare(a.createdAt)}
    />
  </>;
}

/** Sale Mỹ: các RFQ của tuyến Global có điểm đến Hoa Kỳ. */
export function SaleUsView() {
  const { rfqs, contracts, customerName } = useRouteData("global");
  const us = rfqs.filter((r) => r.destination.startsWith("Hoa Kỳ"));
  const usIds = new Set(us.map((r) => r.rfqId));
  const usContracts = contracts.filter((c) => c.status === "da-ky" && usIds.has(c.rfqId));
  const open = us.filter((r) => ["moi", "cho-gia", "da-co-gia"].includes(r.status)).length;
  const waiting = us.filter((r) => r.status === "cho-gia").length;

  const columns: Column<Rfq>[] = [
    { key: "rfq", header: "RFQ", sortValue: (r) => r.rfqId, exportValue: (r) => r.rfqId, cell: (r) => <div><Link href={`/crm/rfq/${r.rfqId}`} className="font-mono text-xs font-medium text-primary transition-colors hover:text-primary/70">{r.rfqId}</Link><p className="text-xs text-muted-foreground">{formatDate(r.createdAt.slice(0, 10))}</p></div> },
    { key: "customer", header: "Khách hàng", sortValue: (r) => customerName(r.customerId), exportValue: (r) => customerName(r.customerId), cell: (r) => customerName(r.customerId) },
    { key: "goods", header: "Hàng hóa", exportValue: (r) => r.goodsName, cell: (r) => <div>{r.goodsName}<p className="text-xs text-muted-foreground">{formatNumber(r.quantity)} {r.unit}</p></div> },
    { key: "dest", header: "Điểm đến", sortValue: (r) => r.destination, exportValue: (r) => r.destination, cell: (r) => r.destination.replace("Hoa Kỳ – ", "") },
    { key: "mode", header: "Vận chuyển", exportValue: (r) => transportLabels[r.transportMode], cell: (r) => transportLabels[r.transportMode] },
    { key: "target", header: "Cần hàng", sortValue: (r) => r.targetDate, exportValue: (r) => r.targetDate, cell: (r) => formatDate(r.targetDate) },
    { key: "status", header: "Trạng thái", exportValue: (r) => rfqStatusMeta[r.status].label, cell: (r) => <StatusBadge tone={rfqStatusMeta[r.status].tone}>{rfqStatusMeta[r.status].label}</StatusBadge> },
  ];

  return <>
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="RFQ đi Hoa Kỳ" value={formatNumber(us.length)} icon={FileText} caption="Mọi trạng thái" />
      <StatCard label="RFQ đang mở" value={formatNumber(open)} icon={Inbox} caption="Mới, chờ giá hoặc đã có giá" />
      <StatCard label="Đang chờ giá" value={formatNumber(waiting)} icon={AlarmClock} caption="Đã gửi Sourcing/Logistics" />
      <StatCard label="Giá trị đã ký" value={sumByCurrency(usContracts)} icon={TrendingUp} caption={`${usContracts.length} hợp đồng`} />
    </div>
    <ListView<Rfq>
      headingLevel={2}
      rows={us}
      columns={columns}
      getRowId={(r) => r.rfqId}
      searchLabel="Tìm RFQ"
      searchPlaceholder="Mã RFQ, khách hàng, hàng hóa…"
      searchText={(r) => [r.rfqId, customerName(r.customerId), r.goodsName, r.destination]}
      dateValue={(r) => r.createdAt}
      exportFilename="speego-sale-my.csv"
      filters={[{ id: "status", label: "Mọi trạng thái", options: Object.entries(rfqStatusMeta).map(([value, m]) => ({ value, label: m.label })), match: (r, v) => r.status === v }]}
      sort={(a, b) => b.createdAt.localeCompare(a.createdAt)}
    />
  </>;
}
