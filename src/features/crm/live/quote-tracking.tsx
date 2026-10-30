"use client";

import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import type { CrmLane } from "@speego/shared";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrackingOverview, accountingLabel } from "./tracking-overview";
import { SectionCard } from "@/components/shared/section-card";
import { InlineAlert } from "@/components/shared/form-fields";
import { ApiError, api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { crmPath } from "./lane";
import type { ContractRecord } from "./contracts-live-view";
import { type PotentialRecord, type RfqQuoteRecord, deskLabel, potentialOptions, labelOf } from "./types";
import { QuoteStatusBadge } from "./status-badges";
import { RequirementImageSlider } from "./requirement-image-slider";
import { QuoteSheetPreview } from "./quote-sheet-preview";
import { quoteSheetHtml } from "./quote-print";

function Details({ rows }: { rows: [string, ReactNode][] }) {
  return <dl className="grid gap-3 text-sm sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words font-medium">{value || "—"}</dd></div>)}</dl>;
}

const trackingLinkStyles = {
  button: "inline-flex rounded-md border px-3 py-1.5 text-sm font-medium text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
  code: "cursor-pointer font-mono text-primary transition-colors hover:text-brand-orange hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring",
} as const;

export function QuoteTracking({ potentialId, lane, code, variant = "button" }: { potentialId: string; lane: CrmLane; code?: string; variant?: keyof typeof trackingLinkStyles }) {
  return <Link href={`/crm/theo-doi-bao-gia/${lane}/${encodeURIComponent(potentialId)}`} className={trackingLinkStyles[variant]}>
    {code ?? "Theo dõi chi tiết"}
  </Link>;
}

