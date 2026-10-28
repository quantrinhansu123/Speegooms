"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { ChainTrace } from "@/features/crm/components/chain-trace";
import { lastMileCarriers, outboundFlow } from "@/config/fulfillment";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { packBlockReason } from "@/services/fulfillment/rules";
import { useFulfillment } from "../hooks";
import { OutboundBadge, PackageBadge } from "./fulfillment-badges";

export function OutboundDetail({ outboundId }: { outboundId: string }) {
  const { wh, crm, whActions, canWh, staffName } = useFulfillment();
  const router = useRouter();
  const [weight, setWeight] = useState(0);
  const [boxes, setBoxes] = useState(1);
  const [carrier, setCarrier] = useState("");
  const [msg, setMsg] = useState<{ tone: "danger" | "success"; text: string }>();

  const o = wh.outbounds.find((x) => x.outboundId === outboundId);
  if (!o) return <div className="rounded-xl border bg-card"><EmptyState title="Không tìm thấy lệnh" /></div>;

  const contract = crm.contracts.find((c) => c.orderId === o.orderId);
  const pkgs = wh.packages.filter((p) => o.packageIds.includes(p.packageId));
  const delivery = wh.deliveries.find((d) => d.outboundId === outboundId);
  const stepIdx = outboundFlow.findIndex((s) => s.key === o.status);
  const writable = canWh();
  const packBlock = packBlockReason(o);
  const run = (r: { ok: boolean; error?: string }, success?: string) => setMsg(r.ok ? (success ? { tone: "success", text: success } : undefined) : { tone: "danger", text: r.error ?? "Không thực hiện được" });

  return (
    <>
      <Link href="/fulfillment/pick-pack" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Pick / Pack
      </Link>
      <div className="mb-6 rounded-xl border bg-card p-5 shadow-xs">
        <h1 className="font-mono text-2xl font-semibold tracking-tight text-primary">{o.outboundId}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Đơn {o.orderId} · tạo {formatDate(o.createdAt)} · phụ trách {staffName(o.assigneeId)}</p>
        <div className="mt-3"><OutboundBadge value={o.status} /></div>
        {contract && <ChainTrace className="mt-4" messId={contract.messId} rfqId={contract.rfqId} orderId={contract.orderId} customerId={contract.customerId} />}
      </div>

      {msg && <InlineAlert tone={msg.tone} className="mb-4">{msg.text}</InlineAlert>}

      <ol className="mb-6 grid gap-2 sm:grid-cols-5" aria-label="Các bước pick/pack">
        {outboundFlow.map((s, i) => {
          const state = i < stepIdx ? "done" : i === stepIdx ? (o.status === "da-xuat" ? "done" : "current") : "locked";
          return (
            <li key={s.key} className={cn("rounded-lg border p-2.5 text-xs", state === "done" && "border-success/40 bg-success-soft", state === "current" && "border-primary bg-accent font-medium", state === "locked" && "bg-muted/50 text-muted-foreground")}>
              <p className="flex items-center gap-1.5">{state === "done" ? <Check aria-hidden className="size-3.5 text-success" /> : <Circle aria-hidden className="size-3.5" />}{i + 1}. {s.label}</p>
              <span className="sr-only">{state === "done" ? "Đã xong" : state === "current" ? "Đang ở bước này" : "Chưa tới"}</span>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Kiện cần pick" description={`${o.pickedIds.length}/${o.packageIds.length} kiện đã pick`} className="lg:col-span-2" bodyClassName="px-0 pt-3">
          <ul className="divide-y">
            {pkgs.map((p) => {
              const picked = o.pickedIds.includes(p.packageId);
              return (
                <li key={p.packageId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <Link href={`/fulfillment/ton-kho/${p.packageId}`} className="font-mono text-xs font-medium text-primary hover:underline">{p.packageId}</Link>
                    <p className="text-xs text-muted-foreground">SKU {p.sku} · {formatNumber(p.quantity)} sản phẩm · vị trí <span className="font-mono">{p.location}</span></p>
                  </div>
                  <div className="flex items-center gap-3">
                    <PackageBadge value={p.status} />
                    {writable && !picked && (o.status === "cho-pick" || o.status === "dang-pick") && (
                      <Button size="sm" onClick={() => run(whActions.pickPackage(outboundId, p.packageId), `Đã pick ${p.packageId}`)}>Xác nhận pick</Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Đóng gói" description={packBlock ?? "Pick đủ, nhập thông số đóng gói"}>
            {o.packed ? (
              <dl className="divide-y text-sm">
                <div className="flex justify-between py-1.5"><dt className="text-muted-foreground">Trọng lượng</dt><dd className="font-medium">{formatNumber(o.packed.weightKg)} kg</dd></div>
                <div className="flex justify-between py-1.5"><dt className="text-muted-foreground">Số thùng</dt><dd className="font-medium">{o.packed.boxes}</dd></div>
                <div className="flex justify-between py-1.5"><dt className="text-muted-foreground">Đóng gói</dt><dd className="font-medium">{formatDate(o.packed.packedAt)} · {staffName(o.packed.packedBy)}</dd></div>
              </dl>
            ) : writable ? (
              <div className="space-y-3">
                <Field label="Trọng lượng sau đóng gói (kg)" htmlFor="pk-w"><Input id="pk-w" type="number" min={0} disabled={!!packBlock} value={weight} onChange={(e) => setWeight(Number(e.target.value))} /></Field>
                <Field label="Số thùng" htmlFor="pk-b"><Input id="pk-b" type="number" min={1} disabled={!!packBlock} value={boxes} onChange={(e) => setBoxes(Number(e.target.value))} /></Field>
                <Button className="w-full" disabled={!!packBlock} onClick={() => run(whActions.packOutbound(outboundId, weight, boxes), "Đã đóng gói")}>Xác nhận đóng gói</Button>
              </div>
            ) : <p className="text-sm text-muted-foreground">Chưa đóng gói.</p>}
          </SectionCard>

          <SectionCard title="Giao chặng cuối">
            {delivery ? (
              <p className="text-sm">Đã giao cho đối tác: <Link href={`/fulfillment/giao-hang/${delivery.deliveryId}`} className="font-mono text-primary hover:underline">{delivery.deliveryId}</Link></p>
            ) : o.status === "da-dong-goi" && writable ? (
              <div className="space-y-3">
                <Field label="Đơn vị giao chặng cuối" htmlFor="pk-c" required>
                  <NativeSelect id="pk-c" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
                    <option value="">Chọn đơn vị giao</option>
                    {lastMileCarriers.map((c) => <option key={c} value={c}>{c}</option>)}
                  </NativeSelect>
                </Field>
                <Button
                  className="w-full"
                  onClick={() => {
                    const r = whActions.dispatchDelivery(outboundId, carrier);
                    if (r.ok && r.id) router.push(`/fulfillment/giao-hang/${r.id}`);
                    else run(r);
                  }}
                >
                  Giao cho đơn vị giao
                </Button>
              </div>
            ) : <p className="text-sm text-muted-foreground">Chỉ giao khi lệnh đã đóng gói.</p>}
          </SectionCard>
        </div>
      </div>
    </>
  );
}
