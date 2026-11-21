"use client";

import { ServerPagination } from "@/components/shared/server-pagination";

import { useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import {
  quoteCurrencies, ledgerAmountVnd, createReceivingAccountSchema,
  createLedgerEntrySchema, createStatementSchema, isInternalLedgerCategory, ledgerCategories, ledgerCategoryLabels,
  type CreateLedgerEntryInput, type CreateStatementInput, type LedgerReportGroup,
} from "@speego/shared";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { MoneyInput } from "@/components/shared/money-input";
import { MultiCombobox } from "@/components/shared/multi-combobox";
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
import { departmentLabels, departmentOptions } from "@/config/departments";
import { ApiError, api, fetchListPages } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { listQuery, useListData } from "./list-query";
import { LedgerExcelActions } from "./ledger-excel-actions";
import { LedgerOrderSelect, type LedgerOrder } from "./ledger-order-select";
import { LedgerReport } from "./ledger-report";

export type LedgerEntry = {
  id: string; date: string; kind: "THU" | "CHI"; category: keyof typeof ledgerCategoryLabels;
  counterparty: string; orderCode: string | null; customerName: string | null; amount: number; currency: string; exchangeRate: number; amountVnd: number; reference: string | null;
  reconciled: boolean; statementId: string | null;
  receivingAccount: string | null; transactionDate: string | null;
  department: string | null; item: string | null; content: string | null;
};
type Statement = {
  id: string; date: string; kind: "THU" | "CHI"; amount: number; currency: string; exchangeRate: number; amountVnd: number;
  counterparty: string; description: string | null; orderCode: string | null; ledgerId: string | null;
};
const orderLabel = (row: { orderCode: string | null; customerName: string | null }) => [row.orderCode, row.customerName].filter(Boolean).join(" · ") || "—";

type Mode = "ledger" | "statement";
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const categoriesFor = (kind: "THU" | "CHI") => ledgerCategories.filter((category) =>
  !isInternalLedgerCategory(category) && (category.startsWith(`${kind}_`) || (kind === "THU" && category === "COC_KHACH")));

export function EntryDialog({
  mode, accounts, onAccountAdded, entry, onClose, onSaved, internal = false,
}: {
  mode: Mode; accounts: string[]; onAccountAdded: (account: string) => void; entry?: LedgerEntry; onClose: () => void; onSaved: () => void; internal?: boolean;
}) {
  const isInternal = internal || Boolean(entry && isInternalLedgerCategory(entry.category));
  const [date, setDate] = useState(entry?.date ?? today());
  const [kind, setKind] = useState<"THU" | "CHI">(entry?.kind ?? "THU");
  const [category, setCategory] = useState<LedgerEntry["category"]>(entry?.category ?? "COC_KHACH");
  const [counterparty, setCounterparty] = useState(entry?.counterparty ?? "");
  const [order, setOrder] = useState<LedgerOrder | null>(entry?.orderCode ? { code: entry.orderCode, customerName: entry.customerName ?? "" } : null);
  const [department, setDepartment] = useState(entry?.department ?? "");
  const [item, setItem] = useState(entry?.item ?? "");
  const [content, setContent] = useState(entry?.content ?? "");
  const [amount, setAmount] = useState<number | null>(entry?.amount ?? null);
  const [currency, setCurrency] = useState(entry?.currency ?? "VND");
  const [exchangeRate, setExchangeRate] = useState<number | null>(entry?.exchangeRate ?? null);
  const [reference, setReference] = useState(entry?.reference ?? "");
  const [transactionDate, setTransactionDate] = useState(entry ? entry.transactionDate ?? "" : isInternal ? today() : "");
  const [receivingAccount, setReceivingAccount] = useState(entry?.receivingAccount ?? "");
  const [addingAccount, setAddingAccount] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const addAccount = async () => {
    const parsed = createReceivingAccountSchema.safeParse({ name: accountName });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message); return; }
    setSavingAccount(true); setError(undefined);
    try {
      const body = await api<{ account: string }>("/api/ke-toan/receiving-accounts", { method: "POST", body: JSON.stringify(parsed.data) });
      onAccountAdded(body.account); setReceivingAccount(body.account); setAddingAccount(false); setAccountName("");
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : "Không thêm được tài khoản nhận"); }
    finally { setSavingAccount(false); }
  };
  const submit = async () => {
    const raw = { date, kind, category: isInternal ? `${kind}_NOI_BO` : category, counterparty, orderCode: order?.code, amount: amount ?? 0,
      currency, exchangeRate: currency === "VND" ? 1 : exchangeRate, reference, description,
      ...(isInternal ? { department, item, content } : {}),
      transactionDate: transactionDate || null, receivingAccount: receivingAccount || null };
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

  return <Dialog open onOpenChange={(open) => { if (!open && !saving && !savingAccount) onClose(); }}>
    <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>{isInternal ? (entry ? "Sửa thu chi nội bộ" : "Nhập thu chi nội bộ") : entry ? "Sửa thu chi" : mode === "ledger" ? "Nhập mới thu chi" : "Nhập dòng sao kê"}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ngày" htmlFor="ledger-date" required>
          <Input id="ledger-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        {mode === "ledger" && <Field label="Ngày giao dịch" htmlFor="ledger-transaction-date" hint="Ngày giao dịch thực tế, độc lập với Ngày ghi sổ.">
          <Input id="ledger-transaction-date" type="date" value={transactionDate} onChange={event => setTransactionDate(event.target.value)} />
        </Field>}
        <Field label="Loại" htmlFor="ledger-kind" required>
          <NativeSelect id="ledger-kind" value={kind} onChange={(event) => {
            const next = event.target.value as "THU" | "CHI";
            setKind(next); setCategory(next === "THU" ? "COC_KHACH" : "CHI_XUONG");
          }}>
            <option value="THU">Thu</option><option value="CHI">Chi</option>
          </NativeSelect>
        </Field>
        {mode === "ledger" && !isInternal && <Field label="Khoản mục" htmlFor="ledger-category" required>
          <NativeSelect id="ledger-category" value={category} onChange={(event) => setCategory(event.target.value as LedgerEntry["category"])}>
            {categoriesFor(kind).map((value) => <option key={value} value={value}>{ledgerCategoryLabels[value]}</option>)}
          </NativeSelect>
        </Field>}
        <Field label={kind === "THU" ? "Người/đơn vị nộp tiền" : "Người/đơn vị nhận tiền"} htmlFor="ledger-counterparty" required
          hint={kind === "THU" ? "Ví dụ: Nguyễn Phạm nộp tiền cọc. Người nộp có thể khác khách hàng." : "Ví dụ: Xưởng ABC, đơn vị vận chuyển hoặc nhân viên nhận tiền."}>
          <Input id="ledger-counterparty" maxLength={200} value={counterparty} onChange={(event) => setCounterparty(event.target.value)} />
        </Field>
        {isInternal ? <>
          <Field label="Phòng ban" htmlFor="ledger-department" required>
            <NativeSelect id="ledger-department" value={department} onChange={(event) => setDepartment(event.target.value)}>
              <option value="">Chọn phòng ban</option>
              {department && !departmentOptions.some(option => option.value === department) && <option value={department}>{department}</option>}
              {departmentOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Hạng mục nội bộ" htmlFor="ledger-item" required>
            <Input id="ledger-item" value={item} maxLength={120} onChange={(event) => setItem(event.target.value)} />
          </Field>
          <Field label="Nội dung" htmlFor="ledger-content" required className="sm:col-span-2">
            <Input id="ledger-content" value={content} maxLength={500} onChange={(event) => setContent(event.target.value)} />
          </Field>
        </> : <Field label="Đơn hàng (hợp đồng)" htmlFor="ledger-order">
          <LedgerOrderSelect value={order} onChange={(selected) => {
            setOrder(selected);
            if (kind === "THU" && !counterparty.trim()) setCounterparty(selected?.customerName ?? "");
          }} />
        </Field>}
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
          <Field label={isInternal && kind === "CHI" ? "Tài khoản chi" : "Tài khoản nhận"} htmlFor="ledger-account" className="sm:col-span-2">
            <NativeSelect id="ledger-account" value={receivingAccount} onChange={event => setReceivingAccount(event.target.value)}>
              <option value="">Chưa chọn tài khoản</option>
              {receivingAccount && !accounts.includes(receivingAccount) && <option value={receivingAccount}>{receivingAccount}</option>}
              {accounts.map(account => <option key={account} value={account}>{account}</option>)}
            </NativeSelect>
            <Button type="button" variant="outline" size="sm" className="mt-2" disabled={savingAccount} onClick={() => setAddingAccount(!addingAccount)}><Plus aria-hidden /> Thêm tài khoản nhận</Button>
          </Field>
          {addingAccount && <Field label="Tài khoản nhận mới" htmlFor="ledger-new-account" className="sm:col-span-2" hint="Nhập ngân hàng, số tài khoản và chủ tài khoản để dễ nhận biết.">
            <Input id="ledger-new-account" maxLength={200} value={accountName} onChange={event => setAccountName(event.target.value)} disabled={savingAccount} />
            <Button type="button" className="mt-2" disabled={savingAccount} onClick={() => void addAccount()}>{savingAccount ? "Đang lưu…" : "Lưu tài khoản"}</Button>
          </Field>}
          {(isInternal || entry?.reference) && <Field label="Mã chứng từ" htmlFor="ledger-reference">
            <Input id="ledger-reference" maxLength={120} value={reference} onChange={event => setReference(event.target.value)} />
          </Field>}
        </> : <Field label="Nội dung sao kê" htmlFor="ledger-description" className="sm:col-span-2">
          <Input id="ledger-description" maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>}
      </div>
      {error && <InlineAlert>{error}</InlineAlert>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={saving || savingAccount} onClick={onClose}>Hủy</Button>
        <Button type="button" disabled={saving || savingAccount || addingAccount} onClick={() => void submit()}>{saving ? "Đang lưu…" : "Lưu"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function LedgerLiveView() {
  const user = useSession();
  const canWrite = canPerform(user.role, "ledger.write");
  const filters = useAppliedSearch({ q: "", from: "", to: "", kind: "", category: "", dateField: "", counterparty: "", receivingAccount: "" });
  const [reconciling, setReconciling] = useState<LedgerEntry | null>(null);
  const ledger = useListData<LedgerEntry>("/api/ke-toan/ledger", "entries", filters.applied, "Không tải được sổ thu chi", true);
  const statements = useListData<Statement>("/api/ke-toan/statements", "statements", {}, "Không tải được sao kê", true);
  const candidateStatements = useListData<Statement>("/api/ke-toan/statements", "statements", { candidateFor: reconciling?.id ?? "" }, "Không tải được sao kê phù hợp", true, Boolean(reconciling));
  const counterparties = useListData<string>("/api/ke-toan/ledger-counterparties", "counterparties", {}, "Không tải được danh sách đối tượng");
  const accounts = useListData<string>("/api/ke-toan/receiving-accounts", "accounts", {}, "Không tải được tài khoản nhận");
  const [incomeCurrency, setIncomeCurrency] = useState("USD");
  const [mode, setMode] = useState<Mode | null>(null);
  const [viewing, setViewing] = useState<LedgerEntry | null>(null);
  const [editing, setEditing] = useState<LedgerEntry | null>(null);
  const [removing, setRemoving] = useState<LedgerEntry | null>(null);
  const [statementId, setStatementId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [showReport, setShowReport] = useState(false);
  const [reportGroup, setReportGroup] = useState<LedgerReportGroup>("month");
  const [reportVersion, setReportVersion] = useState(0);
  const reload = () => {
    ledger.reload(); statements.reload(); accounts.reload(); counterparties.reload();
    setReportVersion((version) => version + 1);
  };
  const rows = ledger.rows;
  const thu = Number(ledger.paging.summary.thu ?? 0);
  const chi = Number(ledger.paging.summary.chi ?? 0);
  const unmatchedCount = Number(statements.paging.summary.unmatchedCount ?? 0);
  const candidates = candidateStatements.rows;
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
        <Button variant="outline" aria-expanded={showReport} aria-controls="ledger-report" onClick={() => setShowReport(!showReport)}>Báo cáo thu chi</Button>
        <LedgerExcelActions total={ledger.paging.total} loadRows={() => fetchListPages<LedgerEntry>(`/api/ke-toan/ledger${listQuery(filters.applied)}`, "entries")} canWrite={canWrite} loading={ledger.loading || !!ledger.error} onDone={reload} />
        {canWrite && <>
        <Button variant="outline" onClick={() => setMode("statement")}>Nhập sao kê</Button>
        <Button onClick={() => setMode("ledger")}><Plus aria-hidden /> Nhập mới</Button>
        </>}
      </div>} />
    {(error || ledger.error || statements.error || accounts.error) && <InlineAlert className="mb-4">{error || ledger.error || statements.error || accounts.error}</InlineAlert>}
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Tổng thu</p><p className="text-xl font-semibold">{formatMoney(thu, "VND")}</p></div>
      <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Tổng chi</p><p className="text-xl font-semibold">{formatMoney(chi, "VND")}</p><p className="text-xs text-muted-foreground">Còn lại (thu − chi): {formatMoney(thu - chi, "VND")}</p></div>
      <div className="rounded-lg border p-4">
        <label htmlFor="ledger-income-currency" className="block text-sm text-muted-foreground">Tổng thu ngoại tệ</label>
        <div className="flex flex-wrap items-start justify-between gap-x-2">
          <p className="text-xl font-semibold" aria-live="polite">{formatMoney(Number((ledger.paging.summary.incomeByCurrency as Record<string, number> | undefined)?.[incomeCurrency] ?? 0), incomeCurrency)}</p>
          <NativeSelect id="ledger-income-currency" className="h-7 w-20 px-2" value={incomeCurrency} onChange={event => setIncomeCurrency(event.target.value)}>
            {quoteCurrencies.filter(code => code !== "VND").map(code => <option key={code} value={code}>{code}</option>)}
          </NativeSelect></div>
      </div>
      <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Sao kê chưa khớp</p><p className="text-xl font-semibold">{unmatchedCount}</p></div>
    </div>
    <ListSearchBar q={filters.draft.q} from={filters.draft.from} to={filters.draft.to}
      onQ={(v) => filters.set("q", v)} onFrom={(v) => filters.set("from", v)} onTo={(v) => filters.set("to", v)}
      onSearch={filters.search} onReset={filters.reset} activeCount={filters.activeCount} dateLabel={filters.draft.dateField === "transaction" ? "Ngày giao dịch" : "Ngày ghi sổ"} searchPlaceholder="Tìm người nộp/nhận, mã đơn, tên khách, tài khoản nhận…">
      <Field label="Lọc theo ngày" htmlFor="ledger-date-field">
        <NativeSelect id="ledger-date-field" value={filters.draft.dateField} onChange={(event) => filters.set("dateField", event.target.value)}>
          <option value="">Ngày ghi sổ</option><option value="transaction">Ngày giao dịch</option>
        </NativeSelect>
      </Field>
      <Field label="Tháng" htmlFor="ledger-month">
        <Input id="ledger-month" type="month" title="Tự điền Từ ngày – Đến ngày theo tháng" value={filters.draft.from.slice(0, 7) === filters.draft.to.slice(0, 7) ? filters.draft.from.slice(0, 7) : ""} onChange={(event) => {
          const [y, m] = event.target.value.split("-").map(Number);
          filters.set("from", y ? `${event.target.value}-01` : "");
          filters.set("to", y ? `${event.target.value}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}` : "");
        }} />
      </Field>
      <Field label="Đối tượng" htmlFor="ledger-counterparty-filter">
        <MultiCombobox id="ledger-counterparty-filter" options={counterparties.rows} placeholder="Tất cả đối tượng" searchPlaceholder="Tìm đối tượng…"
          value={filters.draft.counterparty ? filters.draft.counterparty.split("|") : []} onChange={(names) => filters.set("counterparty", names.join("|"))} />
      </Field>
      <FilterSelect id="ledger-kind-filter" label="Loại" value={filters.draft.kind} onChange={(v) => filters.set("kind", v)} options={[["THU", "Thu"], ["CHI", "Chi"]]} />
      <FilterSelect id="ledger-category-filter" label="Khoản mục" value={filters.draft.category} onChange={(v) => filters.set("category", v)} options={ledgerCategories.map((v) => [v, ledgerCategoryLabels[v]])} />
      <FilterSelect id="ledger-account-filter" label="Tài khoản nhận" value={filters.draft.receivingAccount} onChange={(v) => filters.set("receivingAccount", v)}
        options={[["missing", "Chưa gán tài khoản"], ...accounts.rows.map((account) => [`name:${account}`, account] as const)]} />
    </ListSearchBar>
    {showReport && <LedgerReport key={reportVersion} filters={filters.applied} group={reportGroup} onGroupChange={setReportGroup} onViewEntry={setViewing} />}
    <TableHScroll><table className="w-full min-w-[1050px] text-sm">
      <thead><tr className="border-b bg-muted/50 text-left text-muted-foreground">
        {["Ngày", "Ngày giao dịch", "Loại", "Khoản mục", "Đối tượng", "Đơn hàng", "Số tiền", "Tài khoản nhận", "Đối soát", "Thao tác"].map((v) => <th key={v} className="px-3 py-2">{v}</th>)}
      </tr></thead>
      <tbody>{rows.length === 0 ? <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">{ledger.loading ? "Đang tải…" : "Chưa có khoản thu chi."}</td></tr> :
        rows.map((row) => <tr key={row.id} className="border-b last:border-0">
          <td className="px-3 py-3 whitespace-nowrap">{row.date}</td><td className="px-3 py-3 whitespace-nowrap">{row.transactionDate || "—"}</td><td className="px-3 py-3">{row.kind === "THU" ? "Thu" : "Chi"}</td>
          <td className="px-3 py-3">{ledgerCategoryLabels[row.category]}</td><td className="px-3 py-3">{row.counterparty}</td>
          <td className="px-3 py-3">{orderLabel(row)}</td>
          <td className="px-3 py-3 whitespace-nowrap">{row.kind === "THU" ? "+" : "−"}{formatMoney(row.amount, row.currency)}{row.currency !== "VND" && <p className="text-xs text-muted-foreground">{formatMoney(row.amountVnd, "VND")}</p>}</td>
          <td className="px-3 py-3">{row.receivingAccount || "—"}</td>
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
    <ServerPagination paging={ledger.paging} loading={ledger.loading} />
    {editing && <EntryDialog mode="ledger" accounts={accounts.rows} onAccountAdded={() => accounts.reload()} entry={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    <ConfirmDialog open={removing !== null} onOpenChange={(open) => { if (!open) setRemoving(null); }} destructive
      title="Xóa khoản thu chi?" description={removing ? `${removing.counterparty} · ${formatMoney(removing.amount, removing.currency)} sẽ bị xóa.` : ""}
      confirmLabel="Xóa" onConfirm={() => void remove()} />
    <Dialog open={viewing !== null} onOpenChange={(open) => { if (!open) setViewing(null); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>Chi tiết thu chi</DialogTitle></DialogHeader>
        {viewing && <dl className="grid gap-x-6 gap-y-5 py-2 sm:grid-cols-2">
          {([
            ["Ngày", viewing.date],
            ["Ngày giao dịch", viewing.transactionDate || "—"],
            ["Tài khoản nhận", viewing.receivingAccount || "—"],
            ["Loại", <StatusBadge key="k" tone={viewing.kind === "THU" ? "success" : "danger"}>{viewing.kind === "THU" ? "Thu" : "Chi"}</StatusBadge>],
            ["Khoản mục", ledgerCategoryLabels[viewing.category]],
            ["Đối tượng", viewing.counterparty],
            ["Đơn hàng", orderLabel(viewing)],
            ...(viewing.department ? [
              ["Phòng ban", (departmentLabels as Record<string, string>)[viewing.department] ?? viewing.department],
              ["Hạng mục nội bộ", viewing.item], ["Nội dung", viewing.content],
            ] : []),
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
    {mode && <EntryDialog mode={mode} accounts={accounts.rows} onAccountAdded={() => accounts.reload()} onClose={() => setMode(null)} onSaved={() => { setMode(null); reload(); }} />}
    <Dialog open={reconciling !== null} onOpenChange={(open) => { if (!open && !busy) setReconciling(null); }}>
      <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Đối soát dòng thu chi</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Chọn sao kê cùng loại và đơn hàng: sao kê VND khớp số quy đổi; sao kê ngoại tệ khớp loại tiền và nguyên tệ.</p>
        <NativeSelect aria-label="Dòng sao kê" value={statementId} onChange={(event) => setStatementId(event.target.value)}>
          <option value="">Chọn dòng sao kê</option>
          {candidates.map((row) => <option key={row.id} value={row.id}>{row.date} · {row.counterparty} · {formatMoney(row.amount, row.currency)}</option>)}
        </NativeSelect>
        <ServerPagination paging={{ ...candidateStatements.paging, setPage: (page) => { setStatementId(""); candidateStatements.paging.setPage(page); } }} loading={candidateStatements.loading} />
        {candidateStatements.error && <InlineAlert>{candidateStatements.error}</InlineAlert>}
        {error && <InlineAlert>{error}</InlineAlert>}
        <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setReconciling(null)}>Hủy</Button>
          <Button disabled={busy || !statementId} onClick={() => void reconcile()}>{busy ? "Đang lưu…" : "Xác nhận đối soát"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
