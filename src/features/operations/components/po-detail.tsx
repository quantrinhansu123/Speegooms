"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Ban, Check, Circle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { ChainTrace } from "@/features/crm/components/chain-trace";
import { poFlow, poStatusMeta, qcApproved, qcItems, qcResultMeta } from "@/config/operations";
import { formatDate, formatVnd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { canPlacePo } from "@/services/ops/rules";
import type { QcResult } from "@/types/ops";
import { useOps } from "../hooks";
import { HistoryList } from "./history-list";
import { PoBadge } from "./ops-badges";

export function PoDetail({ poId }: { poId: string }) {
  const { ops, crm, actions, can, staffName } = useOps();
  const [msg, setMsg] = useState<{ tone: "danger" | "success"; text: string }>();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const po = ops.pos.find((p) => p.poId === poId);
  if (!po) return <div className="rounded-xl border bg-card"><EmptyState title="Không tìm thấy PO" /></div>;

  const contract = crm.contracts.find((c) => c.orderId === po.orderId);
  const order = ops.orders.find((o) => o.orderId === po.orderId);
  const supplier = ops.suppliers.find((s) => s.supplierId === po.supplierId);
  const gate = canPlacePo(contract, order);
  const idx = poFlow.indexOf(po.status);
  const next = idx >= 0 && idx < poFlow.length - 1 ? poFlow[idx + 1] : undefined;
  const writable = can() && po.status !== "huy";
  const qcEditable = writable && (po.status === "dang-san-xuat" || po.status === "qc");
  const run = (r: { ok: boolean; error?: string }, success?: string) => setMsg(r.ok ? (success ? { tone: "success", text: success } : undefined) : { tone: "danger", text: r.error ?? "Không thực hiện được" });

  return (
    <>
      <Link href="/van-hanh/po" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Danh sách PO
      </Link>
      <div className="mb-6 rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight text-primary">{po.poId}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              <Link href={`/van-hanh/nha-cung-cap/${po.supplierId}`} className="hover:underline">{supplier?.name}</Link> · phụ trách {staffName(po.assigneeId)}
            </p>
            <div className="mt-3"><PoBadge value={po.status} /></div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Giá trị PO (tiền hàng)</p>
            <p className="tabular text-2xl font-semibold text-primary">{formatVnd(po.amount)}</p>
          </div>
        </div>
        {contract && <ChainTrace className="mt-4" messId={contract.messId} rfqId={contract.rfqId} orderId={contract.orderId} customerId={contract.customerId} />}
      </div>

      {msg && <InlineAlert tone={msg.tone} className="mb-4">{msg.text}</InlineAlert>}
      {po.status === "nhap" && !gate.ok && (
        <InlineAlert className="mb-4">
          <p className="flex items-center gap-1.5 font-medium"><Lock aria-hidden className="size-4" /> Chưa thể đặt xưởng</p>
          <p className="mt-0.5">{gate.reason}</p>
        </InlineAlert>
      )}

      <ol className="mb-6 grid gap-2 sm:grid-cols-4 xl:grid-cols-7" aria-label="Tiến độ PO">
        {poFlow.map((s, i) => {
          const state = po.status === "huy" ? "locked" : i < idx ? "done" : i === idx ? "current" : "locked";
          return (
            <li key={s} className={cn("rounded-lg border p-2.5 text-xs", state === "done" && "border-success/40 bg-success-soft", state === "current" && "border-primary bg-accent font-medium", state === "locked" && "bg-muted/50 text-muted-foreground")}>
              <p className="flex items-center gap-1.5">{state === "done" ? <Check aria-hidden className="size-3.5 text-success" /> : <Circle aria-hidden className="size-3.5" />}{poStatusMeta[s].label}</p>
              <span className="sr-only">{state === "done" ? "Đã xong" : state === "current" ? "Đang ở bước này" : "Chưa tới"}</span>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Thông tin PO">
          <dl className="divide-y text-sm">
            {[
              ["Đơn hàng", <Link key="o" href={`/van-hanh/don-hang/${po.orderId}`} className="font-mono text-primary hover:underline">{po.orderId}</Link>],
              ["Báo giá xưởng", <span key="q" className="font-mono">{po.quoteId}</span>],
              ["Tạo ngày", formatDate(po.createdAt)],
              ["Đặt xưởng ngày", po.placedAt ? formatDate(po.placedAt) : "Chưa đặt"],
              ["Dự kiến sẵn sàng", formatDate(po.expectedReadyOn)],
              ["Kế toán xác nhận cọc", contract?.deposit.status === "da-coc" ? "Đã cọc" : "Chưa"],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-4 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
            ))}
          </dl>
          {writable && (
            <div className="mt-4 space-y-2">
              {po.status === "nhap" && (
                <Button className="w-full" disabled={!gate.ok} onClick={() => run(actions.placePo(poId), "Đã đặt xưởng")}>
                  {gate.ok ? null : <Lock />} Đặt xưởng
                </Button>
              )}
              {next && po.status !== "nhap" && (
                <Button className="w-full" onClick={() => run(actions.advancePo(poId), `PO chuyển sang: ${poStatusMeta[next].label}`)}>
                  <ArrowRight /> Chuyển sang: {poStatusMeta[next].label}
                </Button>
              )}
              {po.status !== "da-giao-vc" && <Button className="w-full" variant="destructive" onClick={() => setCancelOpen(true)}><Ban /> Hủy PO</Button>}
            </div>
          )}
        </SectionCard>

        <SectionCard
          className="lg:col-span-2"
          title="QC checklist"
          description={qcEditable ? "Ghi kết quả từng mục. Mọi mục phải Đạt hoặc Không áp dụng mới báo hàng sẵn sàng." : "Ghi được khi PO đang sản xuất hoặc đang QC."}
        >
          {!qcApproved && (
            <InlineAlert tone="warning" className="mb-4 text-xs">Danh sách mục QC là <strong>cấu hình tạm</strong>: tài liệu chưa có tiêu chuẩn QC được duyệt. Chỉnh tại <code>config/operations.ts</code> khi Vận hành chốt.</InlineAlert>
          )}
          <ul className="divide-y">
            {qcItems.map((q) => {
              const cur = po.qc[q.id] ?? { result: "cho" as QcResult };
              return (
                <li key={q.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{q.label}</p>
                    {cur.note && <p className="text-xs text-muted-foreground">Ghi chú: {cur.note}</p>}
                  </div>
                  {qcEditable ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Input aria-label={`Ghi chú QC: ${q.label}`} className="h-9 w-44" placeholder="Ghi chú" value={notes[q.id] ?? ""} onChange={(e) => setNotes({ ...notes, [q.id]: e.target.value })} />
                      <NativeSelect aria-label={`Kết quả QC: ${q.label}`} className="w-40" value={cur.result} onChange={(e) => run(actions.setQc(poId, q.id, e.target.value as QcResult, notes[q.id] ?? ""))}>
                        {(Object.keys(qcResultMeta) as QcResult[]).map((r) => <option key={r} value={r}>{qcResultMeta[r].label}</option>)}
                      </NativeSelect>
                    </div>
                  ) : (
                    <span className="text-sm">{qcResultMeta[cur.result].label}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </div>

      <div className="mt-6">
        <HistoryList title="Lịch sử thao tác của đơn" entries={ops.history.filter((h) => h.orderId === po.orderId)} staffName={staffName} />
      </div>

      <ConfirmDialog open={cancelOpen} onOpenChange={setCancelOpen} title="Hủy PO này?" description="PO chuyển sang đã hủy. Có thể tạo PO mới từ chi tiết đơn hàng." confirmLabel="Hủy PO" destructive onConfirm={() => run(actions.cancelPo(poId))} />
    </>
  );
}
