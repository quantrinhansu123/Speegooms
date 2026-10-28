"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { depositMeta, originLabels, routeLabels, transportLabels } from "@/config/crm";
import { modeLabels } from "@/config/operations";
import { ChainTrace } from "@/features/crm/components/chain-trace";
import { DepositBadge } from "@/features/crm/components/meta-badges";
import { formatDate, formatMoney, formatVnd } from "@/lib/format";
import { quoteTotals } from "@/services/crm/rules";
import { canPlacePo, quoteTotal, shipmentStatus } from "@/services/ops/rules";
import { useOps } from "../hooks";
import { DocumentsTable } from "./documents-view";
import { HandoverCard } from "./handover-card";
import { HistoryList } from "./history-list";
import { OrderTimeline } from "./order-timeline";
import { PoBadge, ShipmentBadge, StageBadge } from "./ops-badges";
import { ShipmentCreateDialog } from "./shipment-create-dialog";

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

export function OrderDetail({ orderId }: { orderId: string }) {
  const { orders, ops, crm, actions, can, staffName } = useOps();
  const [msg, setMsg] = useState<{ tone: "danger" | "success"; text: string }>();
  const [shipDialog, setShipDialog] = useState(false);
  const [note, setNote] = useState("");

  const view = orders.find((o) => o.contract.orderId === orderId);
  if (!view) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState title="Không tìm thấy đơn hàng" description="Đơn chưa có hợp đồng đã ký hoặc không tồn tại." action={<Link href="/van-hanh/don-hang" className="text-sm font-medium text-primary hover:underline">Về danh sách đơn</Link>} />
      </div>
    );
  }
  const { contract, customer, rfq, state, po, shipments, documents, request, alerts, stage } = view;
  const writable = can();
  const gate = canPlacePo(contract, state.orderId ? state : undefined);
  const crmQuote = crm.quotations.find((q) => q.quoteId === contract.quoteId);
  const supplierQuote = ops.supplierQuotes.find((q) => q.quoteId === request?.selectedQuoteId);
  const supplier = ops.suppliers.find((s) => s.supplierId === (po?.supplierId ?? supplierQuote?.supplierId));
  const customerTotals = crmQuote ? quoteTotals(crmQuote) : undefined;
  const costTotals = supplierQuote ? quoteTotal(supplierQuote) : undefined;
  const history = ops.history.filter((h) => h.orderId === orderId);
  const run = (r: { ok: boolean; error?: string }, success?: string) => setMsg(r.ok ? (success ? { tone: "success", text: success } : undefined) : { tone: "danger", text: r.error ?? "Không thực hiện được" });
  const canShip = !!po && (po.status === "san-sang" || po.status === "da-giao-vc");

  return (
    <>
      <Link href="/van-hanh/don-hang" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Danh sách đơn hàng
      </Link>
      <div className="mb-6 rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight text-primary">{contract.orderId}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Hợp đồng {contract.contractNo} ·{" "}
              <Link href={`/crm/khach-hang/${contract.customerId}`} className="hover:underline">{customer?.name ?? contract.customerId}</Link> · {routeLabels[contract.route]}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StageBadge value={stage} />
              <DepositBadge value={contract.deposit.status} />
            </div>
          </div>
          <div className="min-w-56 space-y-3">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Giá trị hợp đồng</p>
              <p className="tabular text-2xl font-semibold text-primary">{formatMoney(contract.value, contract.currency)}</p>
            </div>
            <Field label="Phụ trách Vận hành" htmlFor="od-assignee">
              <NativeSelect id="od-assignee" disabled={!writable} value={state.assigneeId} onChange={(e) => run(actions.assignOrder(orderId, e.target.value))}>
                <option value="">Chưa phân công</option>
                {ops.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </NativeSelect>
            </Field>
          </div>
        </div>
        <ChainTrace className="mt-4" messId={contract.messId} rfqId={contract.rfqId} orderId={contract.orderId} customerId={contract.customerId} />
        <p className="mt-3 text-xs text-muted-foreground">Sale phụ trách: {staffName(contract.ownerId)} · Hạn giao: {state.dueOn ? formatDate(state.dueOn) : "chưa đặt"}</p>
      </div>

      {msg && <InlineAlert tone={msg.tone} className="mb-4">{msg.text}</InlineAlert>}

      <Tabs defaultValue="overview">
        <TabsList className="mb-4 h-auto flex-wrap">
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="goods">Hàng hóa</TabsTrigger>
          <TabsTrigger value="quote">Báo giá</TabsTrigger>
          <TabsTrigger value="payment">Thanh toán</TabsTrigger>
          <TabsTrigger value="shipping">Vận chuyển ({shipments.length})</TabsTrigger>
          <TabsTrigger value="docs">Chứng từ ({documents.length})</TabsTrigger>
          <TabsTrigger value="history">Lịch sử ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {alerts.length > 0 && (
            <div className="mb-6 space-y-2" aria-label="Cảnh báo của đơn">
              {alerts.map((a, i) => (
                <InlineAlert key={i} tone={a.level === "danger" ? "danger" : "warning"} className="flex items-center gap-2">
                  <AlertTriangle aria-hidden className="size-4 shrink-0" />
                  <span><strong className="font-medium">{a.kind === "qua-han" ? "Quá hạn" : a.kind === "thieu-thong-tin" ? "Thiếu thông tin" : "Chờ xác nhận"}:</strong> {a.text}</span>
                </InlineAlert>
              ))}
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <OrderTimeline stage={stage} />
            <HandoverCard key={`${orderId}-${state.handover.status}`} view={view} />
          </div>
        </TabsContent>

        <TabsContent value="goods">
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Hàng hóa (từ RFQ)">
              {rfq ? (
                <dl className="divide-y">
                  <Row k="Hàng hóa">{rfq.goodsName}</Row>
                  <Row k="Số lượng">{rfq.quantity.toLocaleString("vi-VN")} {rfq.unit}</Row>
                  <Row k="Xuất xứ">{originLabels[rfq.goodsOrigin]}</Row>
                  <Row k="Điểm đi">{rfq.originPoint}</Row>
                  <Row k="Điểm đến">{rfq.destination}</Row>
                  <Row k="Vận chuyển">{transportLabels[rfq.transportMode]}</Row>
                  <Row k="Yêu cầu đặc biệt">{rfq.specialRequirements || "—"}</Row>
                  <Row k="Hàng nhạy cảm">{rfq.sensitiveGoods ? "Có" : "Không"}</Row>
                </dl>
              ) : <p className="text-sm text-muted-foreground">Không tìm thấy RFQ.</p>}
              <p className="mt-3 text-xs text-muted-foreground">RFQ: <Link href={`/crm/rfq/${contract.rfqId}`} className="font-mono text-primary hover:underline">{contract.rfqId}</Link></p>
            </SectionCard>

            <SectionCard title="Đặt xưởng (PO)" description="Chỉ đặt xưởng khi Kế toán đã xác nhận Đã cọc">
              {po ? (
                <dl className="divide-y">
                  <Row k="PO"><Link href={`/van-hanh/po/${po.poId}`} className="font-mono text-primary hover:underline">{po.poId}</Link></Row>
                  <Row k="Nhà cung cấp">{supplier?.name}</Row>
                  <Row k="Giá trị PO">{formatVnd(po.amount)}</Row>
                  <Row k="Trạng thái"><PoBadge value={po.status} /></Row>
                  <Row k="Dự kiến sẵn sàng">{formatDate(po.expectedReadyOn)}</Row>
                </dl>
              ) : (
                <div className="space-y-3">
                  {!gate.ok && (
                    <InlineAlert><p className="flex items-center gap-1.5 font-medium"><Lock aria-hidden className="size-4" /> Chưa thể đặt xưởng</p><p className="mt-0.5">{gate.reason}</p></InlineAlert>
                  )}
                  {gate.ok && !supplierQuote && <InlineAlert tone="warning">Chưa chọn xưởng ở bước Sourcing. {request ? <Link className="underline" href={`/van-hanh/sourcing-bao-gia/${request.requestId}`}>Mở yêu cầu {request.requestId}</Link> : "Chưa có yêu cầu tìm nguồn cho RFQ này."}</InlineAlert>}
                  {writable && (
                    <Button disabled={!gate.ok || !supplierQuote} onClick={() => run(actions.createPo(orderId), "Đã tạo PO nháp")}>
                      {gate.ok ? <Plus /> : <Lock />} Tạo PO
                    </Button>
                  )}
                </div>
              )}
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="quote">
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Báo giá khách (Sale)" description={crmQuote ? `${crmQuote.quoteId} · khách chấp nhận` : undefined}>
              {customerTotals ? (
                <dl className="divide-y">
                  <Row k="Tiền hàng">{formatMoney(customerTotals.goods, contract.currency)}</Row>
                  <Row k="Cước">{formatMoney(customerTotals.freight, contract.currency)}</Row>
                  <Row k="Phụ phí">{formatMoney(customerTotals.surcharges, contract.currency)}</Row>
                  <Row k="Giảm giá">−{formatMoney(customerTotals.discount, contract.currency)}</Row>
                  <Row k="Tổng báo khách"><strong>{formatMoney(customerTotals.total, contract.currency)}</strong></Row>
                </dl>
              ) : <p className="text-sm text-muted-foreground">Không tìm thấy báo giá.</p>}
              {crmQuote && <p className="mt-3 text-xs text-muted-foreground"><Link href={`/crm/bao-gia/${crmQuote.quoteId}`} className="text-primary hover:underline">Xem báo giá đầy đủ</Link></p>}
            </SectionCard>
            <SectionCard title="Chi phí đầu vào (xưởng)" description={supplier ? `Báo giá ${supplierQuote?.quoteId} · ${supplier.name}` : "Chưa chọn xưởng"}>
              {costTotals && customerTotals ? (
                <dl className="divide-y">
                  <Row k="Giá hàng xưởng">{formatVnd(costTotals.goods)}</Row>
                  <Row k="Cước">{formatVnd(costTotals.freight)}</Row>
                  <Row k="Phí kho, xử lý">{formatVnd(costTotals.fees)}</Row>
                  <Row k="Tổng chi phí"><strong>{formatVnd(costTotals.total)}</strong></Row>
                  <Row k="Chênh lệch so với giá bán">{formatVnd(customerTotals.total - costTotals.total)}</Row>
                </dl>
              ) : <p className="text-sm text-muted-foreground">Chọn xưởng ở Sourcing để so sánh chi phí đầu vào với giá bán.</p>}
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="payment">
          <SectionCard title="Thanh toán và cọc" description="Đọc từ hợp đồng. Xác nhận cọc, công nợ và chi trả thuộc Kế toán, chưa nằm trong phạm vi Vận hành">
            <dl className="divide-y">
              <Row k="Giá trị hợp đồng">{formatMoney(contract.value, contract.currency)}</Row>
              <Row k="Số tiền cọc">{formatMoney(contract.deposit.amount, contract.currency)}</Row>
              <Row k="Trạng thái cọc"><StatusBadge tone={depositMeta[contract.deposit.status].tone}>{depositMeta[contract.deposit.status].label}</StatusBadge></Row>
              <Row k="Kế toán xác nhận">{contract.deposit.confirmedAt ? `${formatDate(contract.deposit.confirmedAt)} · ${staffName(contract.deposit.confirmedBy ?? "")}` : "Chưa"}</Row>
              <Row k="Còn lại sau cọc">{formatMoney(contract.value - contract.deposit.amount, contract.currency)}</Row>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground"><Link href={`/crm/hop-dong/${contract.orderId}`} className="text-primary hover:underline">Mở hợp đồng và cọc</Link></p>
          </SectionCard>
        </TabsContent>

        <TabsContent value="shipping">
          <SectionCard
            title="Lô hàng"
            description="Tracking là dữ liệu demo hoặc nhập tay, không theo dõi thời gian thực"
            action={writable ? <Button size="sm" disabled={!canShip} onClick={() => setShipDialog(true)}><Plus /> Tạo lô hàng</Button> : undefined}
          >
            {!canShip && <p className="mb-3 text-sm text-muted-foreground">{po ? "PO phải ở trạng thái Hàng sẵn sàng để tạo lô hàng." : "Chưa có PO nên chưa tạo được lô hàng."}</p>}
            {shipments.length === 0 ? (
              <EmptyState title="Chưa có lô hàng" className="py-6" />
            ) : (
              <ul className="divide-y">
                {shipments.map((s) => (
                  <li key={s.shipmentId} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <Link href={`/van-hanh/logistics/${s.shipmentId}`} className="font-mono font-medium text-primary hover:underline">{s.shipmentId}</Link>
                      <p className="text-xs text-muted-foreground">{modeLabels[s.mode]} · {s.originPoint} → {s.destination} · ETA {formatDate(s.eta)}</p>
                    </div>
                    <ShipmentBadge value={shipmentStatus(s)} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="docs">
          <SectionCard title="Chứng từ" bodyClassName="px-0 pt-3">
            <DocumentsTable docs={documents} />
          </SectionCard>
        </TabsContent>

        <TabsContent value="history">
          <div className="space-y-6">
            {writable && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const r = actions.addOrderNote(orderId, note);
                  run(r);
                  if (r.ok) setNote("");
                }}
              >
                <Input aria-label="Ghi chú cho đơn" placeholder="Thêm ghi chú vào lịch sử đơn…" value={note} onChange={(e) => setNote(e.target.value)} />
                <Button type="submit" variant="outline">Thêm ghi chú</Button>
              </form>
            )}
            <HistoryList title="Lịch sử thao tác" entries={history} staffName={staffName} />
          </div>
        </TabsContent>
      </Tabs>

      {shipDialog && <ShipmentCreateDialog orderId={orderId} onClose={() => setShipDialog(false)} onCreated={() => setShipDialog(false)} />}
    </>
  );
}