export function QuoteTrackingPage({ potentialId, lane }: { potentialId: string; lane: CrmLane }) {
  const [data, setData] = useState<{ potential?: PotentialRecord; quotes: RfqQuoteRecord[]; contracts: ContractRecord[]; errors: string[] }>();
  const [revision, setRevision] = useState(0);
  const [activeTab, setActiveTab] = useState("customer");
  const [destination, setDestination] = useState<{ id: string } | null>(null);
  useEffect(() => {
    if (!destination) return;
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(destination.id) ?? document.getElementById("tracking-tabs");
      element?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab, destination]);
  const followOverviewLink = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!anchor) return;
    const id = anchor.getAttribute("href")?.slice(1);
    if (!id) return;
    event.preventDefault();
    setActiveTab(id.startsWith("quote-") || id === "quotes" ? "quotes" : id.startsWith("contract-") || id === "contracts" ? "contracts" : "customer");
    setDestination({ id });
  };
  useEffect(() => {
    let active = true;
    api<{ potential: PotentialRecord | null; quotes: RfqQuoteRecord[]; contracts: ContractRecord[] }>(
      crmPath(`/api/crm/potentials/${encodeURIComponent(potentialId)}/tracking`, lane),
    )
      .then((body) => {
        if (active) setData({ potential: body.potential ?? undefined, quotes: body.quotes, contracts: body.contracts, errors: [] });
      })
      .catch((err: unknown) => {
        if (active) setData({ quotes: [], contracts: [], errors: [err instanceof ApiError ? err.message : "Không tải được hồ sơ theo dõi."] });
      });
    return () => { active = false; };
  }, [potentialId, lane, revision]);

  if (!data) return <p role="status">Đang tải hồ sơ liên quan…</p>;
  const { potential: p, quotes, contracts, errors } = data;
  const sheets = quotes.flatMap((q) => q.logisticsSheet && q.desk !== "logistics" ? [q, { ...q, ...q.logisticsSheet, id: q.logisticsQuoteId ?? `${q.id}-logistics`, desk: "logistics" as const }] : [q]);
  if (!p && !quotes.length && !errors.length) return <div className="space-y-4 rounded-xl border p-6"><h1 className="text-xl font-semibold">Không tìm thấy hồ sơ</h1><p>Hồ sơ không tồn tại hoặc không thuộc phạm vi truy cập của bạn.</p><Link href="/crm/rfq" className="text-primary hover:underline">Về danh sách báo giá</Link></div>;
  return <div className="space-y-5">
    <Link href={lane === "vn" ? "/sale-viet-nam/rfq" : "/sale-global/rfq"} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Danh sách RFQ / Báo giá</Link>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5 shadow-xs">
      <div><p className="mb-1 text-sm text-muted-foreground">Theo dõi báo giá · {lane === "vn" ? "Việt Nam" : "Global"}</p><h1 className="font-mono text-2xl font-semibold text-primary">{p?.leadCode || quotes[0]?.leadCode || "Hồ sơ khách hàng"}</h1><p className="mt-1 font-medium">{p?.fullName || quotes[0]?.customerName}</p><p className="mt-2 text-sm text-muted-foreground">{p ? labelOf(potentialOptions, p.potential) : "Chưa tải được khách hàng"}</p></div>
      <Button type="button" variant="outline" size="icon" aria-label="Làm mới hồ sơ" title="Làm mới" onClick={() => { setData(undefined); setRevision((value) => value + 1); }}><RefreshCw aria-hidden className="size-4" /></Button>
    </div>
    {errors.map((error) => <InlineAlert key={error}>{error}</InlineAlert>)}
    {errors.length === 0 && <div onClick={followOverviewLink}><TrackingOverview potential={p} quotes={sheets} contracts={contracts} /></div>}
    <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value); setDestination(null); }}>
      <TabsList id="tracking-tabs" className="grid h-auto min-h-12 w-full scroll-mt-6 grid-cols-3 items-stretch gap-1">
        <TabsTrigger value="customer" className="h-auto min-h-10 whitespace-normal px-2 py-2 text-center leading-tight">Khách hàng & yêu cầu</TabsTrigger>
        <TabsTrigger value="quotes" className="h-auto min-h-10 whitespace-normal px-2 py-2 text-center leading-tight">Chi tiết báo giá</TabsTrigger>
        <TabsTrigger value="contracts" className="h-auto min-h-10 whitespace-normal px-2 py-2 text-center leading-tight">Hợp đồng & thanh toán</TabsTrigger>
      </TabsList>
      <TabsContent id="customer" value="customer" className="mt-4 scroll-mt-6">
    <SectionCard title="Khách hàng tiềm năng và yêu cầu ban đầu">
      {p ? <div className="space-y-5"><Details rows={[["Mã khách tiềm năng", p.leadCode], ["Mess nguồn", p.messCode], ["Công ty", p.companyName], ["Điện thoại", p.phone], ["Email", p.email], ["Địa chỉ", p.address], ["Hàng hóa", p.productInterest], ["Số lượng", p.quantityNote], ["Yêu cầu của khách", p.requirements], ["Ghi chú sale", p.saleNote], ["Lý do chuyển", p.convertReason], ["Quy cách đóng gói", p.packSpec], ["Trọng lượng (kg)", p.weightKg == null ? null : String(p.weightKg)], ["Địa chỉ gửi", p.shipFromAddress], ["Địa chỉ nhận", p.shipToAddress]]} /><RequirementImageSlider images={p.requirementImages ?? []} /></div> : <p className="text-sm text-muted-foreground">Không tìm thấy hồ sơ khách tiềm năng trong phạm vi truy cập.</p>}
    </SectionCard>
      </TabsContent>
      <TabsContent id="quotes" value="quotes" className="mt-4 scroll-mt-6">
    <SectionCard title="Chi tiết báo giá" description="Chỉ hiển thị bản báo giá đã gửi cho Sale.">
      {!sheets.length && <p className="text-sm text-muted-foreground">Chưa có báo giá để hiển thị.</p>}
      <div className="space-y-6">{sheets.map((q) => <section id={`quote-${q.id}`} key={`${q.desk}-${q.id}`} className="scroll-mt-6 space-y-3 rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{q.code} · {deskLabel(q.desk)}</h3><QuoteStatusBadge value={q.quoteStatus} /></div>
        <Details rows={[["Ngày tạo", new Date(q.createdAt).toLocaleDateString("vi-VN")], ["Ghi chú vận hành", q.opsNote]]} />
        {q.sentQuote && <details open><summary className="cursor-pointer py-2 font-medium">Báo giá đã gửi</summary><QuoteSheetPreview title={`${q.code} đã gửi`} html={quoteSheetHtml({ customer: q, lines: q.sentQuote.order.lines, currency: q.sentQuote.order.currency, rate: q.sentQuote.order.rate, notes: q.sentQuote.notes, bank: q.sentQuote.bank, code: q.code, orderName: q.sentQuote.order.name, compact: true })} /></details>}
        {!q.sentQuote && <p className="text-sm text-muted-foreground">Chưa có bản báo giá đã gửi cho Sale.</p>}
      </section>)}</div>
    </SectionCard>
      </TabsContent>
      <TabsContent id="contracts" value="contracts" className="mt-4 scroll-mt-6">
    <SectionCard title="Hợp đồng sau báo giá và thanh toán">
      {!contracts.length && <p className="text-sm text-muted-foreground">Chưa có hợp đồng liên kết để hiển thị.</p>}
      <div className="space-y-5">{contracts.map((c) => <section id={`contract-${c.id}`} key={c.id} className="scroll-mt-6 space-y-4 rounded-lg border p-4"><h3 className="font-mono text-lg font-semibold text-primary">{c.code}</h3>
        <Details rows={[["Báo giá nguồn", c.quoteCode], ["Sale phụ trách", c.saleName], ["Ngày ký", c.signedOn], ["Hàng hóa", c.product], ["Số lượng", c.quantity == null ? null : String(c.quantity)], ["Địa chỉ nhận", c.shipTo], ["Giá trị hàng", formatMoney(c.productValue, c.currency)], ["Phí vận chuyển", formatMoney(c.shippingCost, c.currency)], ["Tổng hợp đồng", formatMoney(c.totalValue, c.currency)], ["Đã thanh toán", formatMoney(c.paidAmount, c.currency)], ["Còn lại", formatMoney(c.balance, c.currency)], ["Kế toán xác nhận", c.confirmedAmount == null ? "Chưa xác nhận" : formatMoney(c.confirmedAmount, c.currency)], ["Tracking", c.tracking], ["Về kho Trung Quốc", c.chinaWarehouseOn], ["Đóng container", c.containerOn], ["Ngày đến", c.arrivalOn], ["Ngày giao", c.deliveryOn], ["Ghi chú", [c.note1, c.note2].filter(Boolean).join("\n")]]} />
        <Details rows={[["Trạng thái vận hành", c.opsStatus], ["Trạng thái kế toán", accountingLabel(c.accountingStatus)], ["Gửi kế toán lúc", c.sentToAccountingAt], ["Gửi vận hành lúc", c.sentToOpsAt], ["Xác nhận lại lúc", c.confirmedBackAt]]} />
        {(c.payments ?? []).map((payment, i) => <div key={i} className="space-y-2 border-t pt-3"><p className="text-sm font-medium">Thanh toán {i + 1} · {formatMoney(payment.amount, c.currency)} · {payment.paidOn || "Chưa ghi ngày"}</p><p className="whitespace-pre-wrap text-sm">{payment.note}</p><RequirementImageSlider images={payment.images ?? []} /></div>)}
        {(c.confirmations ?? []).map((confirmation, i) => <div key={i} className="space-y-2 border-t pt-3"><p className="text-sm font-medium">Đối soát {i + 1} · {formatMoney(confirmation.amount, c.currency)}</p><p className="whitespace-pre-wrap text-sm">{confirmation.note}</p><RequirementImageSlider images={confirmation.images ?? []} /></div>)}
      </section>)}</div>
    </SectionCard>
      </TabsContent>
    </Tabs>
  </div>;
}
