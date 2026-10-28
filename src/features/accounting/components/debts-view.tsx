"use client";

import { NotebookPen, X } from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Column } from "@/components/shared/data-table";
import { Field, InlineAlert } from "@/components/shared/form-fields";
import { ListView } from "@/components/shared/list-view";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { paymentKindLabels } from "@/config/accounting";
import { routeLabels } from "@/config/crm";
import { formatDate, formatMoney, formatVndCompact } from "@/lib/format";
import { buildPayables, buildReceivables, type PayableRow, type ReceivableRow } from "@/services/accounting/rules";
import { useAccounting } from "../hooks";

function ReceiptDialog({ row, onClose }: { row: ReceivableRow; onClose: () => void }) {
  const { accActions } = useAccounting();
  const [amount, setAmount] = useState(row.outstanding);
  const [ref, setRef] = useState("");
  const [error, setError] = useState<string>();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ghi nhận khoản thu {row.contract.orderId}</DialogTitle>
          <DialogDescription>Còn phải thu {formatMoney(row.outstanding, "VND")}. Chỉ ghi nhận số liệu, không phải giao dịch thật.</DialogDescription>
        </DialogHeader>
        <Field label="Số tiền đã thu" htmlFor="rc-amount" required><Input id="rc-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></Field>
        <Field label="Mã tham chiếu sao kê" htmlFor="rc-ref" required><Input id="rc-ref" value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
        {error && <InlineAlert>{error}</InlineAlert>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}><X /> Hủy</Button>
          <Button onClick={() => { const r = accActions.recordReceipt(row.contract.orderId, amount, ref); if (r.ok) onClose(); else setError(r.error); }}><NotebookPen /> Ghi nhận thu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DebtsView() {
  const { crm, ops, acc, today, canAcc } = useAccounting();
  const [receiving, setReceiving] = useState<ReceivableRow>();
  const receivables = useMemo(() => buildReceivables(crm, ops, acc, today), [crm, ops, acc, today]);
  const payables = useMemo(() => buildPayables(ops, acc), [ops, acc]);
  const totalAr = receivables.reduce((a, r) => a + r.outstanding, 0);
  const overdueAr = receivables.filter((r) => r.overdueDays > 0).reduce((a, r) => a + r.outstanding, 0);
  const totalAp = payables.reduce((a, r) => a + r.outstanding, 0);

  const arCols: Column<ReceivableRow>[] = [
    { key: "o", header: "Đơn hàng", cell: (r) => <Link href={`/ke-toan/quyet-toan/${r.contract.orderId}`} className="font-mono text-xs font-medium text-primary hover:underline">{r.contract.orderId}</Link> },
    { key: "c", header: "Khách hàng", cell: (r) => <span className="block max-w-52 truncate font-medium">{r.customerName}</span> },
    { key: "r", header: "Tuyến", cell: (r) => routeLabels[r.contract.route], className: "hidden lg:table-cell" },
    { key: "v", header: "Giá trị HĐ", align: "right", cell: (r) => formatMoney(r.contract.value, r.contract.currency) },
    { key: "g", header: "Đã thu", align: "right", cell: (r) => formatMoney(r.received, "VND"), className: "hidden md:table-cell" },
    { key: "n", header: "Còn phải thu", align: "right", cell: (r) => <strong className={r.outstanding > 0 ? "" : "text-muted-foreground"}>{formatMoney(r.outstanding, "VND")}</strong> },
    { key: "d", header: "Hạn giao", cell: (r) => <span className="tabular text-muted-foreground">{r.dueOn ? formatDate(r.dueOn) : "—"}</span>, className: "hidden xl:table-cell" },
    { key: "od", header: "Quá hạn", cell: (r) => (r.overdueDays > 0 ? <StatusBadge tone="danger">Quá {r.overdueDays} ngày</StatusBadge> : <span className="text-xs text-muted-foreground">—</span>) },
    { key: "a", header: "Thao tác", cell: (r) => (r.outstanding > 0 && canAcc("ledger.write") && r.contract.deposit.status === "da-coc" ? <Button size="sm" variant="outline" onClick={() => setReceiving(r)}><NotebookPen /> Ghi nhận thu</Button> : null) },
  ];
  const apCols: Column<PayableRow>[] = [
    { key: "n", header: "Đối tượng", cell: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{paymentKindLabels[r.kind]}</p></div> },
    { key: "c", header: "Đã cam kết", align: "right", cell: (r) => formatMoney(r.committed, "VND") },
    { key: "p", header: "Đã chi", align: "right", cell: (r) => formatMoney(r.paid, "VND"), className: "hidden md:table-cell" },
    { key: "w", header: "Chờ duyệt", align: "right", cell: (r) => formatMoney(r.awaitingApproval, "VND"), className: "hidden lg:table-cell" },
    { key: "u", header: "Đã duyệt chờ chi", align: "right", cell: (r) => formatMoney(r.approvedUnpaid, "VND"), className: "hidden lg:table-cell" },
    { key: "o", header: "Còn phải trả", align: "right", cell: (r) => <strong>{formatMoney(r.outstanding, "VND")}</strong> },
  ];

  return (
    <>
      <PageHeader title="Công nợ" description="Phải thu theo hợp đồng và phải trả theo nhà cung cấp, đối tác vận chuyển. Số liệu suy ra từ cọc, khoản thu và đề nghị chi." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Tổng phải thu" value={formatVndCompact(totalAr)} caption="Giá trị hợp đồng chưa thu đủ" />
        <StatCard label="Phải thu quá hạn" value={formatVndCompact(overdueAr)} caption="Quá hạn giao hàng, chưa thu đủ" />
        <StatCard label="Tổng phải trả còn lại" value={formatVndCompact(totalAp)} caption="Đề nghị còn hiệu lực chưa chi" />
      </div>
      <Tabs defaultValue="ar">
        <TabsList className="mb-4">
          <TabsTrigger value="ar">Phải thu ({receivables.filter((r) => r.outstanding > 0).length})</TabsTrigger>
          <TabsTrigger value="ap">Phải trả ({payables.filter((r) => r.outstanding > 0).length})</TabsTrigger>
        </TabsList>
        <TabsContent value="ar">
          <ListView
            columns={arCols}
            rows={receivables}
            getRowId={(r) => r.contract.orderId}
            searchLabel="Tìm công nợ phải thu"
            searchPlaceholder="Tìm order_id, khách hàng…"
            searchText={(r) => [r.contract.orderId, r.customerName, r.contract.contractNo]}
            filters={[{ id: "route", label: "Cả hai tuyến", options: [{ value: "vn", label: "Sale Việt Nam" }, { value: "global", label: "Sale Global" }], match: (r, v) => r.contract.route === v, className: "w-44" }]}
            toggles={[
              { id: "debt", label: "Chỉ còn nợ", match: (r) => r.outstanding > 0, initial: true },
              { id: "late", label: "Chỉ quá hạn", match: (r) => r.overdueDays > 0 },
            ]}
            sort={(a, b) => b.overdueDays - a.overdueDays || b.outstanding - a.outstanding}
          />
        </TabsContent>
        <TabsContent value="ap">
          <ListView
            columns={apCols}
            rows={payables}
            getRowId={(r) => r.payeeId}
            searchLabel="Tìm công nợ phải trả"
            searchPlaceholder="Tìm nhà cung cấp, đối tác…"
            searchText={(r) => [r.name, r.payeeId]}
            filters={[{ id: "kind", label: "Mọi đối tượng", options: [{ value: "nha-cung-cap", label: "Nhà cung cấp" }, { value: "doi-tac-van-chuyen", label: "Đối tác vận chuyển" }], match: (r, v) => r.kind === v }]}
            toggles={[{ id: "debt", label: "Chỉ còn phải trả", match: (r) => r.outstanding > 0, initial: true }]}
          />
        </TabsContent>
      </Tabs>
      {receiving && <ReceiptDialog row={receiving} onClose={() => setReceiving(undefined)} />}
    </>
  );
}
