"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import {
  quoteCurrencies, ledgerAmountVnd, ledgerMatchesStatement,
  createLedgerEntrySchema, createStatementSchema, ledgerCategories, ledgerCategoryLabels,
  type CreateLedgerEntryInput, type CreateStatementInput,
} from "@speego/shared";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { MoneyInput } from "@/components/shared/money-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FilterSelect, ListSearchBar, useAppliedSearch } from "@/features/crm/live/list-search-bar";
import { RowMenu } from "@/features/crm/live/row-menu";
import { TableHScroll } from "@/features/crm/live/table-h-scroll";
import { useSession } from "@/features/auth/session-provider";
import { canPerform } from "@/config/permissions";
import { ApiError, api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useListData } from "./list-query";
import { LedgerExcelActions } from "./ledger-excel-actions";

type LedgerEntry = {
  id: string; date: string; kind: "THU" | "CHI"; category: keyof typeof ledgerCategoryLabels;
  counterparty: string; orderCode: string | null; customerName: string | null; amount: number; currency: string; exchangeRate: number; amountVnd: number; reference: string | null;
  reconciled: boolean; statementId: string | null;
};
type Statement = {
  id: string; date: string; kind: "THU" | "CHI"; amount: number; currency: string; exchangeRate: number; amountVnd: number;
  counterparty: string; description: string | null; orderCode: string | null; ledgerId: string | null;
};
type Order = { code: string; customerName: string };
const orderLabel = (row: { orderCode: string | null; customerName: string | null }) => [row.orderCode, row.customerName].filter(Boolean).join(" · ") || "—";

type Mode = "ledger" | "statement";
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const categoriesFor = (kind: "THU" | "CHI") => ledgerCategories.filter((category) =>
  kind === "THU" ? category === "COC_KHACH" || category === "THU_KHACH" : category.startsWith("CHI_"));

