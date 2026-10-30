import { ArrowText } from "@/components/shared/arrow-text";
import Image from "next/image";
import { originLabels, transportLabels } from "@/config/crm";
import { formatDate, formatMoney } from "@/lib/format";
import { quoteTotals } from "@/services/crm/rules";
import type { Customer, Quotation, QuoteLine, Rfq } from "@/types/crm";
import { companyFields, companyName } from "@/features/crm/live/quote-print";

function Section({ index, title, lines, currency }: { index: string; title: string; lines: QuoteLine[]; currency: Quotation["currency"] }) {
  if (lines.length === 0) return null;
  return (
    <>
      <tr className="bg-brand-navy/5">
        <td colSpan={4} className="border-l-4 border-brand-orange px-3 py-1.5 text-xs font-semibold tracking-wide text-brand-navy uppercase">
          {index}. {title}
        </td>
      </tr>
      {lines.map((l) => (
        <tr key={l.id} className="border-b border-[#c5d0de]">
          <td className="px-3 py-2 text-slate-800">{l.label || "—"}</td>
          <td className="tabular px-3 py-2 text-right text-brand-navy">{l.quantity.toLocaleString("vi-VN")}</td>
          <td className="tabular px-3 py-2 text-right text-brand-navy">{formatMoney(l.unitPrice, currency)}</td>
          <td className="tabular px-3 py-2 text-right font-semibold text-brand-orange">{formatMoney(l.quantity * l.unitPrice, currency)}</td>
        </tr>
      ))}
    </>
  );
}

