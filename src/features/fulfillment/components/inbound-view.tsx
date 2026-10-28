"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Column } from "@/components/shared/data-table";
import { Field, InlineAlert } from "@/components/shared/form-fields";
import { ListView } from "@/components/shared/list-view";
import { receiptStatusMeta } from "@/config/fulfillment";
import { formatDate } from "@/lib/format";
import { inboundDelayDays, isInboundLate } from "@/services/fulfillment/rules";
import type { InboundReceipt, ReceiptStatus } from "@/types/fulfillment";
import { useFulfillment } from "../hooks";
import { ReceiptBadge } from "./fulfillment-badges";

function ReceiveDialog({ receipt, onClose }: { receipt: InboundReceipt; onClose: () => void }) {
  const { whActions } = useFulfillment();
  const [qty, setQty] = useState(receipt.expectedQty);
  const [weight, setWeight] = useState(0);
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const submit = () => {
    const r = whActions.receiveInbound(receipt.receiptId, qty, weight, location.trim().toUpperCase(), note);
    if (r.ok) onClose();
    else setError(r.error);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nhập kho {receipt.receiptId}</DialogTitle>
          <DialogDescription>Kiểm đếm hàng của lô {receipt.shipmentId}. Số dự kiến theo PO: {receipt.expectedQty.toLocaleString("vi-VN")}. Lệch số lượng phải ghi chú.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Số lượng thực nhận" htmlFor="rv-qty" required><Input id="rv-qty" type="number" min={0} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>
          <Field label="Tổng trọng lượng (kg)" htmlFor="rv-w" required><Input id="rv-w" type="number" min={0} value={weight} onChange={(e) => setWeight(Number(e.target.value))} /></Field>
          <Field label="Vị trí lưu kho" htmlFor="rv-loc" required hint="Dạng khu-hàng-kệ, ví dụ B-04-07" className="sm:col-span-2"><Input id="rv-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="B-04-07" /></Field>
          <Field label="Ghi chú" htmlFor="rv-note" className="sm:col-span-2"><Textarea id="rv-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={qty !== receipt.expectedQty ? "Bắt buộc: lý do lệch số lượng" : "Tình trạng hàng khi nhận"} /></Field>
        </div>
        {error && <InlineAlert>{error}</InlineAlert>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={submit}>Xác nhận nhập kho</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InboundView() {
  const { wh, crm, canWh, today } = useFulfillment();
  const [receiving, setReceiving] = useState<InboundReceipt>();
  const customerOf = new Map(crm.contracts.map((c) => [c.orderId, crm.customers.find((x) => x.customerId === c.customerId)?.name ?? c.customerId]));
  const whName = new Map(wh.warehouses.map((w) => [w.warehouseId, w.name]));

  const columns: Column<InboundReceipt>[] = [
    { key: "id", header: "Phiếu", cell: (r) => <span className="font-mono text-xs font-medium">{r.receiptId}</span> },
    {
      key: "order",
      header: "Đơn / khách",
      cell: (r) => (
        <div className="min-w-0">
          <Link href={`/van-hanh/don-hang/${r.orderId}`} className="font-mono text-xs hover:text-primary hover:underline">{r.orderId}</Link>
          <p className="max-w-48 truncate text-xs text-muted-foreground">{customerOf.get(r.orderId)}</p>
        </div>
      ),
    },
    { key: "ship", header: "Lô hàng", cell: (r) => <Link href={`/van-hanh/logistics/${r.shipmentId}`} className="font-mono text-xs text-primary hover:underline">{r.shipmentId}</Link>, className: "hidden lg:table-cell" },
    { key: "wh", header: "Kho", cell: (r) => <span className="text-xs">{whName.get(r.warehouseId)}</span>, className: "hidden xl:table-cell" },
    { key: "arr", header: "Hàng về", cell: (r) => <span className="tabular text-muted-foreground">{formatDate(r.arrivedOn)}</span> },
    { key: "qty", header: "Dự kiến / nhận", align: "right", cell: (r) => `${r.expectedQty.toLocaleString("vi-VN")} / ${r.status === "cho-nhap" ? "—" : r.receivedQty.toLocaleString("vi-VN")}` },
    {
      key: "status",
      header: "Trạng thái",
      cell: (r) => (
        <div>
          <ReceiptBadge value={r.status} />
          {isInboundLate(r, today) && <p className="mt-0.5 text-xs font-medium text-danger">Chờ {inboundDelayDays(r, today)} ngày</p>}
          {r.note && <p className="mt-0.5 max-w-52 text-xs text-muted-foreground">{r.note}</p>}
        </div>
      ),
    },
    {
      key: "act",
      header: "Thao tác",
      cell: (r) => (r.status === "cho-nhap" && canWh() ? <Button size="sm" onClick={() => setReceiving(r)}>Nhập kho</Button> : null),
    },
  ];

  return (
    <>
      <ListView
        title="Hàng nhập kho"
        description="Hàng của lô đã về kho đích. Kiểm đếm và nhập kho để sinh kiện hàng với vị trí lưu kho."
        columns={columns}
        rows={wh.receipts}
        getRowId={(r) => r.receiptId}
        searchLabel="Tìm phiếu nhập kho"
        searchPlaceholder="Tìm mã phiếu, đơn hàng, lô hàng, khách…"
        searchText={(r) => [r.receiptId, r.orderId, r.shipmentId, customerOf.get(r.orderId)]}
        filters={[
          { id: "status", label: "Mọi trạng thái", options: (Object.keys(receiptStatusMeta) as ReceiptStatus[]).map((s) => ({ value: s, label: receiptStatusMeta[s].label })), match: (r, v) => r.status === v },
          { id: "wh", label: "Mọi kho", options: wh.warehouses.map((w) => ({ value: w.warehouseId, label: w.name })), match: (r, v) => r.warehouseId === v, className: "w-56" },
        ]}
        toggles={[{ id: "late", label: "Chỉ phiếu chờ quá hạn", match: (r) => isInboundLate(r, today) }]}
        sort={(a, b) => (a.status === "cho-nhap" ? 0 : 1) - (b.status === "cho-nhap" ? 0 : 1) || b.arrivedOn.localeCompare(a.arrivedOn)}
      />
      {receiving && <ReceiveDialog receipt={receiving} onClose={() => setReceiving(undefined)} />}
    </>
  );
}