function EntryDialog({
  mode, orders, entry, onClose, onSaved,
}: {
  mode: Mode; orders: Order[]; entry?: LedgerEntry; onClose: () => void; onSaved: () => void;
}) {
  const [date, setDate] = useState(entry?.date ?? today());
  const [kind, setKind] = useState<"THU" | "CHI">(entry?.kind ?? "THU");
  const [category, setCategory] = useState<LedgerEntry["category"]>(entry?.category ?? "COC_KHACH");
  const [counterparty, setCounterparty] = useState(entry?.counterparty ?? "");
  const [orderCode, setOrderCode] = useState(entry?.orderCode ?? "");
  const [amount, setAmount] = useState<number | null>(entry?.amount ?? null);
  const [currency, setCurrency] = useState(entry?.currency ?? "VND");
  const [exchangeRate, setExchangeRate] = useState<number | null>(entry?.exchangeRate ?? null);
  const [reference, setReference] = useState(entry?.reference ?? "");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const raw = { date, kind, category, counterparty, orderCode, amount: amount ?? 0,
      currency, exchangeRate: currency === "VND" ? 1 : exchangeRate, reference, description };
    const parsed = mode === "ledger"
      ? createLedgerEntrySchema.safeParse(raw)
      : createStatementSchema.safeParse(raw);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ"); return; }
    setSaving(true);
    setError(undefined);
    try {
      const path = mode === "ledger" ? "/api/ke-toan/ledger" : "/api/ke-toan/statements";
      await api(entry ? `${path}/${entry.id}` : path, { method: entry ? "PATCH" : "POST", body: JSON.stringify(parsed.data as CreateLedgerEntryInput | CreateStatementInput) });
      onSaved();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không lưu được dữ liệu");
      setSaving(false);
    }
  };

  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
    <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>{entry ? "Sửa thu chi" : mode === "ledger" ? "Nhập mới thu chi" : "Nhập dòng sao kê"}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ngày" htmlFor="ledger-date" required>
          <Input id="ledger-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="Loại" htmlFor="ledger-kind" required>
          <NativeSelect id="ledger-kind" value={kind} onChange={(event) => {
            const next = event.target.value as "THU" | "CHI";
            setKind(next); setCategory(next === "THU" ? "COC_KHACH" : "CHI_XUONG");
          }}>
            <option value="THU">Thu</option><option value="CHI">Chi</option>
          </NativeSelect>
        </Field>
        {mode === "ledger" && <Field label="Khoản mục" htmlFor="ledger-category" required>
          <NativeSelect id="ledger-category" value={category} onChange={(event) => setCategory(event.target.value as LedgerEntry["category"])}>
            {categoriesFor(kind).map((value) => <option key={value} value={value}>{ledgerCategoryLabels[value]}</option>)}
          </NativeSelect>
        </Field>}
        <Field label={kind === "THU" ? "Người/đơn vị nộp tiền" : "Người/đơn vị nhận tiền"} htmlFor="ledger-counterparty" required
          hint={kind === "THU" ? "Ví dụ: Nguyễn Phạm nộp tiền cọc. Người nộp có thể khác khách hàng." : "Ví dụ: Xưởng ABC, đơn vị vận chuyển hoặc nhân viên nhận tiền."}>
          <Input id="ledger-counterparty" maxLength={200} value={counterparty} onChange={(event) => setCounterparty(event.target.value)} />
        </Field>
        <Field label="Đơn hàng" htmlFor="ledger-order">
          <NativeSelect id="ledger-order" value={orderCode} onChange={(event) => {
            const code = event.target.value;
            setOrderCode(code);
            if (kind === "THU" && !counterparty.trim()) setCounterparty(orders.find(order => order.code === code)?.customerName ?? "");
          }}>
            <option value="">{mode === "ledger" ? "Chọn đơn hàng" : "Chưa xác định"}</option>
            {entry?.orderCode && !orders.some(order => order.code === entry.orderCode) && <option value={entry.orderCode}>{orderLabel(entry)}</option>}
            {orders.map((order) => <option key={order.code} value={order.code}>{order.code} · {order.customerName}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Loại tiền" htmlFor="ledger-currency" required>
          <NativeSelect id="ledger-currency" value={currency} onChange={event => { setCurrency(event.target.value); setExchangeRate(null); }}>
            {quoteCurrencies.map(code => <option key={code} value={code}>{code}</option>)}
          </NativeSelect>
        </Field>
        <Field label={`Số tiền (${currency})`} htmlFor="ledger-amount" required>
          <MoneyInput id="ledger-amount" value={amount} fractionDigits={currency === "VND" || currency === "JPY" ? 0 : 2} onValueChange={setAmount} />
        </Field>
        {currency !== "VND" && <Field label={`Tỷ giá: 1 ${currency} = … VND`} htmlFor="ledger-rate" required hint="Nhập tỷ giá tại thời điểm giao dịch, tối đa 6 chữ số thập phân.">
          <MoneyInput id="ledger-rate" value={exchangeRate} fractionDigits={6} onValueChange={setExchangeRate} />
        </Field>}
        <div className="sm:col-span-2 rounded-md bg-muted p-3" aria-live="polite">
          <p className="text-sm text-muted-foreground">Thành tiền VND</p>
          <p className="font-semibold">{amount != null && (currency === "VND" || (exchangeRate != null && exchangeRate > 0)) ? formatMoney(ledgerAmountVnd({ amount, currency, exchangeRate }), "VND") : "Nhập số tiền và tỷ giá"}</p>
        </div>
        {mode === "ledger" ? <>
          <Field label="Mã giao dịch / số chứng từ" htmlFor="ledger-reference" hint="Mã giao dịch ngân hàng, số phiếu thu/chi. Chưa có có thể để trống; không cần nhập lại mã đơn hàng.">
            <Input id="ledger-reference" maxLength={120} value={reference} onChange={(event) => setReference(event.target.value)} />
          </Field>
        </> : <Field label="Nội dung sao kê" htmlFor="ledger-description" className="sm:col-span-2">
          <Input id="ledger-description" maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>}
      </div>
      {error && <InlineAlert>{error}</InlineAlert>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Hủy</Button>
        <Button type="button" disabled={saving} onClick={() => void submit()}>{saving ? "Đang lưu…" : "Lưu"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function LedgerLiveView() {
  const user = useSession();
  const canWrite = canPerform(user.role, "ledger.write");
  const ledger = useListData<LedgerEntry>("/api/ke-toan/ledger", "entries", {}, "Không tải được sổ thu chi");
  const statements = useListData<Statement>("/api/ke-toan/statements", "statements", {}, "Không tải được sao kê");
  const [orders, setOrders] = useState<Order[]>([]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [reconciling, setReconciling] = useState<LedgerEntry | null>(null);
  const [viewing, setViewing] = useState<LedgerEntry | null>(null);
  const [editing, setEditing] = useState<LedgerEntry | null>(null);
  const [removing, setRemoving] = useState<LedgerEntry | null>(null);
  const [statementId, setStatementId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const filters = useAppliedSearch({ q: "", from: "", to: "", kind: "", category: "" });
  useEffect(() => {
    api<{ orders: Order[] }>("/api/ke-toan/ledger-orders")
      .then((body) => setOrders(body.orders))
      .catch((cause) => setError(cause instanceof ApiError ? cause.message : "Không tải được đơn hàng"));
  }, []);
  const reload = () => { ledger.reload(); statements.reload(); };
  const rows = useMemo(() => ledger.rows.filter((row) => {
    const f = filters.applied;
    const q = f.q.trim().toLocaleLowerCase();
    return (!q || [row.counterparty, row.orderCode ?? "", row.customerName ?? "", row.reference ?? ""].some((v) => v.toLocaleLowerCase().includes(q)))
      && (!f.from || row.date >= f.from) && (!f.to || row.date <= f.to)
      && (!f.kind || row.kind === f.kind) && (!f.category || row.category === f.category);
  }), [ledger.rows, filters.applied]);
  const thu = rows.filter((row) => row.kind === "THU").reduce((sum, row) => sum + row.amountVnd, 0);
  const chi = rows.filter((row) => row.kind === "CHI").reduce((sum, row) => sum + row.amountVnd, 0);
  const unmatched = statements.rows.filter((row) => !row.ledgerId);
  const candidates = reconciling ? unmatched.filter((row) =>
    ledgerMatchesStatement(reconciling, row)) : [];
  const remove = async () => {
    if (!removing) return;
    try {
      await api(`/api/ke-toan/ledger/${removing.id}`, { method: "DELETE" });
      setRemoving(null); reload();
    } catch (cause) {
      setRemoving(null);
      setError(cause instanceof ApiError ? cause.message : "Không xóa được khoản thu chi");
    }
  };
  const reconcile = async () => {
    if (!reconciling || !statementId) return;
    setBusy(true); setError(undefined);
    try {
      await api(`/api/ke-toan/ledger/${reconciling.id}/reconcile`, { method: "POST", body: JSON.stringify({ statementId }) });
      setReconciling(null); setStatementId(""); reload();
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : "Không đối soát được"); }
    finally { setBusy(false); }
  };
  return <>
    <PageHeader className="[&>div:last-child]:max-w-full" title="Thu chi & đối soát" description="Sổ thu chi và sao kê lưu trên hệ thống. Đối soát theo loại, loại tiền, số tiền và đơn hàng. Tổng thu/chi tính theo VND."
      actions={<div className="flex flex-wrap gap-2">
        <LedgerExcelActions rows={rows} canWrite={canWrite} loading={ledger.loading || !!ledger.error} onDone={reload} />
        {canWrite && <>
        <Button variant="outline" onClick={() => setMode("statement")}>Nhập sao kê</Button>
        <Button onClick={() => setMode("ledger")}><Plus aria-hidden /> Nhập mới</Button>
        </>}
      </div>} />
    {(error || ledger.error || statements.error) && <InlineAlert className="mb-4">{error || ledger.error || statements.error}</InlineAlert>}
    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Tổng thu</p><p className="text-xl font-semibold">{formatMoney(thu, "VND")}</p></div>
      <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Tổng chi</p><p className="text-xl font-semibold">{formatMoney(chi, "VND")}</p></div>
      <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Sao kê chưa khớp</p><p className="text-xl font-semibold">{unmatched.length}</p></div>
    </div>
    <ListSearchBar q={filters.draft.q} from={filters.draft.from} to={filters.draft.to}
      onQ={(v) => filters.set("q", v)} onFrom={(v) => filters.set("from", v)} onTo={(v) => filters.set("to", v)}
      onSearch={filters.search} onReset={filters.reset} dateLabel="Từ ngày" searchPlaceholder="Tìm người nộp/nhận, mã đơn, tên khách, chứng từ…">
      <FilterSelect id="ledger-kind-filter" label="Loại" value={filters.draft.kind} onChange={(v) => filters.set("kind", v)} options={[["THU", "Thu"], ["CHI", "Chi"]]} />
      <FilterSelect id="ledger-category-filter" label="Khoản mục" value={filters.draft.category} onChange={(v) => filters.set("category", v)} options={ledgerCategories.map((v) => [v, ledgerCategoryLabels[v]])} />
    </ListSearchBar>
    <TableHScroll><table className="w-full min-w-[1050px] text-sm">
      <thead><tr className="border-b bg-muted/50 text-left text-muted-foreground">
        {["Ngày", "Loại", "Khoản mục", "Đối tượng", "Đơn hàng", "Số tiền", "Mã giao dịch / chứng từ", "Đối soát", "Thao tác"].map((v) => <th key={v} className="px-3 py-2">{v}</th>)}
      </tr></thead>
      <tbody>{rows.length === 0 ? <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">{ledger.loading ? "Đang tải…" : "Chưa có khoản thu chi."}</td></tr> :
        rows.map((row) => <tr key={row.id} className="border-b last:border-0">
          <td className="px-3 py-3">{row.date}</td><td className="px-3 py-3">{row.kind === "THU" ? "Thu" : "Chi"}</td>
          <td className="px-3 py-3">{ledgerCategoryLabels[row.category]}</td><td className="px-3 py-3">{row.counterparty}</td>
          <td className="px-3 py-3">{orderLabel(row)}</td>
          <td className="px-3 py-3 whitespace-nowrap">{row.kind === "THU" ? "+" : "−"}{formatMoney(row.amount, row.currency)}{row.currency !== "VND" && <p className="text-xs text-muted-foreground">{formatMoney(row.amountVnd, "VND")}</p>}</td>
          <td className="px-3 py-3">{row.reference || "—"}</td>
          <td className="px-3 py-3">{row.reconciled ? "Đã đối soát" : canWrite ? <Button size="sm" variant="outline" onClick={() => { setReconciling(row); setStatementId(""); setError(undefined); }}>Đối soát</Button> : "Chờ đối soát"}</td>
          <td className="px-3 py-3"><RowMenu label={`Thao tác ${row.orderCode}`} items={[
            { key: "view", label: "Xem chi tiết", icon: <Eye />, onClick: () => setViewing(row) },
            ...(canWrite && !row.reconciled ? [
              { key: "edit", label: "Sửa", icon: <Pencil />, onClick: () => { setError(undefined); setEditing(row); } },
              { key: "delete", label: "Xóa", icon: <Trash2 />, destructive: true, onClick: () => setRemoving(row) },
            ] : []),
          ]} /></td>
        </tr>)}
      </tbody>
    </table></TableHScroll>
    {editing && <EntryDialog mode="ledger" orders={orders} entry={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    <ConfirmDialog open={removing !== null} onOpenChange={(open) => { if (!open) setRemoving(null); }} destructive
      title="Xóa khoản thu chi?" description={removing ? `${removing.counterparty} · ${formatMoney(removing.amount, removing.currency)} sẽ bị xóa.` : ""}
      confirmLabel="Xóa" onConfirm={() => void remove()} />
    <Dialog open={viewing !== null} onOpenChange={(open) => { if (!open) setViewing(null); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>Chi tiết thu chi</DialogTitle></DialogHeader>
        {viewing && <dl className="grid gap-x-6 gap-y-5 py-2 sm:grid-cols-2">
          {([
            ["Ngày", viewing.date],
            ["Loại", <StatusBadge key="k" tone={viewing.kind === "THU" ? "success" : "danger"}>{viewing.kind === "THU" ? "Thu" : "Chi"}</StatusBadge>],
            ["Khoản mục", ledgerCategoryLabels[viewing.category]],
            ["Đối tượng", viewing.counterparty],
            ["Đơn hàng", orderLabel(viewing)],
            ["Số tiền", `${viewing.kind === "THU" ? "+" : "−"}${formatMoney(viewing.amount, viewing.currency)}`],
            ["Tỷ giá", `1 ${viewing.currency} = ${viewing.exchangeRate.toLocaleString("vi-VN", { maximumFractionDigits: 6 })} VND`],
            ["Thành tiền VND", formatMoney(viewing.amountVnd, "VND")],
            ["Mã giao dịch / số chứng từ", viewing.reference || "—"],
            ["Đối soát", <StatusBadge key="r" tone={viewing.reconciled ? "success" : "warning"}>{viewing.reconciled ? "Đã đối soát" : "Chờ đối soát"}</StatusBadge>],
          ] as [string, React.ReactNode][]).map(([label, value]) => <div key={label} className="min-w-0">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-words text-base font-semibold">{value}</dd>
          </div>)}
        </dl>}
        <DialogFooter><Button variant="outline" onClick={() => setViewing(null)}>Đóng</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    {mode && <EntryDialog mode={mode} orders={orders} onClose={() => setMode(null)} onSaved={() => { setMode(null); reload(); }} />}
    <Dialog open={reconciling !== null} onOpenChange={(open) => { if (!open && !busy) setReconciling(null); }}>
      <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Đối soát dòng thu chi</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Chọn sao kê cùng loại và đơn hàng: sao kê VND khớp số quy đổi; sao kê ngoại tệ khớp loại tiền và nguyên tệ.</p>
        <NativeSelect aria-label="Dòng sao kê" value={statementId} onChange={(event) => setStatementId(event.target.value)}>
          <option value="">Chọn dòng sao kê</option>
          {candidates.map((row) => <option key={row.id} value={row.id}>{row.date} · {row.counterparty} · {formatMoney(row.amount, row.currency)}</option>)}
        </NativeSelect>
        {error && <InlineAlert>{error}</InlineAlert>}
        <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setReconciling(null)}>Hủy</Button>
          <Button disabled={busy || !statementId} onClick={() => void reconcile()}>{busy ? "Đang lưu…" : "Xác nhận đối soát"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
