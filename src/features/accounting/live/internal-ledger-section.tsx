"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { InlineAlert } from "@/components/shared/form-fields";
import { ServerPagination } from "@/components/shared/server-pagination";
import { Button } from "@/components/ui/button";
import { departmentLabels } from "@/config/departments";
import { FilterSelect, ListSearchBar, useAppliedSearch } from "@/features/crm/live/list-search-bar";
import { TableHScroll } from "@/features/crm/live/table-h-scroll";
import { formatDate, formatMoney } from "@/lib/format";
import { EntryDialog, type LedgerEntry } from "./ledger-live-view";
import { useListData } from "./list-query";

export function InternalLedgerSection({ canWrite }: { canWrite: boolean }) {
  const filters = useAppliedSearch({ q: "", from: "", to: "", kind: "" });
  const ledger = useListData<LedgerEntry>("/api/ke-toan/ledger", "entries", { ...filters.applied, scope: "internal" }, "Không tải được thu chi nội bộ", true);
  const accounts = useListData<string>("/api/ke-toan/receiving-accounts", "accounts", {}, "Không tải được tài khoản nhận", false, canWrite);
  const [editing, setEditing] = useState<LedgerEntry | "new" | null>(null);
  const [notice, setNotice] = useState(false);

  return <>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">Ghi nhận khoản đã thu hoặc đã chi. Các dòng này tự xuất hiện trong sổ Thu chi &amp; đối soát.</p>
      {canWrite && <Button onClick={() => { setNotice(false); setEditing("new"); }}><Plus aria-hidden /> Nhập thu chi nội bộ</Button>}
    </div>
    {notice && <InlineAlert tone="success" className="mb-4">Đã lưu khoản thu chi nội bộ.</InlineAlert>}
    {(ledger.error || accounts.error) && <InlineAlert className="mb-4">{ledger.error || accounts.error}</InlineAlert>}
    <ListSearchBar q={filters.draft.q} from={filters.draft.from} to={filters.draft.to}
      onQ={(value) => filters.set("q", value)} onFrom={(value) => filters.set("from", value)} onTo={(value) => filters.set("to", value)}
      onSearch={filters.search} onReset={filters.reset} activeCount={filters.activeCount} dateLabel="Ngày ghi sổ"
      searchPlaceholder="Tìm hạng mục, nội dung hoặc đối tượng…">
      <FilterSelect id="internal-kind-filter" label="Loại" value={filters.draft.kind} onChange={(value) => filters.set("kind", value)} options={[["THU", "Thu"], ["CHI", "Chi"]]} />
    </ListSearchBar>
    <TableHScroll>
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b bg-muted/50 text-muted-foreground"><tr>
          {["Ngày ghi sổ", "Loại", "Phòng ban", "Hạng mục", "Nội dung", "Đối tượng", "Số tiền", "Tài khoản", "Đối soát"].map((label) => <th key={label} scope="col" className="px-3 py-2">{label}</th>)}
          {canWrite && <th scope="col" className="px-3 py-2">Thao tác</th>}
        </tr></thead>
        <tbody>
          {ledger.rows.length === 0 && <tr><td colSpan={canWrite ? 10 : 9} className="p-6 text-center text-muted-foreground">{ledger.loading ? "Đang tải…" : "Chưa có khoản thu chi nội bộ phù hợp."}</td></tr>}
          {ledger.rows.map((row) => <tr key={row.id} className="border-b last:border-0">
            <td className="whitespace-nowrap px-3 py-3">{formatDate(row.date)}</td>
            <td className="px-3 py-3">{row.kind === "THU" ? "Thu" : "Chi"}</td>
            <td className="px-3 py-3">{(departmentLabels as Record<string, string>)[row.department ?? ""] ?? row.department}</td>
            <td className="px-3 py-3">{row.item}</td>
            <td className="min-w-44 break-words px-3 py-3">{row.content}</td>
            <td className="px-3 py-3">{row.counterparty}</td>
            <td className="whitespace-nowrap px-3 py-3">{formatMoney(row.amount, row.currency)}</td>
            <td className="px-3 py-3">{row.receivingAccount ?? "—"}</td>
            <td className="px-3 py-3">{row.reconciled ? "Đã đối soát" : "Chờ đối soát"}</td>
            {canWrite && <td className="px-3 py-3">{!row.reconciled && <Button variant="ghost" size="sm" onClick={() => { setNotice(false); setEditing(row); }}>Sửa</Button>}</td>}
          </tr>)}
        </tbody>
      </table>
    </TableHScroll>
    <ServerPagination paging={ledger.paging} loading={ledger.loading} />
    {editing && <EntryDialog mode="ledger" internal entry={editing === "new" ? undefined : editing}
      accounts={accounts.rows} onAccountAdded={accounts.reload} onClose={() => setEditing(null)}
      onSaved={() => { setEditing(null); setNotice(true); ledger.reload(); }} />}
  </>;
}
