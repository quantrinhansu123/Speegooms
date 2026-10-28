"use client";

import { FileQuestion, Hourglass, ListChecks, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Column } from "@/components/shared/data-table";
import { InlineAlert } from "@/components/shared/form-fields";
import { ListView } from "@/components/shared/list-view";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatMoney, formatVndCompact } from "@/lib/format";
import { buildLedger, type LedgerCategory, type LedgerEntry } from "@/services/accounting/rules";
import { useAccounting } from "../hooks";

const categoryLabels: Record<LedgerCategory, string> = {
  "coc-khach": "Cọc khách",
  "thu-khach": "Thu thanh toán khách",
  "chi-xuong": "Chi xưởng",
  "chi-van-chuyen": "Chi vận chuyển",
  "chi-khac": "Chi khác",
};

export function LedgerView() {
  const { crm, ops, acc, accActions, canAcc } = useAccounting();
  const [error, setError] = useState<string>();
  const entries = useMemo(() => buildLedger(crm, ops, acc), [crm, ops, acc]);
  const thu = entries.filter((e) => e.type === "thu").reduce((a, e) => a + e.amount, 0);
  const chi = entries.filter((e) => e.type === "chi").reduce((a, e) => a + e.amount, 0);
  const unreconciled = entries.filter((e) => !e.reconciled).length;
  const unmatched = acc.statementLines.filter((l) => !l.matchedOrderId && !l.matchedPaymentId).length;

  const columns: Column<LedgerEntry>[] = [
    { key: "d", header: "Ngày", cell: (e) => <span className="tabular text-muted-foreground">{formatDate(e.date)}</span> },
    { key: "t", header: "Loại", cell: (e) => <StatusBadge tone={e.type === "thu" ? "success" : "info"}>{e.type === "thu" ? "Thu" : "Chi"}</StatusBadge> },
    { key: "c", header: "Khoản mục", cell: (e) => categoryLabels[e.category], className: "hidden md:table-cell" },
    { key: "p", header: "Đối tượng", cell: (e) => <span className="block max-w-52 truncate">{e.counterparty}</span> },
    { key: "o", header: "Đơn hàng", cell: (e) => <Link href={`/van-hanh/don-hang/${e.orderId}`} className="font-mono text-xs text-muted-foreground hover:underline">{e.orderId}</Link>, className: "hidden lg:table-cell" },
    { key: "a", header: "Số tiền", align: "right", cell: (e) => <span className={e.type === "thu" ? "text-success" : ""}>{e.type === "thu" ? "+" : "−"}{formatMoney(e.amount, "VND")}</span> },
    { key: "r", header: "Tham chiếu", cell: (e) => <span className="font-mono text-xs text-muted-foreground">{e.ref || "—"}</span>, className: "hidden xl:table-cell" },
    {
      key: "x",
      header: "Đối soát",
      cell: (e) =>
        e.reconciled ? (
          <StatusBadge tone="success">Đã đối soát</StatusBadge>
        ) : canAcc("ledger.write") && e.paymentId ? (
          <Button size="sm" variant="outline" onClick={() => { const r = accActions.reconcilePayment(e.paymentId!); setError(r.ok ? undefined : r.error); }}><ListChecks /> Đối soát</Button>
        ) : (
          <StatusBadge tone="warning">Chờ đối soát</StatusBadge>
        ),
    },
  ];

  return (
    <ListView dateLabel="Ngày ghi sổ" dateValue={(r) => r.date}
      title="Lịch sử thu chi và đối soát"
      description="Sổ thu chi suy ra từ cọc đã xác nhận, khoản thu và đề nghị đã ghi nhận chi. Sao kê là dữ liệu demo."
      summary={
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Tổng thu ghi nhận" icon={TrendingUp} value={formatVndCompact(thu)} />
            <StatCard label="Tổng chi ghi nhận" icon={TrendingDown} value={formatVndCompact(chi)} />
            <StatCard label="Khoản chi chờ đối soát" icon={Hourglass} value={String(unreconciled)} caption="Chưa khớp sao kê" />
            <StatCard label="Dòng sao kê chưa khớp" icon={FileQuestion} value={String(unmatched)} caption="Không gắn được đơn hoặc đề nghị" />
          </div>
          {error && <InlineAlert className="mb-4">{error}</InlineAlert>}
        </>
      }
      columns={columns}
      rows={entries}
      getRowId={(e) => e.id}
      searchLabel="Tìm trong sổ thu chi"
      searchPlaceholder="Tìm đối tượng, đơn hàng, tham chiếu…"
      searchText={(e) => [e.counterparty, e.orderId, e.ref, e.id]}
      filters={[
        { id: "type", label: "Thu và chi", options: [{ value: "thu", label: "Chỉ thu" }, { value: "chi", label: "Chỉ chi" }], match: (e, v) => e.type === v, className: "w-40" },
        { id: "cat", label: "Mọi khoản mục", options: (Object.keys(categoryLabels) as LedgerCategory[]).map((k) => ({ value: k, label: categoryLabels[k] })), match: (e, v) => e.category === v },
      ]}
      toggles={[{ id: "open", label: "Chỉ chưa đối soát", match: (e) => !e.reconciled }]}
    />
  );
}
