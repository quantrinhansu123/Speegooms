"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { costLabels, modeLabels } from "@/config/operations";
import type { TransportMode } from "@/types/crm";
import type { CostSet } from "@/types/ops";
import { useOps } from "../hooks";

/** Tạo lô hàng từ đơn. Kế hoạch các mốc tính theo hình thức vận chuyển (ước tính demo, chỉnh khi có dữ liệu hãng). */
export function ShipmentCreateDialog({ orderId, onClose, onCreated }: { orderId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const { ops, crm, actions, today } = useOps();
  const contract = crm.contracts.find((c) => c.orderId === orderId);
  const rfq = crm.rfqs.find((r) => r.rfqId === contract?.rfqId);
  const po = ops.pos.find((p) => p.orderId === orderId && p.status !== "huy");
  const quote = ops.supplierQuotes.find((q) => q.quoteId === po?.quoteId);

  const [mode, setMode] = useState<TransportMode>(rfq?.transportMode ?? "sea-lcl");
  const [origin, setOrigin] = useState(rfq?.originPoint ?? "");
  const [dest, setDest] = useState(rfq?.destination ?? "");
  const [partnerId, setPartnerId] = useState("");
  const [startOn, setStartOn] = useState(today);
  const [est, setEst] = useState<CostSet>({ freight: quote?.freightCost ?? 0, customs: 0, handling: quote?.handlingFee ?? 0, other: 0 });
  const [error, setError] = useState<string>();
  const partners = ops.partners.filter((p) => p.mode === "both" || (mode === "air" ? p.mode === "air" : p.mode === "sea"));

  const submit = () => {
    if (!partnerId) return setError("Chọn đối tác vận chuyển");
    const r = actions.createShipment(orderId, { mode, originPoint: origin, destination: dest, partnerId, startOn, estimated: est });
    if (r.ok && r.id) onCreated(r.id);
    else if (!r.ok) setError(r.error);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Tạo lô hàng cho {orderId}</DialogTitle>
          <DialogDescription>Cần PO ở trạng thái Hàng sẵn sàng. Kế hoạch mốc tự tính từ ngày nhận hàng, bạn cập nhật khi có thực tế.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hình thức" htmlFor="sc-mode">
            <NativeSelect id="sc-mode" value={mode} onChange={(e) => { setMode(e.target.value as TransportMode); setPartnerId(""); }}>
              {(Object.keys(modeLabels) as TransportMode[]).map((m) => <option key={m} value={m}>{modeLabels[m]}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Đối tác vận chuyển" htmlFor="sc-partner" required>
            <NativeSelect id="sc-partner" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
              <option value="">Chọn đối tác</option>
              {partners.map((p) => <option key={p.partnerId} value={p.partnerId}>{p.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Điểm đi" htmlFor="sc-origin" required><Input id="sc-origin" value={origin} onChange={(e) => setOrigin(e.target.value)} /></Field>
          <Field label="Điểm đến" htmlFor="sc-dest" required><Input id="sc-dest" value={dest} onChange={(e) => setDest(e.target.value)} /></Field>
          <Field label="Ngày nhận hàng dự kiến" htmlFor="sc-start" className="sm:col-span-2"><Input id="sc-start" type="date" value={startOn} onChange={(e) => setStartOn(e.target.value)} /></Field>
          {(Object.keys(costLabels) as (keyof CostSet)[]).map((k) => (
            <Field key={k} label={`${costLabels[k]} dự kiến`} htmlFor={`sc-${k}`}>
              <Input id={`sc-${k}`} type="number" min={0} value={est[k]} onChange={(e) => setEst({ ...est, [k]: Number(e.target.value) })} />
            </Field>
          ))}
        </div>
        {error && <InlineAlert>{error}</InlineAlert>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={submit}>Tạo lô hàng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