/** Bản xem trước báo giá gửi khách — tông màu logo SpeeGo (navy/cam). */
export function QuotationPreview({ quote, customer, rfq, ownerName }: { quote: Quotation; customer?: Customer; rfq?: Rfq; ownerName: string }) {
  const t = quoteTotals(quote);
  const watermark = quote.status === "nhap" ? "Bản nháp" : quote.status === "cho-duyet" ? "Chờ duyệt" : null;
  return (
    <article
      aria-label={`Xem trước báo giá ${quote.quoteId}`}
      className="relative overflow-hidden rounded-lg border border-[#c5d0de] bg-white text-sm shadow-md"
      style={{ fontFamily: '"Times New Roman", Times, "Liberation Serif", serif' }}
    >
      {watermark && (
        <span className="absolute top-4 right-4 z-10 rounded border border-warning bg-white px-2 py-0.5 text-xs font-semibold tracking-wide text-warning uppercase">{watermark}</span>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4 border-b-[3px] border-brand-navy px-6 pt-6 pb-4 sm:px-8">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Image src="/logo.png" alt="SpeeGo Logistics" width={168} height={50} className="mt-0.5 h-12 w-auto shrink-0" />
          <div className="min-w-0 flex-1 border-l-2 border-brand-orange pl-3">
            <p className="mb-1 text-sm font-semibold tracking-wide text-brand-navy">{companyName}</p>
            <table className="w-full table-fixed text-[11px]">
              <colgroup>
                <col className="w-[118px]" />
                <col />
              </colgroup>
              <tbody>
                {companyFields.map(([label, value]) => (
                  <tr key={label}>
                    <th className="py-0.5 pr-2.5 text-left align-top font-bold text-brand-navy">{label}</th>
                    <td className="py-0.5 align-top text-slate-700">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="w-full max-w-xs rounded border border-[#c5d0de] bg-[#F6F8FC] p-3 sm:w-64">
          <p className="mb-2 text-xs font-bold tracking-wide text-brand-navy uppercase">Thông tin chứng từ</p>
          <table className="w-full text-[11px]">
            <tbody>
              <tr>
                <th className="w-[40%] py-0.5 pr-2 text-left font-bold text-brand-navy">Mã báo giá</th>
                <td className="py-0.5 text-slate-800">{quote.quoteId}</td>
              </tr>
              <tr>
                <th className="py-0.5 pr-2 text-left font-bold text-brand-navy">Ngày lập</th>
                <td className="py-0.5 text-slate-800">{formatDate(quote.createdAt)}</td>
              </tr>
              <tr>
                <th className="py-0.5 pr-2 text-left font-bold text-brand-navy">Hiệu lực</th>
                <td className="py-0.5 text-slate-800">{formatDate(quote.validUntil)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </header>
      <div aria-hidden className="h-1 bg-brand-orange" />
      <h2 className="py-3 text-center text-2xl font-bold tracking-[0.14em] text-brand-navy uppercase sm:text-3xl">
        Báo giá
      </h2>

      <div className="grid gap-3 px-6 pb-3 sm:grid-cols-2 sm:px-8">
        <section className="rounded border border-[#c5d0de] p-3">
          <h3 className="mb-2 border-b-2 border-brand-orange pb-1 text-xs font-bold tracking-wide text-brand-navy uppercase">Thông tin khách hàng</h3>
          <table className="w-full text-[12px]">
            <tbody>
              <tr>
                <th className="w-[34%] py-0.5 pr-2 text-left align-top font-bold text-brand-navy">Khách hàng</th>
                <td className="py-0.5 text-slate-800">{customer?.name ?? quote.customerId}</td>
              </tr>
              {customer?.contactName && (
                <tr>
                  <th className="py-0.5 pr-2 text-left font-bold text-brand-navy">Người liên hệ</th>
                  <td className="py-0.5 text-slate-800">{customer.contactName}</td>
                </tr>
              )}
              {customer?.phone && (
                <tr>
                  <th className="py-0.5 pr-2 text-left font-bold text-brand-navy">Điện thoại</th>
                  <td className="py-0.5 text-slate-800">{customer.phone}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
        <section className="rounded border border-[#c5d0de] p-3">
          <h3 className="mb-2 border-b-2 border-brand-orange pb-1 text-xs font-bold tracking-wide text-brand-navy uppercase">Thông tin báo giá</h3>
          <table className="w-full text-[12px]">
            <tbody>
              <tr>
                <th className="w-[40%] py-0.5 pr-2 text-left font-bold text-brand-navy">Ngày lập</th>
                <td className="py-0.5 text-slate-800">{formatDate(quote.createdAt)}</td>
              </tr>
              <tr>
                <th className="py-0.5 pr-2 text-left font-bold text-brand-navy">Hiệu lực đến</th>
                <td className="py-0.5 text-slate-800">{formatDate(quote.validUntil)}</td>
              </tr>
              <tr>
                <th className="py-0.5 pr-2 text-left font-bold text-brand-navy">Loại tiền</th>
                <td className="py-0.5 text-slate-800">{quote.currency}</td>
              </tr>
              {rfq && (
                <tr>
                  <th className="py-0.5 pr-2 text-left align-top font-bold text-brand-navy">Yêu cầu</th>
                  <td className="py-0.5 text-slate-700">
                    {rfq.goodsName} · {rfq.quantity.toLocaleString("vi-VN")} {rfq.unit} · {originLabels[rfq.goodsOrigin]} · {rfq.originPoint} <ArrowText>{"→"}</ArrowText> {rfq.destination} · {transportLabels[rfq.transportMode]}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      <div className="bg-brand-navy px-6 py-2 text-center text-xs font-bold tracking-[0.08em] text-white uppercase sm:px-8">
        Chi tiết đơn hàng
      </div>

      <div className="px-6 py-4 sm:px-8">

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse">
            <thead>
              <tr className="border-b-[3px] border-brand-orange bg-brand-navy text-xs text-white uppercase">
                <th className="px-3 py-2 text-left font-semibold">Mô tả</th>
                <th className="px-3 py-2 text-right font-semibold">SL</th>
                <th className="px-3 py-2 text-right font-semibold">Đơn giá</th>
                <th className="px-3 py-2 text-right font-semibold">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              <Section index="I" title="Tiền hàng" lines={quote.goods} currency={quote.currency} />
              <Section index="II" title="Cước vận chuyển" lines={quote.freight} currency={quote.currency} />
              <Section index="III" title="Phụ phí" lines={quote.surcharges} currency={quote.currency} />
            </tbody>
          </table>
        </div>

        <dl className="mt-4 ml-auto w-full max-w-xs space-y-1.5 rounded-md border border-[#c5d0de] border-l-4 border-l-brand-orange bg-[#F6F8FC] p-3">
          <div className="flex justify-between">
            <dt className="text-brand-navy">Tạm tính</dt>
            <dd className="tabular font-medium text-brand-navy">{formatMoney(t.subtotal, quote.currency)}</dd>
          </div>
          {quote.discountPercent > 0 && (
            <div className="flex justify-between">
              <dt className="text-slate-500">Giảm giá ({quote.discountPercent}%)</dt>
              <dd className="tabular text-slate-700">−{formatMoney(t.discount, quote.currency)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-[#c5d0de] pt-2 text-base font-bold">
            <dt className="text-brand-navy">Tổng cộng</dt>
            <dd className="tabular text-brand-orange">{formatMoney(t.total, quote.currency)}</dd>
          </div>
        </dl>
      </div>

      <footer className="mt-2 grid gap-4 border-t-2 border-brand-navy px-6 pt-4 pb-6 sm:grid-cols-2 sm:px-8">
        <p className="text-xs text-slate-500">{quote.termsNote}</p>
        <div className="text-center text-xs">
          <p className="font-semibold text-brand-navy">Đại diện SpeeGo Logistics</p>
          <p className="mt-0.5 font-medium text-brand-orange">(Ký, đóng dấu)</p>
          <div className="h-12" />
          <p className="font-medium text-brand-navy">{ownerName}</p>
        </div>
      </footer>
    </article>
  );
}
