"use client";

import { useState } from "react";
import { ledgerCategoryLabels, type LedgerReportGroup, type LedgerReportRow } from "@speego/shared";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { ServerPagination } from "@/components/shared/server-pagination";
import { Button } from "@/components/ui/button";
import { TableHScroll } from "@/features/crm/live/table-h-scroll";
import { formatMoney } from "@/lib/format";
import type { LedgerEntry } from "./ledger-live-view";
import { useListData } from "./list-query";

const monthLabel = (month: string | null) => month ? `${month.slice(5)}/${month.slice(0, 4)}` : "Chưa có ngày";

function LedgerReportEntries({ row, group, filters, onViewEntry }: {
  row: LedgerReportRow;
  group: LedgerReportGroup;
  filters: Record<string, string>;
  onViewEntry: (entry: LedgerEntry) => void;
}) {
  const entries = useListData<LedgerEntry>("/api/ke-toan/ledger", "entries", {
    ...filters, reportMonth: group === "customer" ? "" : row.month ?? "missing", customerKey: row.customerKey ?? "",
  }, "Không tải được giao dịch của nhóm", true);

  return <div className="mt-4 rounded-md border p-3">
    <h3 className="mb-2 font-medium">Giao dịch · {[
      ...(group === "customer" ? [] : [monthLabel(row.month)]),
      ...(group === "month" ? [] : [row.customerName ?? "Chưa gắn khách hàng"]),
    ].join(" · ")}</h3>
    {entries.error && <InlineAlert>{entries.error}</InlineAlert>}
    {entries.loading && <p role="status" className="text-sm text-muted-foreground">Đang tải giao dịch…</p>}
    <ul className="divide-y text-sm">
      {entries.rows.map((entry) => <li key={entry.id}>
        <button type="button" className="grid w-full gap-1 rounded px-2 py-2 text-left hover:bg-muted sm:grid-cols-[auto_1fr_auto] sm:gap-4" onClick={() => onViewEntry(entry)}>
          <span className="tabular-nums">{filters.dateField === "transaction" ? entry.transactionDate ?? "Chưa có ngày" : entry.date}</span>
          <span>{ledgerCategoryLabels[entry.category]} · {entry.counterparty}{entry.orderCode && ` · ${entry.orderCode}`}</span>
          <span className="tabular-nums">{entry.kind === "THU" ? "+" : "−"}{formatMoney(entry.amountVnd, "VND")}</span>
        </button>
      </li>)}
    </ul>
    {!entries.loading && !entries.error && entries.rows.length === 0 && <p className="text-sm text-muted-foreground">Chưa có giao dịch phù hợp.</p>}
    <ServerPagination paging={entries.paging} loading={entries.loading} />
  </div>;
}

export function LedgerReport({ filters, group, onGroupChange, onViewEntry }: {
  filters: Record<string, string>;
  group: LedgerReportGroup;
  onGroupChange: (group: LedgerReportGroup) => void;
  onViewEntry: (entry: LedgerEntry) => void;
}) {
  const { rows, loading, error, paging } = useListData<LedgerReportRow>("/api/ke-toan/ledger-report", "report", { ...filters, group }, "Không tải được báo cáo thu chi", true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((row) => row.id === selectedId);
  const byMonth = group !== "customer";
  const byCustomer = group !== "month";

  return <section id="ledger-report" aria-labelledby="ledger-report-title" className="mb-5 rounded-lg border p-4">
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id="ledger-report-title" className="font-semibold">Báo cáo thu chi</h2>
        <p className="text-sm text-muted-foreground">Theo bộ lọc sổ thu chi và {filters.dateField === "transaction" ? "ngày giao dịch" : "ngày ghi sổ"}. Số tiền đã quy đổi sang VND.</p>
      </div>
      <Field label="Tổng hợp theo" htmlFor="ledger-report-group">
        <NativeSelect id="ledger-report-group" value={group} onChange={(event) => { setSelectedId(null); onGroupChange(event.target.value as LedgerReportGroup); }}>
          <option value="month">Tháng</option>
          <option value="customer">Khách hàng</option>
          <option value="month-customer">Tháng và khách hàng</option>
        </NativeSelect>
      </Field>
    </div>
    {error && <InlineAlert className="mb-3">{error}</InlineAlert>}
    <TableHScroll><table className="w-full min-w-[580px] text-sm">
      <thead className="border-b bg-muted/50 text-muted-foreground"><tr>
        {byMonth && <th scope="col" className="px-3 py-2 text-left">Tháng</th>}
        {byCustomer && <th scope="col" className="px-3 py-2 text-left">Khách hàng</th>}
        {['Thu', 'Chi', 'Chênh lệch thu − chi', 'Giao dịch'].map((label) => <th key={label} scope="col" className="px-3 py-2 text-right">{label}</th>)}
      </tr></thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={byMonth && byCustomer ? 6 : 5} className="p-6 text-center text-muted-foreground">{loading ? "Đang tải báo cáo…" : "Không có giao dịch phù hợp."}</td></tr>}
        {rows.map((row) => <tr key={row.id} className="border-b last:border-0">
          {byMonth && <td className="px-3 py-2">{monthLabel(row.month)}</td>}
          {byCustomer && <td className="px-3 py-2">{row.customerName ?? "Chưa gắn khách hàng"}</td>}
          {[row.income, row.expense, row.balance].map((value, index) => <td key={index} className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatMoney(Number(value), "VND")}</td>)}
          <td className="px-3 py-2 text-right"><Button type="button" size="sm" variant="outline" aria-expanded={selected?.id === row.id}
            onClick={() => setSelectedId(selected?.id === row.id ? null : row.id)}>Xem {row.entryCount} dòng</Button></td>
        </tr>)}
      </tbody>
    </table></TableHScroll>
    <ServerPagination paging={paging} loading={loading} />
    {selected && <LedgerReportEntries row={selected} group={group} filters={filters} onViewEntry={onViewEntry} />}
  </section>;
}
