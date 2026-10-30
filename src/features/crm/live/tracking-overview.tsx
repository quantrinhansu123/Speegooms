import { ArrowDown, ArrowRight, Check, Circle, Clock } from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ContractRecord } from "./contracts-live-view";
import { deskLabel, labelOf, quoteStatusOptions, type PotentialRecord, type RfqQuoteRecord } from "./types";

const accountingLabels: Record<string, string> = {
  DA_HOAN_THANH_COC: "Đã hoàn thành cọc",
  DA_HOAN_THANH_THANH_TOAN: "Đã hoàn thành thanh toán",
  CHUA_HOAN_THANH_COC: "Chưa hoàn thành cọc",
  CHUA_HOAN_THANH_THANH_TOAN: "Chưa hoàn thành thanh toán",
};
export const accountingLabel = (value: string | null) => value ? accountingLabels[value] ?? value : "Chưa cập nhật";

type Step = { label: string; owner: string; note: string; state: "done" | "current" | "waiting"; href: string };

function Flow({ steps }: { steps: Step[] }) {
  return <ol className="grid gap-7 md:grid-cols-5">{steps.map((step, i) => <li key={step.label} className="relative min-w-0">
    <a href={step.href} aria-current={step.state === "current" ? "step" : undefined} className={cn("block h-full rounded-lg border p-3 text-sm transition-shadow hover:shadow-sm", step.state === "done" ? "border-success/40 bg-success-soft" : step.state === "current" ? "border-primary bg-accent" : "border-dashed bg-muted/40 text-muted-foreground")}>
      <p className="mb-2 text-xs">{step.owner}</p>
      <p className="flex items-start gap-2 font-semibold">{step.state === "done" ? <Check aria-hidden className="size-4 shrink-0 text-success" /> : step.state === "current" ? <Circle aria-hidden className="size-4 shrink-0 text-primary" /> : <Clock aria-hidden className="size-4 shrink-0" />}{i + 1}. {step.label}</p>
      <p className="mt-2 text-xs leading-relaxed">{step.note}</p>
      <span className="sr-only">{step.state === "done" ? "Đã có dữ liệu hoàn thành" : step.state === "current" ? "Cần theo dõi" : "Chờ xử lý"}</span>
    </a>
    {i < steps.length - 1 && <><ArrowRight aria-hidden className="absolute top-1/2 -right-6 hidden size-5 text-muted-foreground md:block" /><ArrowDown aria-hidden className="absolute -bottom-6 left-1/2 size-5 text-muted-foreground md:hidden" /></>}
  </li>)}</ol>;
}

