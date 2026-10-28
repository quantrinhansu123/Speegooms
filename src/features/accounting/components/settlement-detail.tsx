"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { InlineAlert } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { ChainTrace } from "@/features/crm/components/chain-trace";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buildSettlement } from "@/services/accounting/rules";
import { useAccounting } from "../hooks";
import { SettlementBadge } from "./accounting-badges";

export function SettlementDetail({ orderId }: { orderId: string }) {
  const { crm, ops, acc, accActions, canAcc, staffName } = useAccounting();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "danger" | "success"; text: string }>();

  const view = buildSettlement(orderId, crm, ops, acc);
  const c = crm.contracts.find((x) => x.orderId === orderId);
  if (!view || !c) return <div className="rounded-xl border bg-card"><EmptyState title="Không tìm thấy hợp đồng" /></div>;

  const rec = acc.settlements.find((s) => s.orderId === orderId);
  const status = rec?.status ?? "chua-quyet-toan";
  const customer = crm.customers.find((x) => x.customerId === c.customerId);
  const run = (r: { ok: boolean; error?: string }, success?: string) => setMsg(r.ok ? (success ? { tone: "success", text: success } : undefined) : { tone: "danger", text: r.error ?? "Không thực hiện được" });
  const row = (k: string, v: string, strong = false) => (
    <div className={cn("flex justify-between gap-4 py-1.5", strong && "font-semibold")}><dt className={strong ? "" : "text-muted-foreground"}>{k}</dt><dd className="tabular">{v}</dd></div>
  );

  return (
    <>
      <Link href="/ke-toan/quyet-toan" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Quyết toán hợp đồng
      </Link>
      <div className="mb-6 rounded-xl border bg-card p-5 shadow-xs">
        <h1 className="font-mono text-2xl font-semibold tracking-tight text-primary">{c.orderId}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Hợp đồng {c.contractNo} · {customer?.name}</p>
        <div className="mt-3"><SettlementBadge value={status} /></div>
        <ChainTrace className="mt-4" messId={c.messId} rfqId={c.rfqId} orderId={c.orderId} customerId={c.customerId} />
      </div>

      {msg && <InlineAlert tone={msg.tone} className="mb-4">{msg.text}</InlineAlert>}

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Doanh thu và thu tiền">
          <dl className="divide-y text-sm">
            {row("Giá trị hợp đồng", formatMoney(view.revenue, c.currency))}
            {row("Đã thu (cọc + thu thêm)", formatMoney(view.received, "VND"))}
            {row("Còn phải thu", formatMoney(view.receivable, "VND"), true)}
          </dl>
        </SectionCard>
        <SectionCard title="Chi phí và lợi nhuận gộp">
          <dl className="divide-y text-sm">
            {row("Tiền hàng theo PO", formatMoney(view.poAmount, "VND"))}
            {row("Cước thực tế (dự kiến " + formatMoney(view.carrierEstimated, "VND") + ")", formatMoney(view.carrierActual, "VND"))}
            {row("Tổng chi phí", formatMoney(view.cost, "VND"), true)}
            {row("Đã chi (ghi nhận)", formatMoney(view.paidOut, "VND"))}
            {row("Đề nghị chưa chi", formatMoney(view.payableOpen, "VND"))}
            {row("Lợi nhuận gộp", formatMoney(view.margin, "VND"), true)}
          </dl>
        </SectionCard>
      </div>

      <SectionCard title="Điều kiện chốt quyết toán" description="Chủ quyết toán chưa được phân trong tài liệu (cần Ban GĐ chốt). Demo cho Kế toán chốt." className="mt-6">
        <ul className="space-y-2">
          {view.conditions.map((x) => (
            <li key={x.key} className="flex items-center gap-2 text-sm">
              {x.ok ? <Check aria-hidden className="size-4 text-success" /> : <X aria-hidden className="size-4 text-danger" />}
              <span className={x.ok ? "" : "text-muted-foreground"}>{x.label}</span>
              <span className="sr-only">{x.ok ? "(đạt)" : "(chưa đạt)"}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t pt-4">
          {status === "da-quyet-toan" ? (
            <p className="text-sm">Đã quyết toán ngày {rec?.closedAt && formatDate(rec.closedAt)} bởi {staffName(rec?.closedBy ?? "")}{rec?.note ? `: ${rec.note}` : ""}.</p>
          ) : canAcc("ledger.write") ? (
            <div className="space-y-3">
              {status === "chua-quyet-toan" && <Button variant="outline" onClick={() => run(accActions.startSettlement(orderId), "Đã mở hồ sơ quyết toán")}>Mở hồ sơ quyết toán</Button>}
              <Textarea aria-label="Ghi chú quyết toán" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú khi chốt (tuỳ chọn)" />
              <Button disabled={!view.canClose} onClick={() => run(accActions.closeSettlement(orderId, note), "Đã chốt quyết toán")}>Chốt quyết toán</Button>
              {!view.canClose && <p className="text-xs text-muted-foreground">Chưa đủ điều kiện chốt.</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Chỉ Kế toán chốt quyết toán.</p>
          )}
        </div>
      </SectionCard>
    </>
  );
}
