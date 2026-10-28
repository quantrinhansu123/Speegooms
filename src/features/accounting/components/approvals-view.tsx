"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { Column } from "@/components/shared/data-table";
import { InlineAlert } from "@/components/shared/form-fields";
import { ListView } from "@/components/shared/list-view";
import { SectionCard } from "@/components/shared/section-card";
import { paymentApproval, paymentPurposeLabels, paymentStatusMeta, tierFor } from "@/config/accounting";
import { roleConfig } from "@/config/roles";
import { formatDate, formatMoney } from "@/lib/format";
import { canApprove } from "@/services/accounting/rules";
import type { PaymentRequest, PaymentStatus } from "@/types/accounting";
import { useAccounting } from "../hooks";
import { PaymentBadge, ThresholdNotice } from "./accounting-badges";

function RejectDialog({ payment, onClose }: { payment: PaymentRequest; onClose: () => void }) {
  const { accActions } = useAccounting();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Từ chối {payment.paymentId}</DialogTitle>
          <DialogDescription>Ghi rõ lý do để người nhập sửa lại.</DialogDescription>
        </DialogHeader>
        <Textarea aria-label="Lý do từ chối" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <InlineAlert>{error}</InlineAlert>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button variant="destructive" onClick={() => { const r = accActions.reviewPayment(payment.paymentId, false, note); if (r.ok) onClose(); else setError(r.error); }}>Xác nhận từ chối</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApprovalsView() {
  const { acc, ops, accActions, actor, staffName, user } = useAccounting();
  const [rejecting, setRejecting] = useState<PaymentRequest>();
  const [msg, setMsg] = useState<string>();
  const payee = new Map([...ops.suppliers.map((s) => [s.supplierId, s.name] as const), ...ops.partners.map((p) => [p.partnerId, p.name] as const)]);

  const columns: Column<PaymentRequest>[] = [
    { key: "id", header: "Đề nghị", cell: (p) => <Link href={`/ke-toan/de-nghi-thanh-toan/${p.paymentId}`} className="font-mono text-xs font-medium text-primary hover:underline">{p.paymentId}</Link> },
    { key: "payee", header: "Người nhận", cell: (p) => <div className="min-w-0"><p className="max-w-52 truncate font-medium">{payee.get(p.payeeId) ?? p.payeeId}</p><p className="text-xs text-muted-foreground">{paymentPurposeLabels[p.purpose]} · {p.orderId}</p></div> },
    { key: "amt", header: "Số tiền", align: "right", cell: (p) => formatMoney(p.amount, "VND") },
    { key: "tier", header: "Cấp duyệt (mô phỏng)", cell: (p) => <span className="text-xs">{tierFor(p.amount).label}: {tierFor(p.amount).approver}</span>, className: "hidden lg:table-cell" },
    { key: "by", header: "Người nhập", cell: (p) => <span className="text-xs">{staffName(p.requestedBy)}<br /><span className="text-muted-foreground">{formatDate(p.requestedAt)}</span></span>, className: "hidden md:table-cell" },
    { key: "status", header: "Trạng thái", cell: (p) => <PaymentBadge value={p.status} /> },
    {
      key: "act",
      header: "Duyệt",
      cell: (p) => {
        if (p.status !== "cho-duyet") return null;
        const gate = canApprove(p, actor);
        return gate.ok ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setMsg(accActions.reviewPayment(p.paymentId, true, "").ok ? undefined : "Không duyệt được")}>Duyệt</Button>
            <Button size="sm" variant="destructive" onClick={() => setRejecting(p)}>Từ chối</Button>
          </div>
        ) : (
          <span className="block max-w-48 text-xs text-muted-foreground" title={gate.reason}>Bạn không thể duyệt: {gate.reason}</span>
        );
      },
    },
  ];

  return (
    <>
      <ListView
        title="Duyệt thanh toán"
        description="Hàng đợi duyệt đề nghị chi theo cấp. Người duyệt khác người nhập; người chi (Kế toán) khác người duyệt. Chỉ mô phỏng, không thanh toán thật."
        banner={
          <>
            <ThresholdNotice />
            <SectionCard title="Cấp duyệt theo số tiền (mô phỏng)" description={`Vai trò hiện tại: ${roleConfig[user.role].label}`} className="mb-4" bodyClassName="px-0 pt-3">
              <table className="w-full text-sm">
                <caption className="sr-only">Cấp duyệt theo số tiền, mô phỏng</caption>
                <thead>
                  <tr className="border-y bg-muted/60 text-left text-xs font-semibold text-muted-foreground uppercase">
                    <th className="px-5 py-2">Cấp</th>
                    <th className="px-3 py-2">Đến số tiền</th>
                    <th className="px-3 py-2">Người duyệt</th>
                    <th className="px-5 py-2">Bạn duyệt được?</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paymentApproval.tiers.map((t) => (
                    <tr key={t.id}>
                      <td className="px-5 py-2.5 font-medium">{t.label}</td>
                      <td className="tabular px-3 py-2.5">{Number.isFinite(t.maxVnd) ? formatMoney(t.maxVnd, "VND") : "Không giới hạn"}</td>
                      <td className="px-3 py-2.5">{t.approver}</td>
                      <td className="px-5 py-2.5">{t.roles.includes(user.role) ? <span className="font-medium text-success">Có</span> : <span className="text-muted-foreground">Không</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
            {msg && <InlineAlert className="mb-4">{msg}</InlineAlert>}
          </>
        }
        columns={columns}
        rows={acc.payments}
        getRowId={(p) => p.paymentId}
        searchLabel="Tìm đề nghị cần duyệt"
        searchPlaceholder="Tìm mã đề nghị, người nhận, đơn hàng…"
        searchText={(p) => [p.paymentId, p.orderId, payee.get(p.payeeId)]}
        filters={[{ id: "status", label: "Mọi trạng thái", initial: "cho-duyet", options: (Object.keys(paymentStatusMeta) as PaymentStatus[]).filter((s) => ["cho-duyet", "da-duyet", "tu-choi", "da-chi"].includes(s)).map((s) => ({ value: s, label: paymentStatusMeta[s].label })), match: (p, v) => p.status === v }]}
        sort={(a, b) => b.requestedAt.localeCompare(a.requestedAt)}
        emptyTitle="Không có đề nghị cần duyệt"
      />
      {rejecting && <RejectDialog payment={rejecting} onClose={() => setRejecting(undefined)} />}
    </>
  );
}