export function TrackingOverview({ potential, quotes, contracts }: { potential?: PotentialRecord; quotes: RfqQuoteRecord[]; contracts: ContractRecord[] }) {
  const totals = new Map<ContractRecord["currency"], { value: number; paid: number; balance: number }>();
  for (const c of contracts) {
    if (c.opsStatus === "Hủy đơn") continue;
    const total = totals.get(c.currency) ?? { value: 0, paid: 0, balance: 0 };
    totals.set(c.currency, { value: total.value + c.totalValue, paid: total.paid + c.paidAmount, balance: total.balance + c.balance });
  }
  const events: { date: string; title: string; note: string; href: string }[] = [];
  if (potential) events.push({ date: potential.createdAt, title: "Tạo khách hàng tiềm năng", note: potential.leadCode, href: "#customer" });
  for (const q of quotes) {
    // Linked Logistics sheets do not expose their own creation timestamp.
    if (!quotes.some((other) => other.logisticsQuoteId === q.id)) events.push({ date: q.createdAt, title: "Tạo yêu cầu báo giá", note: q.code, href: `#quote-${q.id}` });
    if (q.sentQuote) events.push({ date: q.sentQuote.sentAt, title: `Gửi báo giá ${deskLabel(q.desk)} cho Sale`, note: q.code, href: `#quote-${q.id}` });
  }
  for (const c of contracts) {
    for (const [date, title] of [[c.createdAt, "Tạo hợp đồng"], [c.signedOn, "Ký hợp đồng"], [c.sentToAccountingAt, "Gửi kế toán"], [c.confirmedBackAt, "Kế toán xác nhận lại"], [c.sentToOpsAt, "Gửi vận hành"], [c.chinaWarehouseOn, "Về kho Trung Quốc"], [c.containerOn, "Đóng container"], [c.arrivalOn, "Hàng đến"], [c.deliveryOn, "Giao hàng"]]) {
      if (date) events.push({ date, title: title!, note: c.code, href: `#contract-${c.id}` });
    }
  }
  events.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  return <>
    <SectionCard title="Sơ đồ liên kết hồ sơ" description="Bấm vào mã để đến đúng phần chi tiết trên trang.">
      <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_2fr_auto_1fr]">
        <a href="#customer" className="rounded-lg border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">Mess → Khách tiềm năng</p><p className="mt-1 font-mono text-sm">{potential?.messCode || "Chưa có Mess"}</p><p className="mt-1 font-semibold text-primary">{potential?.leadCode || quotes[0]?.leadCode}</p></a>
        <ArrowRight aria-hidden className="hidden size-5 text-primary lg:block" /><ArrowDown aria-hidden className="mx-auto size-5 lg:hidden" />
        <div className="grid gap-3 sm:grid-cols-2">{quotes.length ? quotes.map((q) => <a key={q.id} href={`#quote-${q.id}`} className="rounded-lg border border-primary/30 bg-accent/40 p-4"><p className="text-xs text-muted-foreground">{deskLabel(q.desk)}</p><p className="mt-1 break-all font-mono font-semibold text-primary">{q.code}</p><p className="mt-2 text-xs">{labelOf(quoteStatusOptions, q.quoteStatus)}</p></a>) : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Chưa tạo yêu cầu báo giá</p>}</div>
        <ArrowRight aria-hidden className="hidden size-5 text-primary lg:block" /><ArrowDown aria-hidden className="mx-auto size-5 lg:hidden" />
        <div className="space-y-3">{contracts.length ? contracts.map((c) => <a key={c.id} href={`#contract-${c.id}`} className="block rounded-lg border bg-muted/30 p-4"><p className="font-mono font-semibold text-primary">{c.code}</p><p className="mt-1 text-xs text-muted-foreground">Từ {c.quoteCode}</p><p className="mt-1 text-sm">{c.opsStatus || "Chưa cập nhật"}</p></a>) : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Chưa tạo hợp đồng</p>}</div>
      </div>
    </SectionCard>

    <SectionCard title="Luồng xử lý báo giá" description="Theo dõi riêng từng bàn. Xanh: đã có kết quả · Viền đậm: cần theo dõi · Nét đứt: đang chờ.">
      <div className="space-y-6">{quotes.length ? quotes.map((q) => {
        const sent = ["DA_CO_BAO_GIA", "DA_CO_BAO_GIA_LAI"].includes(q.quoteStatus);
        const returned = q.quoteStatus === "CHUA_CO_BAO_GIA_LAI";
        const linked = contracts.filter((c) => c.quoteId === q.id);
        return <div key={q.id}><h3 className="mb-3 font-semibold">{deskLabel(q.desk)} · {q.code}</h3><Flow steps={[
          { label: "Tiếp nhận nhu cầu", owner: "Sale", state: "done", note: potential?.leadCode || q.leadCode, href: "#customer" },
          { label: "Lập báo giá", owner: deskLabel(q.desk), state: sent ? "done" : "current", note: returned ? "Sale yêu cầu báo giá lại" : sent ? "Đã có báo giá" : "Đang chờ nội dung và giá", href: `#quote-${q.id}` },
          { label: "Gửi cho Sale", owner: "Vận hành → Sale", state: sent ? "done" : "waiting", note: sent ? "Bản gửi nằm trong chi tiết bên dưới" : returned ? "Chờ gửi bản báo giá lại" : "Chờ hoàn thiện báo giá", href: `#quote-${q.id}` },
          { label: "Chốt với khách", owner: "Sale", state: linked.length ? "done" : sent ? "current" : "waiting", note: linked.length ? "Đã phát sinh hợp đồng" : "Theo dõi phản hồi và điều chỉnh nhu cầu", href: `#quote-${q.id}` },
          { label: "Lập hợp đồng", owner: "Sale", state: linked.length ? "done" : "waiting", note: linked.length ? linked.map((c) => c.code).join(", ") : "Chưa có hợp đồng liên kết", href: "#contracts" },
        ]} /></div>;
      }) : <p className="text-sm">Bước tiếp theo: Sale xác nhận nhu cầu và tạo yêu cầu báo giá từ hồ sơ khách tiềm năng.</p>}</div>
    </SectionCard>

    <div className="grid items-start gap-5 lg:grid-cols-3">
      <SectionCard title="Tổng quan tài chính" description="Hợp đồng đang hoạt động; tách theo loại tiền.">
        {!totals.size && <p className="text-sm text-muted-foreground">Chưa có hợp đồng đang hoạt động.</p>}
        {[...totals].map(([currency, total]) => <dl key={currency} className="mb-4 space-y-3 border-b pb-4 text-sm last:mb-0 last:border-0 last:pb-0">{[["Giá trị hợp đồng", total.value], ["Sale ghi nhận đã trả", total.paid], ["Còn lại", total.balance]].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-semibold text-primary">{formatMoney(Number(value), currency)}</dd></div>)}</dl>)}
      </SectionCard>
      <SectionCard title="Hợp đồng → Kế toán → Vận hành" description="Trạng thái từng hợp đồng được theo dõi độc lập." className="lg:col-span-2">
        {!contracts.length && <p className="text-sm text-muted-foreground">Luồng sau báo giá xuất hiện khi có hợp đồng liên kết.</p>}
        <div className="space-y-5">{contracts.map((c) => {
          const confirmed = c.accountingStatus === "DA_HOAN_THANH_COC" || c.accountingStatus === "DA_HOAN_THANH_THANH_TOAN";
          return <div key={c.id}><h3 className="mb-3 font-semibold">{c.code} · {c.saleName || "Chưa ghi người phụ trách"}</h3>{c.opsStatus === "Hủy đơn" ? <p className="rounded-lg border bg-muted p-4 text-sm">Hợp đồng đã hủy.</p> : <Flow steps={[
            { label: "Ký hợp đồng", owner: "Sale", state: c.signedOn ? "done" : "current", note: c.signedOn || "Chưa ghi ngày ký", href: `#contract-${c.id}` },
            { label: "Gửi kế toán", owner: "Sale", state: c.sentToAccountingAt ? "done" : c.signedOn ? "current" : "waiting", note: c.sentToAccountingAt ? "Đã gửi đối soát" : "Chưa ghi nhận gửi", href: `#contract-${c.id}` },
            { label: "Xác nhận cọc", owner: "Kế toán", state: confirmed ? "done" : c.sentToAccountingAt ? "current" : "waiting", note: accountingLabel(c.accountingStatus), href: `#contract-${c.id}` },
            { label: "Bàn giao", owner: "Sale → Vận hành", state: c.sentToOpsAt ? "done" : confirmed ? "current" : "waiting", note: c.sentToOpsAt ? "Đã gửi vận hành" : "Chưa ghi nhận bàn giao", href: `#contract-${c.id}` },
            { label: "Thực hiện đơn", owner: "Vận hành", state: c.opsStatus === "Hoàn thành" ? "done" : c.sentToOpsAt ? "current" : "waiting", note: c.opsStatus || "Chưa cập nhật", href: `#contract-${c.id}` },
          ]} />}</div>;
        })}</div>
      </SectionCard>
    </div>

    <SectionCard title="Các mốc đã ghi nhận" description="Sắp xếp mới nhất trước; hiển thị các mốc hiện có trong hồ sơ.">
      <ol className="max-h-80 space-y-4 overflow-y-auto border-l-2 border-primary/20 pl-5">{events.map((event, i) => <li key={`${event.title}-${event.note}-${i}`} className="relative text-sm"><span aria-hidden className="absolute top-1 -left-[1.65rem] size-3 rounded-full border-2 border-background bg-primary" /><a href={event.href} className="font-medium hover:text-primary">{event.title} · {event.note}</a><p className="mt-1 text-xs text-muted-foreground">{new Date(event.date).toLocaleDateString("vi-VN")}</p></li>)}</ol>
    </SectionCard>
  </>;
}
