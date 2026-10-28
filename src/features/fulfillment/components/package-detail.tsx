"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { InlineAlert } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { ChainTrace } from "@/features/crm/components/chain-trace";
import { formatDate, formatNumber } from "@/lib/format";
import { useFulfillment } from "../hooks";
import { DeliveryBadge, OutboundBadge, PackageBadge, ReceiptBadge } from "./fulfillment-badges";

export function PackageDetail({ packageId }: { packageId: string }) {
  const { wh, crm, whActions, canWh, staffName } = useFulfillment();
  const pkg = wh.packages.find((p) => p.packageId === packageId);
  const [loc, setLoc] = useState("");
  const [msg, setMsg] = useState<{ tone: "danger" | "success"; text: string }>();

  if (!pkg) return <div className="rounded-xl border bg-card"><EmptyState title="Không tìm thấy kiện hàng" /></div>;

  const contract = crm.contracts.find((c) => c.orderId === pkg.orderId);
  const receipt = wh.receipts.find((r) => r.receiptId === pkg.receiptId);
  const outbound = wh.outbounds.find((o) => o.packageIds.includes(pkg.packageId));
  const delivery = outbound ? wh.deliveries.find((d) => d.outboundId === outbound.outboundId) : undefined;
  const warehouse = wh.warehouses.find((w) => w.warehouseId === pkg.warehouseId);
  const movable = canWh() && pkg.status !== "da-xuat" && pkg.status !== "da-giao";

  return (
    <>
      <Link href="/fulfillment/ton-kho" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Tồn kho
      </Link>
      <div className="mb-6 rounded-xl border bg-card p-5 shadow-xs">
        <h1 className="font-mono text-2xl font-semibold tracking-tight text-primary">{pkg.packageId}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">SKU <span className="font-mono">{pkg.sku}</span> · {pkg.description}</p>
        <div className="mt-3"><PackageBadge value={pkg.status} /></div>
        {contract && <ChainTrace className="mt-4" messId={contract.messId} rfqId={contract.rfqId} orderId={contract.orderId} customerId={contract.customerId} />}
      </div>

      {msg && <InlineAlert tone={msg.tone} className="mb-4">{msg.text}</InlineAlert>}

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Thông tin kiện và vị trí lưu kho">
          <dl className="divide-y text-sm">
            {[
              ["Số lượng", formatNumber(pkg.quantity)],
              ["Trọng lượng", `${formatNumber(pkg.weightKg)} kg`],
              ["Kho", warehouse?.name],
              ["Vị trí", <span key="l" className="font-mono">{pkg.location}</span>],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-4 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
            ))}
          </dl>
          {movable && (
            <form
              className="mt-4 flex gap-2 border-t pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                const r = whActions.movePackage(packageId, loc.trim().toUpperCase());
                setMsg(r.ok ? { tone: "success", text: "Đã đổi vị trí lưu kho" } : { tone: "danger", text: r.error });
                if (r.ok) setLoc("");
              }}
            >
              <Input aria-label="Vị trí mới (khu-hàng-kệ)" placeholder="Vị trí mới, ví dụ A-03-12" value={loc} onChange={(e) => setLoc(e.target.value)} />
              <Button type="submit" variant="outline">Đổi vị trí</Button>
            </form>
          )}
        </SectionCard>

        <SectionCard title="Liên kết">
          <dl className="divide-y text-sm">
            <div className="flex justify-between gap-4 py-1.5"><dt className="text-muted-foreground">Đơn hàng</dt><dd><Link href={`/van-hanh/don-hang/${pkg.orderId}`} className="font-mono text-primary hover:underline">{pkg.orderId}</Link></dd></div>
            <div className="flex justify-between gap-4 py-1.5"><dt className="text-muted-foreground">Phiếu nhập kho</dt><dd className="flex items-center gap-2"><span className="font-mono">{receipt?.receiptId}</span>{receipt && <ReceiptBadge value={receipt.status} />}</dd></div>
            {receipt && <div className="flex justify-between gap-4 py-1.5"><dt className="text-muted-foreground">Nhập kho</dt><dd>{receipt.receivedAt ? `${formatDate(receipt.receivedAt)} · ${staffName(receipt.receivedBy ?? "")}` : "Chưa nhập"}</dd></div>}
            <div className="flex justify-between gap-4 py-1.5"><dt className="text-muted-foreground">Lệnh pick/pack</dt><dd className="flex items-center gap-2">{outbound ? <><Link href={`/fulfillment/pick-pack/${outbound.outboundId}`} className="font-mono text-primary hover:underline">{outbound.outboundId}</Link><OutboundBadge value={outbound.status} /></> : "Chưa có"}</dd></div>
            <div className="flex justify-between gap-4 py-1.5"><dt className="text-muted-foreground">Giao chặng cuối</dt><dd className="flex items-center gap-2">{delivery ? <><Link href={`/fulfillment/giao-hang/${delivery.deliveryId}`} className="font-mono text-primary hover:underline">{delivery.deliveryId}</Link><DeliveryBadge value={delivery.status} /></> : "Chưa giao"}</dd></div>
          </dl>
        </SectionCard>
      </div>
    </>
  );
}
