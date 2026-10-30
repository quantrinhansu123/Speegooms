"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Eye, Plus, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { originLabels, transportLabels } from "@/config/crm";
import { addDays } from "@/features/dashboard/metrics";
import { ChainTrace } from "@/features/crm/components/chain-trace";
import { MoneyInput } from "@/components/shared/money-input";
import { formatDate, formatVnd } from "@/lib/format";
import { quoteTotal } from "@/services/ops/rules";
import type { Supplier, SupplierQuote } from "@/types/ops";
import { useOps } from "../hooks";
import { HistoryList } from "./history-list";
import { Rating, RequestBadge } from "./ops-badges";

function QuoteDetailDialog({ quote, supplier, onClose }: { quote: SupplierQuote; supplier?: Supplier; onClose: () => void }) {
  const t = quoteTotal(quote);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Báo giá {quote.quoteId}</DialogTitle>
          <DialogDescription>{supplier?.name} · {supplier?.city}</DialogDescription>
        </DialogHeader>
        <table className="w-full text-sm">
          <caption className="sr-only">Chi tiết báo giá hàng và cước</caption>
          <thead>
            <tr className="border-b text-xs text-muted-foreground uppercase">
              <th className="py-2 text-left font-medium">Hạng mục</th>
              <th className="py-2 text-right font-medium">Cách tính</th>
              <th className="py-2 text-right font-medium">Thành tiền</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr><td className="py-2">Giá hàng</td><td className="tabular py-2 text-right text-muted-foreground">{formatVnd(quote.goodsUnitPrice)} × {quote.quantity.toLocaleString("vi-VN")}</td><td className="tabular py-2 text-right">{formatVnd(t.goods)}</td></tr>
            <tr><td className="py-2">Cước vận chuyển</td><td className="py-2 text-right text-muted-foreground">Trọn lô</td><td className="tabular py-2 text-right">{formatVnd(t.freight)}</td></tr>
            <tr><td className="py-2">Phí kho, xử lý</td><td className="py-2 text-right text-muted-foreground">Trọn lô</td><td className="tabular py-2 text-right">{formatVnd(t.fees)}</td></tr>
            <tr className="font-semibold"><td className="py-2" colSpan={2}>Tổng chi phí hàng và cước</td><td className="tabular py-2 text-right">{formatVnd(t.total)}</td></tr>
          </tbody>
        </table>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Thời gian sản xuất</dt><dd className="font-medium">{quote.leadTimeDays} ngày</dd></div>
          <div><dt className="text-muted-foreground">MOQ</dt><dd className="font-medium">{quote.moq}</dd></div>
          <div><dt className="text-muted-foreground">Hiệu lực đến</dt><dd className="font-medium">{formatDate(quote.validUntil)}</dd></div>
          <div><dt className="text-muted-foreground">Điều kiện thanh toán</dt><dd className="font-medium">{quote.paymentTerms}</dd></div>
        </dl>
        {quote.note && <p className="text-sm text-muted-foreground">Ghi chú: {quote.note}</p>}
      </DialogContent>
    </Dialog>
  );
}

