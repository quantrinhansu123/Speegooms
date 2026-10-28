"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, Check, Circle, Lock, NotebookPen, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { InlineAlert } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { ChainTrace } from "@/features/crm/components/chain-trace";
import { accountingDisclaimer, paymentKindLabels, paymentPurposeLabels, paymentSteps, tierFor } from "@/config/accounting";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { canApprove, canPay } from "@/services/accounting/rules";
import { useAccounting } from "../hooks";
import { PaymentBadge, ThresholdNotice } from "./accounting-badges";

export function PaymentDetail({ paymentId }: { paymentId: string }) {
  const { acc, crm, ops, accActions, actor, canAcc, staffName } = useAccounting();
  const [note, setNote] = useState("");
  const [bankRef, setBankRef] = useState("");
  const [msg, setMsg] = useState<{ tone: "danger" | "success"; text: string }>();

  const p = acc.payments.find((x) => x.paymentId === paymentId);
  if (!p) return <div className="rounded-xl border bg-card"><EmptyState title="Không tìm thấy đề nghị" /></div>;

  const contract = crm.contracts.find((c) => c.orderId === p.orderId);
  const payee = [...ops.suppliers.map((s) => ({ id: s.supplierId, name: s.name })), ...ops.partners.map((x) => ({ id: x.partnerId, name: x.name }))].find((x) => x.id === p.payeeId);
  const tier = tierFor(p.amount);
  const approveGate = canApprove(p, actor);
  const payGate = canPay(p, contract, actor);
  const run = (r: { ok: boolean; error?: string }, success?: string) => setMsg(r.ok ? (success ? { tone: "success", text: success } : undefined) : { tone: "danger", text: r.error ?? "Không thực hiện được" });

  const done = { enter: true, approve: p.status === "da-duyet" || p.status === "da-chi", pay: p.status === "da-chi" };
  const current = p.status === "nhap" ? "enter" : p.status === "cho-duyet" ? "approve" : p.status === "da-duyet" ? "pay" : "";
  const who = { enter: `${staffName(p.requestedBy)} · ${formatDate(p.requestedAt)}`, approve: p.approvedBy ? `${staffName(p.approvedBy)} · ${p.approvedAt && formatDate(p.approvedAt)}` : `${tier.approver}`, pay: p.paidBy ? `${staffName(p.paidBy)} · ${p.paidAt && formatDate(p.paidAt)}` : "Kế toán" };

  return (
    <>
      <Link href="/ke-toan/de-nghi-thanh-toan" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Đề nghị thanh toán
      </Link>
      <div className="mb-6 rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight text-primary">{p.paymentId}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{paymentKindLabels[p.kind]} · {payee?.name ?? p.payeeId} · {paymentPurposeLabels[p.purpose]}</p>
            <div className="mt-3"><PaymentBadge value={p.status} /></div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Số tiền</p>
            <p className="tabular text-2xl font-semibold text-primary">{formatMoney(p.amount, "VND")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{tier.label}: {tier.approver} (mô phỏng)</p>
          </div>
        </div>
        {contract && <ChainTrace className="mt-4" messId={contract.messId} rfqId={contract.rfqId} orderId={contract.orderId} customerId={contract.customerId} />}
        <p className="mt-3 text-xs text-muted-foreground">Tham chiếu: <span className="font-mono">{p.refId}</span> · đơn <Link href={`/van-hanh/don-hang/${p.orderId}`} className="font-mono text-primary hover:underline">{p.orderId}</Link></p>
      </div>

      <ThresholdNotice />
      {msg && <InlineAlert tone={msg.tone} className="mb-4">{msg.text}</InlineAlert>}

      <ol className="mb-6 grid gap-3 sm:grid-cols-3" aria-label="Ba bước nhập, duyệt, chi">
        {paymentSteps.map((s, i) => {
          const state = p.status === "tu-choi" && s.key !== "enter" ? (s.key === "approve" ? "rejected" : "locked") : done[s.key] ? "done" : current === s.key ? "current" : "locked";
          return (
            <li key={s.key} className={cn("rounded-lg border p-3 text-sm", state === "done" && "border-success/40 bg-success-soft", state === "current" && "border-primary bg-accent", state === "rejected" && "border-danger/40 bg-danger-soft", state === "locked" && "bg-muted/50 text-muted-foreground")}>
              <p className="flex items-center gap-1.5 font-medium">{state === "done" ? <Check aria-hidden className="size-4 text-success" /> : state === "locked" ? <Lock aria-hidden className="size-4" /> : <Circle aria-hidden className="size-4" />}{i + 1}. {s.label}</p>
              <p className="mt-1 text-xs">{state === "rejected" ? `Bị từ chối: ${p.rejectReason}` : who[s.key]}</p>
              <span className="sr-only">{state === "done" ? "Đã xong" : state === "current" ? "Đang ở bước này" : state === "rejected" ? "Bị từ chối" : "Chưa tới"}</span>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Thao tác theo bước">
          <div className="space-y-4">
            {p.status === "nhap" && canAcc("pay.create") && (
              <div className="flex gap-2">
                <Button onClick={() => run(accActions.submitPayment(paymentId), "Đã gửi duyệt")}><Send /> Gửi duyệt</Button>
                <Button variant="outline" onClick={() => run(accActions.cancelPayment(paymentId))}><Ban /> Hủy đề nghị</Button>
              </div>
            )}
            {p.status === "cho-duyet" && (
              <div className="space-y-2">
                <Textarea aria-label="Ghi chú duyệt" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú (bắt buộc khi từ chối)" />
                <div className="flex gap-2">
                  <Button disabled={!approveGate.ok} onClick={() => run(accActions.reviewPayment(paymentId, true, note), "Đã duyệt")}><Check /> Duyệt</Button>
                  <Button variant="destructive" disabled={!approveGate.ok} onClick={() => run(accActions.reviewPayment(paymentId, false, note))}><X /> Từ chối</Button>
                </div>
                {!approveGate.ok && <p className="text-xs text-muted-foreground">{approveGate.reason}</p>}
              </div>
            )}
            {p.status === "da-duyet" && (
              <div className="space-y-2">
                <InlineAlert tone="info" className="text-xs">{accountingDisclaimer}</InlineAlert>
                <Input aria-label="Mã tham chiếu chứng từ chi" placeholder="Số ủy nhiệm chi / mã tham chiếu" value={bankRef} onChange={(e) => setBankRef(e.target.value)} disabled={!payGate.ok || !canAcc("pay.pay")} />
                <Button disabled={!payGate.ok || !canAcc("pay.pay")} onClick={() => run(accActions.markPaid(paymentId, bankRef), "Đã ghi nhận chi (không phải chuyển tiền thật)")}><NotebookPen /> Ghi nhận đã chi</Button>
                {!canAcc("pay.pay") ? <p className="text-xs text-muted-foreground">Chỉ Kế toán ghi nhận chi.</p> : !payGate.ok && <p className="text-xs text-muted-foreground">{payGate.reason}</p>}
              </div>
            )}
            {p.status === "da-chi" && (
              <div className="space-y-2 text-sm">
                <p>Đã ghi nhận chi ngày {p.paidAt && formatDate(p.paidAt)} · tham chiếu <span className="font-mono text-xs">{p.bankRef}</span></p>
                {p.reconciledAt ? <p className="text-success">Đã đối soát ngày {formatDate(p.reconciledAt)}</p> : canAcc("ledger.write") ? <Button variant="outline" onClick={() => run(accActions.reconcilePayment(paymentId), "Đã đối soát")}><Check /> Đánh dấu đã đối soát sao kê</Button> : <p className="text-muted-foreground">Chờ Kế toán đối soát.</p>}
              </div>
            )}
            {(p.status === "tu-choi" || p.status === "huy") && (
              <div className="space-y-2 text-sm">
                <p>{p.status === "tu-choi" ? `Bị từ chối: ${p.rejectReason}` : "Đề nghị đã hủy."}</p>
                {p.status === "tu-choi" && canAcc("pay.create") && <Button variant="outline" onClick={() => run(accActions.cancelPayment(paymentId))}><Ban /> Hủy đề nghị</Button>}
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Lịch sử đề nghị" description="Người làm và thời điểm của từng bước">
          <ol className="relative space-y-4 border-l pl-5">
            {[...p.log].reverse().map((l, i) => (
              <li key={i} className="relative">
                <span aria-hidden className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full border-2 border-surface bg-primary" />
                <p className="text-sm">{l.text}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{staffName(l.by)} · {formatDate(l.at.slice(0, 10))} {l.at.slice(11)}</p>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>
    </>
  );
}
