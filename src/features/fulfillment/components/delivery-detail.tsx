"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { Field, InlineAlert } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { ChainTrace } from "@/features/crm/components/chain-trace";
import { formatDate } from "@/lib/format";
import { useFulfillment } from "../hooks";
import { DeliveryBadge } from "./fulfillment-badges";

export function DeliveryDetail({ deliveryId }: { deliveryId: string }) {
  const { wh, crm, whActions, canWh } = useFulfillment();
  const [receivedBy, setReceivedBy] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ tone: "danger" | "success"; text: string }>();

  const d = wh.deliveries.find((x) => x.deliveryId === deliveryId);
  if (!d) return <div className="rounded-xl border bg-card"><EmptyState title="Không tìm thấy lần giao" /></div>;

  const contract = crm.contracts.find((c) => c.orderId === d.orderId);
  const writable = canWh();
  const run = (r: { ok: boolean; error?: string }, success?: string) => setMsg(r.ok ? (success ? { tone: "success", text: success } : undefined) : { tone: "danger", text: r.error ?? "Không thực hiện được" });

  return (
    <>
      <Link href="/fulfillment/giao-hang" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Giao hàng
      </Link>
      <div className="mb-6 rounded-xl border bg-card p-5 shadow-xs">
        <h1 className="font-mono text-2xl font-semibold tracking-tight text-primary">{d.deliveryId}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Đơn {d.orderId} · {d.carrier} · xuất giao {formatDate(d.dispatchedAt)}</p>
        <p className="mt-1 text-sm">Giao đến: {d.address} · Người nhận: {d.recipientName}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3"><DeliveryBadge value={d.status} /><span className="font-mono text-xs text-muted-foreground">Mã demo {d.trackingRef}</span></div>
        {contract && <ChainTrace className="mt-4" messId={contract.messId} rfqId={contract.rfqId} orderId={contract.orderId} customerId={contract.customerId} />}
        <p className="mt-3 text-xs text-muted-foreground">Lệnh xuất: <Link href={`/fulfillment/pick-pack/${d.outboundId}`} className="font-mono text-primary hover:underline">{d.outboundId}</Link></p>
      </div>

      {msg && <InlineAlert tone={msg.tone} className="mb-4">{msg.text}</InlineAlert>}

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Xác nhận giao hàng (POD)" description="Proof of delivery: người nhận, ghi chú và tên file minh chứng">
          {d.status === "da-giao" && d.pod ? (
            <dl className="divide-y text-sm">
              {[
                ["Người nhận", d.pod.receivedBy],
                ["Ngày ký nhận", formatDate(d.pod.signedOn)],
                ["Ghi chú giao nhận", d.pod.note],
                ["Minh chứng", <span key="e" className="font-mono text-xs">{d.pod.evidenceFile}</span>],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-4 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
              ))}
            </dl>
          ) : writable && d.status === "dang-giao" ? (
            <div className="space-y-3">
              <InlineAlert tone="info" className="flex items-start gap-2 text-xs"><Info aria-hidden className="mt-0.5 size-4 shrink-0" />Minh chứng chỉ ghi tên file (demo), không tải tệp thật lên hệ thống.</InlineAlert>
              <Field label="Người nhận hàng" htmlFor="pod-by" required><Input id="pod-by" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder={d.recipientName} /></Field>
              <Field label="Ghi chú giao nhận" htmlFor="pod-note" required><Textarea id="pod-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tình trạng hàng khi giao, số thùng..." /></Field>
              <Field label="Tên file minh chứng" htmlFor="pod-file"><Input id="pod-file" value={file} onChange={(e) => setFile(e.target.value)} placeholder={`POD-${d.deliveryId}.jpg`} /></Field>
              <Button className="w-full" onClick={() => run(whActions.confirmPod(deliveryId, receivedBy, note, file), "Đã xác nhận POD. Mốc Giao hàng của lô hàng bên Vận hành đã được cập nhật")}>Xác nhận đã giao (POD)</Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{d.status === "giao-that-bai" ? "Lần giao không thành, giao lại để tiếp tục." : "Chưa có POD."}</p>
          )}
        </SectionCard>

        <SectionCard title="Giao không thành">
          {d.status === "giao-that-bai" && <InlineAlert className="mb-3">Lý do: {d.failureReason}</InlineAlert>}
          {writable && d.status === "dang-giao" && (
            <div className="space-y-3">
              <Field label="Lý do giao không thành" htmlFor="fail-reason"><Input id="fail-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Khách vắng, sai địa chỉ…" /></Field>
              <Button variant="destructive" className="w-full" onClick={() => run(whActions.failDelivery(deliveryId, reason), "Đã ghi nhận giao không thành")}>Ghi nhận giao không thành</Button>
            </div>
          )}
          {writable && d.status === "giao-that-bai" && <Button className="w-full" onClick={() => run(whActions.redispatch(deliveryId), "Đã giao lại")}>Giao lại</Button>}
          {d.status === "da-giao" && <p className="text-sm text-muted-foreground">Đã giao thành công.</p>}
        </SectionCard>
      </div>
    </>
  );
}
