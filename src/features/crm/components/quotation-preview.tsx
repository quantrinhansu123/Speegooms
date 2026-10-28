import Image from "next/image";
import { originLabels, transportLabels } from "@/config/crm";
import { formatDate, formatMoney } from "@/lib/format";
import { quoteTotals } from "@/services/crm/rules";
import type { Customer, Quotation, QuoteLine, Rfq } from "@/types/crm";

function Section({ index, title, lines, currency }: { index: string; title: string; lines: QuoteLine[]; currency: Quotation["currency"] }) {
  if (lines.length === 0) return null;
  return (
    <>
      <tr className="bg-muted/70">
        <td colSpan={4} className="px-3 py-1.5 text-xs font-semibold tracking-wide text-primary uppercase">
          {index}. {title}
        </td>
      </tr>
      {lines.map((l) => (
        <tr key={l.id} className="border-b">
          <td className="px-3 py-2">{l.label || "—"}</td>
          <td className="tabular px-3 py-2 text-right">{l.quantity.toLocaleString("vi-VN")}</td>
          <td className="tabular px-3 py-2 text-right">{formatMoney(l.unitPrice, currency)}</td>
          <td className="tabular px-3 py-2 text-right font-medium">{formatMoney(l.quantity * l.unitPrice, currency)}</td>
        </tr>
      ))}
    </>
  );
}

/** Bản xem trước báo giá gửi khách. Không hiển thị giá vốn/biên lợi nhuận nội bộ. */
export function QuotationPreview({ quote, customer, rfq, ownerName }: { quote: Quotation; customer?: Customer; rfq?: Rfq; ownerName: string }) {
  const t = quoteTotals(quote);
  const watermark = quote.status === "nhap" ? "Bản nháp" : quote.status === "cho-duyet" ? "Chờ duyệt" : null;
  return (
    <article aria-label={`Xem trước báo giá ${quote.quoteId}`} className="relative overflow-hidden rounded-lg border bg-white p-6 text-sm shadow-md sm:p-8">
      {watermark && (
        <span className="absolute top-4 right-4 rounded border border-warning px-2 py-0.5 text-xs font-semibold tracking-wide text-warning uppercase">{watermark}</span>
      )}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-brand-navy pb-4">
        <Image src="/logo.png" alt="SpeeGo Logistics" width={150} height={45} className="h-10 w-auto" />
        <div className="text-right">
          <h2 className="text-xl font-bold tracking-wide text-primary uppercase">Báo giá</h2>
          <p className="font-mono text-xs text-muted-foreground">{quote.quoteId}</p>
        </div>
      </header>

      <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Kính gửi</dt>
          <dd className="font-medium">{customer?.name ?? quote.customerId}</dd>
          {customer && <dd className="text-xs text-muted-foreground">{customer.contactName} · {customer.phone}</dd>}
        </div>
        <div className="sm:text-right">
          <dt className="text-xs text-muted-foreground">Ngày lập / Hiệu lực đến</dt>
          <dd className="tabular">
            {formatDate(quote.createdAt)} / {formatDate(quote.validUntil)}
          </dd>
        </div>
        {rfq && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Yêu cầu</dt>
            <dd>
              {rfq.goodsName} · {rfq.quantity.toLocaleString("vi-VN")} {rfq.unit} · {originLabels[rfq.goodsOrigin]} · {rfq.originPoint} → {rfq.destination} · {transportLabels[rfq.transportMode]}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse">
          <thead>
            <tr className="border-b-2 text-xs text-muted-foreground uppercase">
              <th className="px-3 py-2 text-left font-medium">Mô tả</th>
              <th className="px-3 py-2 text-right font-medium">SL</th>
              <th className="px-3 py-2 text-right font-medium">Đơn giá</th>
              <th className="px-3 py-2 text-right font-medium">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            <Section index="I" title="Tiền hàng" lines={quote.goods} currency={quote.currency} />
            <Section index="II" title="Cước vận chuyển" lines={quote.freight} currency={quote.currency} />
            <Section index="III" title="Phụ phí" lines={quote.surcharges} currency={quote.currency} />
          </tbody>
        </table>
      </div>

      <dl className="mt-4 ml-auto w-full max-w-xs space-y-1.5">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Tạm tính</dt>
          <dd className="tabular">{formatMoney(t.subtotal, quote.currency)}</dd>
        </div>
        {quote.discountPercent > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Giảm giá ({quote.discountPercent}%)</dt>
            <dd className="tabular">−{formatMoney(t.discount, quote.currency)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t-2 border-brand-navy pt-2 text-base font-bold text-primary">
          <dt>Tổng cộng</dt>
          <dd className="tabular">{formatMoney(t.total, quote.currency)}</dd>
        </div>
      </dl>

      <footer className="mt-6 grid gap-4 border-t pt-4 sm:grid-cols-2">
        <p className="text-xs text-muted-foreground">{quote.termsNote}</p>
        <div className="text-center text-xs">
          <p className="text-muted-foreground">Đại diện SpeeGo Logistics</p>
          <div className="h-12" />
          <p className="font-medium">{ownerName}</p>
        </div>
      </footer>
    </article>
  );
}