function AddQuoteDialog({ requestId, route, taken, onClose }: { requestId: string; route: "vn" | "global"; taken: string[]; onClose: () => void }) {
  const { ops, actions, today } = useOps();
  const [supplierId, setSupplierId] = useState("");
  const [price, setPrice] = useState(0);
  const [freight, setFreight] = useState(0);
  const [fee, setFee] = useState(0);
  const [lead, setLead] = useState(20);
  const [terms, setTerms] = useState("Cọc 30%, còn lại trước khi giao");
  const [error, setError] = useState<string>();
  const options = ops.suppliers.filter((s) => s.country === (route === "vn" ? "VN" : "CN") && s.status !== "tam-dung" && !taken.includes(s.supplierId));
  const picked = ops.suppliers.find((s) => s.supplierId === supplierId);

  const submit = () => {
    if (!picked) return setError("Chọn nhà cung cấp");
    const r = actions.addSupplierQuote(requestId, { supplierId, goodsUnitPrice: price, freightCost: freight, handlingFee: fee, leadTimeDays: lead, moq: picked.moq, validUntil: addDays(today, 14), paymentTerms: terms });
    if (r.ok) onClose();
    else setError(r.error);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Thêm báo giá nhà cung cấp</DialogTitle>
          <DialogDescription>Nhập báo giá xưởng gửi lại. Tiền theo VND, giá hàng tính theo đơn vị.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nhà cung cấp" htmlFor="aq-sup" required className="sm:col-span-2" hint={options.length === 0 ? "Không còn nhà cung cấp phù hợp tuyến chưa báo giá" : undefined}>
            <NativeSelect id="aq-sup" value={supplierId} onChange={(e) => { setSupplierId(e.target.value); const s = ops.suppliers.find((x) => x.supplierId === e.target.value); if (s) setLead(s.leadTimeDays); }}>
              <option value="">Chọn nhà cung cấp</option>
              {options.map((s) => <option key={s.supplierId} value={s.supplierId}>{s.name} · {s.city}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Đơn giá hàng" htmlFor="aq-price" required><MoneyInput id="aq-price" value={price} onValueChange={(value) => setPrice(value ?? 0)} /></Field>
          <Field label="Thời gian sản xuất (ngày)" htmlFor="aq-lead"><Input id="aq-lead" type="number" min={1} value={lead} onChange={(e) => setLead(Number(e.target.value))} /></Field>
          <Field label="Cước vận chuyển" htmlFor="aq-freight"><MoneyInput id="aq-freight" value={freight} onValueChange={(value) => setFreight(value ?? 0)} /></Field>
          <Field label="Phí kho, xử lý" htmlFor="aq-fee"><MoneyInput id="aq-fee" value={fee} onValueChange={(value) => setFee(value ?? 0)} /></Field>
          <Field label="Điều kiện thanh toán" htmlFor="aq-terms" className="sm:col-span-2"><Input id="aq-terms" value={terms} onChange={(e) => setTerms(e.target.value)} /></Field>
        </div>
        {error && <InlineAlert>{error}</InlineAlert>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}><X /> Hủy</Button>
          <Button onClick={submit}><Save aria-hidden /> Tạo mới</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SourcingRequestDetail({ requestId }: { requestId: string }) {
  const { ops, crm, actions, can, staffName } = useOps();
  const [detail, setDetail] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ tone: "danger" | "success"; text: string }>();

  const req = ops.requests.find((r) => r.requestId === requestId);
  if (!req) {
    return <div className="rounded-xl border bg-card"><EmptyState title="Không tìm thấy yêu cầu" /></div>;
  }
  const rfq = crm.rfqs.find((r) => r.rfqId === req.rfqId);
  const customer = crm.customers.find((c) => c.customerId === req.customerId);
  const contract = crm.contracts.find((c) => c.rfqId === req.rfqId && c.status !== "huy");
  const quotes = ops.supplierQuotes.filter((q) => q.requestId === requestId);
  const totals = quotes.map((q) => quoteTotal(q).total);
  const cheapest = totals.length ? Math.min(...totals) : 0;
  const fastest = quotes.length ? Math.min(...quotes.map((q) => q.leadTimeDays)) : 0;
  const open = req.status !== "da-chon" && req.status !== "huy";
  const writable = can();
  const supplierOf = (id: string) => ops.suppliers.find((s) => s.supplierId === id);
  const run = (r: { ok: boolean; error?: string }, success?: string) => setMsg(r.ok ? (success ? { tone: "success", text: success } : undefined) : { tone: "danger", text: r.error ?? "Không thực hiện được" });
  const detailQuote = quotes.find((q) => q.quoteId === detail);

  return (
    <>
      <Link href="/van-hanh/sourcing-bao-gia" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Danh sách yêu cầu
      </Link>
      <div className="mb-6 rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight text-primary">{req.requestId}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{rfq?.goodsName} · {customer?.name} · nhận {formatDate(req.createdAt)} · hạn {formatDate(req.dueOn)}</p>
            <div className="mt-3"><RequestBadge value={req.status} /></div>
          </div>
          <div className="min-w-56">
            <Field label="Người phụ trách" htmlFor="sr-assignee">
              <NativeSelect id="sr-assignee" disabled={!writable || !open} value={req.assigneeId} onChange={(e) => run(actions.assignRequest(requestId, e.target.value))}>
                <option value="">Chưa phân công</option>
                {ops.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </NativeSelect>
            </Field>
          </div>
        </div>
        <ChainTrace className="mt-4" messId={req.messId} rfqId={req.rfqId} orderId={contract?.orderId} customerId={req.customerId} />
      </div>

      {msg && <InlineAlert tone={msg.tone} className="mb-4">{msg.text}</InlineAlert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Yêu cầu từ RFQ" description="Thông tin Sale đã gửi cho Sourcing">
          {rfq ? (
            <dl className="divide-y text-sm">
              {[
                ["Hàng hóa", rfq.goodsName],
                ["Số lượng", `${rfq.quantity.toLocaleString("vi-VN")} ${rfq.unit}`],
                ["Xuất xứ", originLabels[rfq.goodsOrigin]],
                ["Điểm đi", rfq.originPoint],
                ["Điểm đến", rfq.destination],
                ["Vận chuyển", transportLabels[rfq.transportMode]],
                ["Cần hàng", formatDate(rfq.targetDate)],
                ["Yêu cầu đặc biệt", rfq.specialRequirements || "—"],
                ["Hàng nhạy cảm", rfq.sensitiveGoods ? "Có" : "Không"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
              ))}
            </dl>
          ) : <p className="text-sm text-muted-foreground">Không tìm thấy RFQ.</p>}
        </SectionCard>

        <SectionCard
          className="lg:col-span-2"
          title="So sánh báo giá nhà cung cấp"
          description={quotes.length ? `${quotes.length} báo giá. Tổng chi phí = giá hàng + cước + phí.` : "Chưa có báo giá nào"}
          action={writable && open ? <Button size="sm" onClick={() => setAdding(true)}><Plus /> Thêm báo giá</Button> : undefined}
          bodyClassName="px-0 pt-3"
        >
          {quotes.length === 0 ? (
            <EmptyState title="Chưa có báo giá" description="Thêm báo giá từ các xưởng để so sánh." className="py-8" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <caption className="sr-only">So sánh báo giá của các nhà cung cấp</caption>
                <thead>
                  <tr className="border-y bg-muted/60 text-left">
                    <th className="px-5 py-2 text-xs font-semibold text-muted-foreground uppercase">Tiêu chí</th>
                    {quotes.map((q) => {
                      const s = supplierOf(q.supplierId);
                      return (
                        <th key={q.quoteId} className="px-3 py-2 align-top">
                          <Link href={`/van-hanh/nha-cung-cap/${q.supplierId}`} className="font-semibold hover:text-primary hover:underline">{s?.name}</Link>
                          <p className="text-xs font-normal text-muted-foreground">{s?.city}</p>
                          {q.status === "da-chon" && <StatusBadge tone="success" className="mt-1">Đã chọn</StatusBadge>}
                          {q.status === "loai" && <StatusBadge tone="neutral" className="mt-1">Không chọn</StatusBadge>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    ["Đánh giá", (q: SupplierQuote) => <Rating value={supplierOf(q.supplierId)?.rating ?? 0} />],
                    ["Đơn giá hàng", (q: SupplierQuote) => <span className="tabular">{formatVnd(q.goodsUnitPrice)}</span>],
                    ["Tiền hàng", (q: SupplierQuote) => <span className="tabular">{formatVnd(quoteTotal(q).goods)}</span>],
                    ["Cước", (q: SupplierQuote) => <span className="tabular">{formatVnd(q.freightCost)}</span>],
                    ["Phí kho, xử lý", (q: SupplierQuote) => <span className="tabular">{formatVnd(q.handlingFee)}</span>],
                    ["Tổng chi phí", (q: SupplierQuote) => (
                      <span className="tabular font-semibold">{formatVnd(quoteTotal(q).total)}{quoteTotal(q).total === cheapest && quotes.length > 1 && <StatusBadge tone="success" className="ml-1.5">Rẻ nhất</StatusBadge>}</span>
                    )],
                    ["Sản xuất", (q: SupplierQuote) => <span>{q.leadTimeDays} ngày{q.leadTimeDays === fastest && quotes.length > 1 && <StatusBadge tone="info" className="ml-1.5">Nhanh nhất</StatusBadge>}</span>],
                    ["MOQ", (q: SupplierQuote) => q.moq],
                    ["Hiệu lực đến", (q: SupplierQuote) => formatDate(q.validUntil)],
                  ].map(([label, render]) => (
                    <tr key={label as string}>
                      <th scope="row" className="px-5 py-2.5 text-left font-medium text-muted-foreground">{label as string}</th>
                      {quotes.map((q) => <td key={q.quoteId} className="px-3 py-2.5">{(render as (q: SupplierQuote) => React.ReactNode)(q)}</td>)}
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" className="px-5 py-3 text-left font-medium text-muted-foreground">Thao tác</th>
                    {quotes.map((q) => (
                      <td key={q.quoteId} className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => setDetail(q.quoteId)}><Eye /> Chi tiết</Button>
                          {writable && open && <Button size="sm" onClick={() => run(actions.selectQuote(requestId, q.quoteId), "Đã chọn xưởng và trả giá cho Sale")}><Check /> Chọn</Button>}
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {req.status === "da-chon" && (
        <InlineAlert tone="success" className="mt-6">
          Đã chọn xưởng và trả giá cho Sale. {contract ? <>Bước tiếp theo: tạo PO ở đơn <Link className="font-mono underline" href={`/van-hanh/don-hang/${contract.orderId}`}>{contract.orderId}</Link> (chỉ đặt xưởng được khi Kế toán đã xác nhận Đã cọc).</> : "Khi khách chấp nhận báo giá và có hợp đồng, Vận hành tạo PO."}
        </InlineAlert>
      )}

      <div className="mt-6">
        <HistoryList title="Lịch sử thao tác" entries={ops.history.filter((h) => h.refId === requestId)} staffName={staffName} />
      </div>

      {detailQuote && <QuoteDetailDialog quote={detailQuote} supplier={supplierOf(detailQuote.supplierId)} onClose={() => setDetail(undefined)} />}
      {adding && <AddQuoteDialog requestId={requestId} route={req.route} taken={quotes.map((q) => q.supplierId)} onClose={() => setAdding(false)} />}
    </>
  );
}
