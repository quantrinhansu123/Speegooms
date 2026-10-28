"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Column } from "@/components/shared/data-table";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { ListView } from "@/components/shared/list-view";
import { paymentKindLabels, paymentPurposeLabels, paymentStatusMeta, tierFor } from "@/config/accounting";
import { formatDate, formatMoney } from "@/lib/format";
import { canCreatePayment } from "@/services/accounting/rules";
import type { PaymentKind, PaymentPurpose, PaymentRequest, PaymentStatus } from "@/types/accounting";
import { useAccounting } from "../hooks";
import { PaymentBadge, ThresholdNotice } from "./accounting-badges";

function CreatePaymentDialog({ onClose }: { onClose: () => void }) {
  const { crm, ops, accActions } = useAccounting();
  const router = useRouter();
  const [orderId, setOrderId] = useState("");
  const [kind, setKind] = useState<PaymentKind>("nha-cung-cap");
  const [purpose, setPurpose] = useState<PaymentPurpose>("dat-coc-xuong");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const customerOf = new Map(crm.customers.map((c) => [c.customerId, c.name]));
  const contracts = crm.contracts.filter((c) => c.status === "da-ky");
  const po = ops.pos.find((p) => p.orderId === orderId && p.status !== "huy");
  const ships = ops.shipments.filter((s) => s.orderId === orderId);
  const supplier = ops.suppliers.find((s) => s.supplierId === po?.supplierId);
  const partner = ops.partners.find((p) => p.partnerId === ships[0]?.partnerId);
  const contract = crm.contracts.find((c) => c.orderId === orderId);
  const gate = orderId ? canCreatePayment(contract) : undefined;
  const target = kind === "nha-cung-cap" ? { payeeId: po?.supplierId ?? "", refId: po?.poId ?? "", name: supplier?.name } : { payeeId: ships[0]?.partnerId ?? "", refId: ships[0]?.shipmentId ?? "", name: partner?.name };

  const submit = () => {
    const r = accActions.createPayment({ kind, orderId, payeeId: target.payeeId, refId: target.refId, purpose, amount, note });
    if (r.ok && r.id) router.push(`/ke-toan/de-nghi-thanh-toan/${r.id}`);
    else if (!r.ok) setError(r.error);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nhập đề nghị thanh toán</DialogTitle>
          <DialogDescription>Bước 1/3 (Nhập). Sau đó gửi duyệt, rồi Kế toán ghi nhận chi. Không có thanh toán thật, chỉ ghi nhận trạng thái.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Đơn hàng" htmlFor="cp-order" required className="sm:col-span-2" hint="Chỉ tạo đề nghị chi cho đơn đã có xác nhận Đã cọc của Kế toán.">
            <NativeSelect id="cp-order" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
              <option value="">Chọn đơn hàng</option>
              {contracts.map((c) => (
                <option key={c.orderId} value={c.orderId} disabled={!canCreatePayment(c).ok}>
                  {c.orderId} · {customerOf.get(c.customerId)}{canCreatePayment(c).ok ? "" : " (chưa cọc)"}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Đối tượng nhận" htmlFor="cp-kind">
            <NativeSelect id="cp-kind" value={kind} onChange={(e) => { setKind(e.target.value as PaymentKind); setPurpose(e.target.value === "nha-cung-cap" ? "dat-coc-xuong" : "cuoc-van-chuyen"); }}>
              {(Object.keys(paymentKindLabels) as PaymentKind[]).map((k) => <option key={k} value={k}>{paymentKindLabels[k]}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Mục đích" htmlFor="cp-purpose">
            <NativeSelect id="cp-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value as PaymentPurpose)}>
              {(Object.keys(paymentPurposeLabels) as PaymentPurpose[]).map((k) => <option key={k} value={k}>{paymentPurposeLabels[k]}</option>)}
            </NativeSelect>
          </Field>
          <p className="text-sm sm:col-span-2">
            Người nhận: <strong>{orderId ? (target.name ?? "Chưa có PO / lô hàng phù hợp cho loại này") : "—"}</strong>
            {target.refId && <span className="font-mono text-xs text-muted-foreground"> · {target.refId}</span>}
          </p>
          <Field label="Số tiền (VND)" htmlFor="cp-amount" required hint={amount > 0 ? `Thuộc ${tierFor(amount).label}: ${tierFor(amount).approver} (ngưỡng mô phỏng, cần cấu hình)` : undefined}>
            <Input id="cp-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </Field>
          <Field label="Ghi chú" htmlFor="cp-note"><Input id="cp-note" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
        {gate && !gate.ok && <InlineAlert>{gate.reason}</InlineAlert>}
        {error && <InlineAlert>{error}</InlineAlert>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}><X /> Hủy</Button>
          <Button onClick={submit} disabled={!orderId || !target.payeeId}>Tạo mới</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PaymentsView() {
  const { acc, ops, crm, staffName, canAcc } = useAccounting();
  const [creating, setCreating] = useState(false);
  const payee = new Map([...ops.suppliers.map((s) => [s.supplierId, s.name] as const), ...ops.partners.map((p) => [p.partnerId, p.name] as const)]);
  const customerOf = new Map(crm.contracts.map((c) => [c.orderId, crm.customers.find((x) => x.customerId === c.customerId)?.name ?? c.customerId]));

  const columns: Column<PaymentRequest>[] = [
    { key: "id", header: "Đề nghị", cell: (p) => <Link href={`/ke-toan/de-nghi-thanh-toan/${p.paymentId}`} className="font-mono text-xs font-medium text-primary hover:underline">{p.paymentId}</Link> },
    { key: "payee", header: "Người nhận", cell: (p) => <div className="min-w-0"><p className="max-w-52 truncate font-medium">{payee.get(p.payeeId) ?? p.payeeId}</p><p className="text-xs text-muted-foreground">{paymentKindLabels[p.kind]} · {paymentPurposeLabels[p.purpose]}</p></div> },
    { key: "order", header: "Đơn hàng", cell: (p) => <span className="font-mono text-xs text-muted-foreground">{p.orderId}</span>, className: "hidden xl:table-cell" },
    { key: "amt", header: "Số tiền", align: "right", cell: (p) => formatMoney(p.amount, "VND") },
    { key: "status", header: "Trạng thái", cell: (p) => <PaymentBadge value={p.status} /> },
    { key: "by", header: "Nhập", cell: (p) => <span className="text-xs">{staffName(p.requestedBy)}<br /><span className="text-muted-foreground">{formatDate(p.requestedAt)}</span></span>, className: "hidden lg:table-cell" },
    { key: "appr", header: "Duyệt", cell: (p) => <span className="text-xs">{p.approvedBy ? <>{staffName(p.approvedBy)}<br /><span className="text-muted-foreground">{p.approvedAt && formatDate(p.approvedAt)}</span></> : "—"}</span>, className: "hidden lg:table-cell" },
    { key: "paid", header: "Chi", cell: (p) => <span className="text-xs">{p.paidBy ? <>{staffName(p.paidBy)}<br /><span className="text-muted-foreground">{p.paidAt && formatDate(p.paidAt)}</span></> : "—"}</span>, className: "hidden lg:table-cell" },
  ];

  return (
    <>
      <ListView dateLabel="Ngày đề nghị" dateValue={(r) => r.requestedAt}
        title="Đề nghị thanh toán"
        description="Nhà cung cấp và đối tác vận chuyển. Ba bước tách nhau: nhập (Vận hành), duyệt (theo cấp), chi (Kế toán). Chỉ ghi nhận trạng thái."
        actions={canAcc("pay.create") && <Button size="lg" onClick={() => setCreating(true)}><Plus /> Nhập đề nghị</Button>}
        banner={<ThresholdNotice compact />}
        columns={columns}
        rows={acc.payments}
        getRowId={(p) => p.paymentId}
        searchLabel="Tìm đề nghị thanh toán"
        searchPlaceholder="Tìm mã đề nghị, đơn hàng, người nhận…"
        searchText={(p) => [p.paymentId, p.orderId, payee.get(p.payeeId), p.refId, customerOf.get(p.orderId)]}
        filters={[
          { id: "status", label: "Mọi trạng thái", options: (Object.keys(paymentStatusMeta) as PaymentStatus[]).map((s) => ({ value: s, label: paymentStatusMeta[s].label })), match: (p, v) => p.status === v },
          { id: "kind", label: "Mọi đối tượng", options: (Object.keys(paymentKindLabels) as PaymentKind[]).map((k) => ({ value: k, label: paymentKindLabels[k] })), match: (p, v) => p.kind === v },
          { id: "purpose", label: "Mọi mục đích", options: (Object.keys(paymentPurposeLabels) as PaymentPurpose[]).map((k) => ({ value: k, label: paymentPurposeLabels[k] })), match: (p, v) => p.purpose === v },
        ]}
        sort={(a, b) => b.requestedAt.localeCompare(a.requestedAt) || b.paymentId.localeCompare(a.paymentId)}
      />
      {creating && <CreatePaymentDialog onClose={() => setCreating(false)} />}
    </>
  );
}
