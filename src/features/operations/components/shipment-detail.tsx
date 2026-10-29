"use client";

import { ArrowText } from "@/components/shared/arrow-text";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Info, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { Field, InlineAlert } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ChainTrace } from "@/features/crm/components/chain-trace";
import { costLabels, milestones, modeLabels, trackingDisclaimer } from "@/config/operations";
import { formatDate, formatVnd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { delayDays, nextMilestone, shipmentStatus } from "@/services/ops/rules";
import type { CostSet } from "@/types/ops";
import { useOps } from "../hooks";
import { DocumentsTable } from "./documents-view";
import { HistoryList } from "./history-list";
import { ShipmentBadge } from "./ops-badges";

const sum = (c: CostSet) => c.freight + c.customs + c.handling + c.other;

export function ShipmentDetail({ shipmentId }: { shipmentId: string }) {
  const { ops, crm, actions, can, staffName, today } = useOps();
  const [date, setDate] = useState(today);
  const [msg, setMsg] = useState<{ tone: "danger" | "success"; text: string }>();
  const [evLoc, setEvLoc] = useState("");
  const [evText, setEvText] = useState("");
  const [actual, setActual] = useState<CostSet>();

  const s = ops.shipments.find((x) => x.shipmentId === shipmentId);
  if (!s) return <div className="rounded-xl border bg-card"><EmptyState title="Không tìm thấy lô hàng" /></div>;

  const contract = crm.contracts.find((c) => c.orderId === s.orderId);
  const customer = crm.customers.find((c) => c.customerId === contract?.customerId);
  const partner = ops.partners.find((p) => p.partnerId === s.partnerId);
  const events = ops.trackingEvents.filter((e) => e.shipmentId === shipmentId).sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  const docs = ops.documents.filter((d) => d.shipmentId === shipmentId);
  const next = nextMilestone(s);
  const delay = delayDays(s, today);
  const writable = can();
  const costs = actual ?? s.costs.actual ?? { freight: 0, customs: 0, handling: 0, other: 0 };
  const run = (r: { ok: boolean; error?: string }, success?: string) => setMsg(r.ok ? (success ? { tone: "success", text: success } : undefined) : { tone: "danger", text: r.error ?? "Không thực hiện được" });

  return (
    <>
      <Link href="/van-hanh/logistics" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Danh sách lô hàng
      </Link>
      <div className="mb-6 rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight text-primary">{s.shipmentId}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {modeLabels[s.mode]} · {partner?.name} · phụ trách {staffName(s.assigneeId)}
            </p>
            <p className="mt-1 text-sm">{s.originPoint} <ArrowText>{"→"}</ArrowText> {s.destination}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ShipmentBadge value={shipmentStatus(s)} />
              {delay > 0 && <StatusBadge tone="danger">Chậm tiến độ {delay} ngày</StatusBadge>}
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="text-muted-foreground">ETD / ETA kế hoạch</p>
            <p className="tabular font-medium">{formatDate(s.etd)} <ArrowText>{"→"}</ArrowText> {formatDate(s.eta)}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">Mã demo {s.trackingRef}</p>
          </div>
        </div>
        {contract && <ChainTrace className="mt-4" messId={contract.messId} rfqId={contract.rfqId} orderId={contract.orderId} customerId={contract.customerId} />}
        <p className="mt-3 text-xs text-muted-foreground">Khách: {customer?.name}</p>
      </div>

      {msg && <InlineAlert tone={msg.tone} className="mb-4">{msg.text}</InlineAlert>}

      <SectionCard title="Các mốc" description="Kế hoạch và thực tế. Hoàn thành tuần tự, ngày thực tế không ở tương lai." className="mb-6" bodyClassName="px-0 pt-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <caption className="sr-only">Các mốc của lô hàng</caption>
            <thead>
              <tr className="border-y bg-muted/60 text-left text-xs font-semibold text-muted-foreground uppercase">
                <th className="px-5 py-2">Mốc</th>
                <th className="px-3 py-2">Kế hoạch</th>
                <th className="px-3 py-2">Thực tế</th>
                <th className="px-3 py-2">Tình trạng</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {milestones.map((m) => {
                const ms = s.milestones[m.key];
                const late = !ms.actualOn && ms.plannedOn < today;
                const slipped = ms.actualOn && ms.actualOn > ms.plannedOn;
                return (
                  <tr key={m.key} className={cn(next?.key === m.key && "bg-accent/50")}>
                    <th scope="row" className="px-5 py-2.5 text-left font-medium">{m.label}</th>
                    <td className="tabular px-3 py-2.5">{formatDate(ms.plannedOn)}</td>
                    <td className="tabular px-3 py-2.5">{ms.actualOn ? formatDate(ms.actualOn) : "—"}</td>
                    <td className="px-3 py-2.5">
                      {ms.actualOn ? <StatusBadge tone={slipped ? "warning" : "success"}>{slipped ? "Xong, trễ so kế hoạch" : "Xong đúng hạn"}</StatusBadge> : late ? <StatusBadge tone="danger">Quá hạn {Math.round((Date.parse(today) - Date.parse(ms.plannedOn)) / 864e5)} ngày</StatusBadge> : <span className="text-xs text-muted-foreground">Chưa tới hạn</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {writable && next && (
          <div className="flex flex-wrap items-end gap-3 px-5 pt-4">
            <Field label={`Hoàn thành mốc: ${next.label}`} htmlFor="sd-date">
              <Input id="sd-date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Button onClick={() => run(actions.completeMilestone(shipmentId, next.key, date), `Đã hoàn thành mốc ${next.label}`)}><Check /> Xác nhận hoàn thành</Button>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Timeline tracking">
          <InlineAlert tone="info" className="mb-4 flex items-start gap-2 text-xs">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
            {trackingDisclaimer}
          </InlineAlert>
          {writable && (
            <form
              className="mb-4 grid gap-2 sm:grid-cols-[1fr_2fr_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                const r = actions.addTrackingEvent(shipmentId, evLoc, evText);
                run(r);
                if (r.ok) { setEvLoc(""); setEvText(""); }
              }}
            >
              <Input aria-label="Vị trí" placeholder="Vị trí" value={evLoc} onChange={(e) => setEvLoc(e.target.value)} />
              <Input aria-label="Nội dung sự kiện" placeholder="Nội dung (nhập tay)" value={evText} onChange={(e) => setEvText(e.target.value)} />
              <Button type="submit" variant="outline"><Plus /> Thêm</Button>
            </form>
          )}
          {events.length === 0 ? (
            <EmptyState title="Chưa có sự kiện" className="py-6" />
          ) : (
            <ol className="relative space-y-4 border-l pl-5">
              {events.map((e) => (
                <li key={e.id} className="relative">
                  <span aria-hidden className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full border-2 border-surface bg-primary" />
                  <p className="text-sm">{e.text}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{e.location} · {formatDate(e.at.slice(0, 10))} {e.at.slice(11)}</span>
                    <StatusBadge tone={e.source === "demo" ? "neutral" : "info"}>{e.source === "demo" ? "Dữ liệu demo" : "Nhập tay"}</StatusBadge>
                  </p>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>

        <SectionCard title="Chi phí vận chuyển" description="Dự kiến so với thực tế (VND)" bodyClassName="px-0 pt-3">
          <table className="w-full text-sm">
            <caption className="sr-only">Chi phí dự kiến và thực tế</caption>
            <thead>
              <tr className="border-y bg-muted/60 text-xs font-semibold text-muted-foreground uppercase">
                <th className="px-5 py-2 text-left">Hạng mục</th>
                <th className="px-3 py-2 text-right">Dự kiến</th>
                <th className="px-3 py-2 text-right">Thực tế</th>
                <th className="px-5 py-2 text-right">Chênh lệch</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(Object.keys(costLabels) as (keyof CostSet)[]).map((k) => {
                const est = s.costs.estimated[k];
                const act = s.costs.actual?.[k];
                const diff = act === undefined ? undefined : act - est;
                return (
                  <tr key={k}>
                    <th scope="row" className="px-5 py-2.5 text-left font-medium">{costLabels[k]}</th>
                    <td className="tabular px-3 py-2.5 text-right">{formatVnd(est)}</td>
                    <td className="px-3 py-2.5 text-right">
                      {writable ? (
                        <Input aria-label={`Thực tế: ${costLabels[k]}`} type="number" min={0} className="ml-auto h-8 w-32 text-right" value={costs[k]} onChange={(e) => setActual({ ...costs, [k]: Number(e.target.value) })} />
                      ) : <span className="tabular">{act === undefined ? "—" : formatVnd(act)}</span>}
                    </td>
                    <td className={cn("tabular px-5 py-2.5 text-right", diff && diff > 0 ? "text-danger" : diff && diff < 0 ? "text-success" : "")}>{diff === undefined ? "—" : `${diff > 0 ? "+" : ""}${formatVnd(diff)}`}</td>
                  </tr>
                );
              })}
              <tr className="font-semibold">
                <th scope="row" className="px-5 py-2.5 text-left">Tổng</th>
                <td className="tabular px-3 py-2.5 text-right">{formatVnd(sum(s.costs.estimated))}</td>
                <td className="tabular px-3 py-2.5 text-right">{s.costs.actual ? formatVnd(sum(s.costs.actual)) : "—"}</td>
                <td className="px-5 py-2.5" />
              </tr>
            </tbody>
          </table>
          {writable && (
            <div className="flex justify-end px-5 pt-4">
              <Button variant="outline" disabled={!actual} onClick={() => { run(actions.saveActualCosts(shipmentId, costs), "Đã lưu chi phí thực tế"); setActual(undefined); }}><RefreshCw aria-hidden /> Lưu chi phí thực tế</Button>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title={`Chứng từ lô hàng (${docs.length})`} className="mt-6" bodyClassName="px-0 pt-3">
        <DocumentsTable docs={docs} showShipment={false} />
      </SectionCard>

      <div className="mt-6">
        <HistoryList title="Lịch sử thao tác của đơn" entries={ops.history.filter((h) => h.orderId === s.orderId)} staffName={staffName} />
      </div>
    </>
  );
}
