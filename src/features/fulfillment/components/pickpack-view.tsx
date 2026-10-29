"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Column } from "@/components/shared/data-table";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { ListView } from "@/components/shared/list-view";
import { outboundStatusMeta } from "@/config/fulfillment";
import { formatDate } from "@/lib/format";
import { canCreateOutbound } from "@/services/fulfillment/rules";
import type { Outbound, OutboundStatus } from "@/types/fulfillment";
import { useFulfillment } from "../hooks";
import { OutboundBadge } from "./fulfillment-badges";

function CreateOutboundDialog({ onClose }: { onClose: () => void }) {
  const { wh, crm, whActions } = useFulfillment();
  const router = useRouter();
  const [orderId, setOrderId] = useState("");
  const [error, setError] = useState<string>();
  const customerOf = new Map(crm.contracts.map((c) => [c.orderId, crm.customers.find((x) => x.customerId === c.customerId)?.name ?? c.customerId]));
  const eligible = [...new Set(wh.packages.map((p) => p.orderId))].filter((id) => canCreateOutbound(id, wh).ok);

  const submit = () => {
    if (!orderId) return setError("Chọn đơn hàng");
    const r = whActions.createOutbound(orderId);
    if (r.ok && r.id) router.push(`/fulfillment/pick-pack/${r.id}`);
    else if (!r.ok) setError(r.error);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tạo lệnh pick/pack</DialogTitle>
          <DialogDescription>Chỉ đơn có mọi kiện đang Trong kho và chưa có lệnh mới hiện ở đây. Kiện được giữ chỗ khi tạo lệnh.</DialogDescription>
        </DialogHeader>
        <Field label="Đơn hàng" htmlFor="co-order" required hint={eligible.length === 0 ? "Hiện không có đơn nào đủ điều kiện" : undefined}>
          <NativeSelect id="co-order" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
            <option value="">Chọn đơn hàng</option>
            {eligible.map((id) => <option key={id} value={id}>{id} · {customerOf.get(id)}</option>)}
          </NativeSelect>
        </Field>
        {error && <InlineAlert>{error}</InlineAlert>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}><X /> Hủy</Button>
          <Button onClick={submit}><Save aria-hidden /> Tạo mới</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PickPackView() {
  const { wh, crm, canWh, staffName } = useFulfillment();
  const [creating, setCreating] = useState(false);
  const customerOf = new Map(crm.contracts.map((c) => [c.orderId, crm.customers.find((x) => x.customerId === c.customerId)?.name ?? c.customerId]));

  const columns: Column<Outbound>[] = [
    { key: "id", header: "Lệnh", cell: (o) => <Link href={`/fulfillment/pick-pack/${o.outboundId}`} className="font-mono text-xs font-medium text-primary hover:underline">{o.outboundId}</Link> },
    {
      key: "order",
      header: "Đơn / khách",
      cell: (o) => (
        <div className="min-w-0">
          <Link href={`/van-hanh/don-hang/${o.orderId}`} className="font-mono text-xs hover:text-primary hover:underline">{o.orderId}</Link>
          <p className="max-w-48 truncate text-xs text-muted-foreground">{customerOf.get(o.orderId)}</p>
        </div>
      ),
    },
    { key: "pk", header: "Kiện (đã pick)", align: "right", cell: (o) => `${o.pickedIds.length}/${o.packageIds.length}` },
    { key: "status", header: "Trạng thái", cell: (o) => <OutboundBadge value={o.status} /> },
    { key: "who", header: "Phụ trách", cell: (o) => staffName(o.assigneeId), className: "hidden lg:table-cell" },
    { key: "date", header: "Tạo ngày", cell: (o) => <span className="tabular text-muted-foreground">{formatDate(o.createdAt)}</span>, className: "hidden md:table-cell" },
  ];

  return (
    <>
      <ListView dateValue={(r) => r.createdAt}
        title="Pick / Pack"
        description="Lệnh xuất kho: pick từng kiện, đóng gói rồi giao đối tác giao chặng cuối."
        actions={canWh() && <Button size="lg" onClick={() => setCreating(true)}><Plus /> Tạo lệnh pick</Button>}
        columns={columns}
        rows={wh.outbounds}
        getRowId={(o) => o.outboundId}
        searchLabel="Tìm lệnh pick/pack"
        searchPlaceholder="Tìm mã lệnh, đơn hàng, khách…"
        searchText={(o) => [o.outboundId, o.orderId, customerOf.get(o.orderId)]}
        filters={[{ id: "status", label: "Mọi trạng thái", options: (Object.keys(outboundStatusMeta) as OutboundStatus[]).map((s) => ({ value: s, label: outboundStatusMeta[s].label })), match: (o, v) => o.status === v, className: "w-56" }]}
        toggles={[{ id: "open", label: "Chỉ lệnh chưa xuất kho", match: (o) => o.status !== "da-xuat" }]}
        sort={(a, b) => (a.status === "da-xuat" ? 1 : 0) - (b.status === "da-xuat" ? 1 : 0) || b.outboundId.localeCompare(a.outboundId)}
      />
      {creating && <CreateOutboundDialog onClose={() => setCreating(false)} />}
    </>
  );
}
