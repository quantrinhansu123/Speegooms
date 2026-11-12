"use client";

import { QuoteMarkupInput } from "./quote-markup-input";
import { FreightPricingTable } from "./freight-pricing-table";
import { useId } from "react";
import { canViewQuoteOriginalPrice, quoteCurrencies, resolvedFreightCurrency, withFreightCurrency, type QuoteDesk, type QuoteNotes, type QuoteOrder } from "@speego/shared";
import { Field, NativeSelect } from "@/components/shared/form-fields";
import { MoneyInput } from "@/components/shared/money-input";
import { useSession } from "@/features/auth/session-provider";
import { formatMoneyGrouped } from "@/lib/format";
import { pricingBasisLabels } from "@/services/crm/quote-lines";
import { TableHScroll } from "./table-h-scroll";

export function QuoteOriginalPrices({ desk, orders, notes, editable, pending, onLinePrice, onNotesChange, shippingMode = null }: {
  shippingMode?: "AIR" | "SEA" | null;
  desk: QuoteDesk;
  orders: QuoteOrder[];
  notes: QuoteNotes;
  editable: boolean;
  pending: boolean;
  onLinePrice: (orderId: string, lineIndex: number, value: number | null) => void;
  onNotesChange: (notes: QuoteNotes) => void;
}) {
  const user = useSession();
  const currencyId = useId();
  if (!canViewQuoteOriginalPrice(user.role)) return null;
  const order = orders.find(order => order.selected) ?? orders[0];
  const currency = notes.fcl ? notes.payment?.quoteCurrency ?? "USD" : resolvedFreightCurrency(notes, order?.currency ?? "VND");
  const currencies = quoteCurrencies.includes(currency as (typeof quoteCurrencies)[number]) ? quoteCurrencies : [...quoteCurrencies, currency];
  if (desk === "logistics" && !notes.fcl) return <section className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4" aria-label="Giá gốc Logistics">
    <div><h3 className="font-semibold">Giá gốc nội bộ</h3><p className="text-sm text-muted-foreground">Chỉ dùng nội bộ. Lợi nhuận = giá báo Sale − giá gốc, quy đổi VND. Nhập markup (%) rồi rời ô để tính giá báo Sale.</p></div>
    <FreightPricingTable notes={notes} order={order} shippingMode={shippingMode} original disabled={!editable || pending} onChange={onNotesChange} />
  </section>;
  const rows: { key: string; label: string; currency: string; unit: string; value: number | null | undefined; quantity?: number | null; vat?: number; sale?: number | null; writeSale?: (value: number) => boolean | void; write: (value: number | null) => void }[] = [];
  if (desk === "sourcing") {
    for (const order of orders) {
      order.lines.forEach((line, index) => rows.push({
        key: `${order.id}-${index}`, label: `${order.name} · ${line.stt || index + 1}. ${line.productName || line.spec || "Mặt hàng"}`,
        currency: order.currency, unit: pricingBasisLabels[line.basis], value: line.originalPrice,
        write: value => onLinePrice(order.id, index, value),
      }));
    }
  } else if (notes.fcl) {
    const fcl = notes.fcl;
    fcl.charges.forEach((charge, index) => rows.push({
      key: `fcl-${index}`, label: charge.name || `Phí FCL ${index + 1}`, currency: notes.payment?.quoteCurrency ?? "USD",
      unit: charge.unit || "đơn vị", value: charge.originalPrice, quantity: charge.quantity, vat: charge.vatAmount, sale: charge.rate,
      writeSale: total => {
        if (!charge.quantity || total < charge.vatAmount) return false;
        const rate = Math.round((total - charge.vatAmount) / charge.quantity * 1000) / 1000;
        onNotesChange({ ...notes, fcl: { ...fcl, charges: fcl.charges.map((row, i) => i === index ? { ...row, rate } : row) } });
      },
      write: value => onNotesChange({ ...notes, fcl: { ...fcl, charges: fcl.charges.map((row, i) => i === index ? { ...row, originalPrice: value } : row) } }),
    }));
  }

  return <section className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4" aria-label={`Giá gốc ${desk === "sourcing" ? "Sourcing" : "Logistics"}`}>
    <div><h3 className="font-semibold">Giá gốc nội bộ</h3><p className="text-sm text-muted-foreground">Chỉ dùng nội bộ, không hiển thị trên báo giá gửi khách.</p></div>
    {desk === "logistics" && <Field label="Loại tiền cước / giá gốc" htmlFor={currencyId} hint="Dùng chung cho cước và giá gốc. Đổi loại tiền giữ nguyên số đã nhập.">
      <NativeSelect id={currencyId} aria-label="Loại tiền cước / giá gốc" className="w-fit min-w-32" value={currency} disabled={!editable || pending} onChange={event => onNotesChange(withFreightCurrency(notes, order, event.target.value))}>
        {currencies.map(code => <option key={code} value={code}>{code}</option>)}
      </NativeSelect>
    </Field>}
    {desk === "logistics" && <Field label={"Tỷ giá VND / " + currency} htmlFor={currencyId + "-rate"}><MoneyInput id={currencyId + "-rate"} value={currency === "VND" ? 1 : notes.freight.vndRate ?? null} fractionDigits={4} disabled={!editable || pending || currency === "VND"} onValueChange={vndRate => onNotesChange({ ...notes, freight: { ...notes.freight, vndRate } })} /></Field>}
    <TableHScroll className="rounded-lg"><table className="w-full text-sm">
      <thead><tr className="border-b bg-muted/50 text-left">
        <th className="px-3 py-2">Mặt hàng / Chi phí</th><th className="px-3 py-2">Giá gốc</th><th className="px-3 py-2">Loại tiền</th><th className="px-3 py-2">Cách tính</th>{desk === "logistics" && ["Lượng tính cước", "Tổng giá gốc", "Markup (%)", "Lợi nhuận (VND)"].map(label => <th key={label} className="px-3 py-2">{label}</th>)}
      </tr></thead>
      <tbody>{rows.map(row => <tr key={row.key} className="border-b last:border-0">
        <td className="px-3 py-2">{row.label}</td>
        <td className="px-3 py-2"><MoneyInput className="min-w-32" aria-label={`Giá gốc · ${row.label}`} value={row.value ?? null} fractionDigits={3} disabled={!editable || pending} onValueChange={row.write} /></td>
        <td className="px-3 py-2">{row.currency}</td><td className="px-3 py-2">{row.unit}</td>
        {desk === "logistics" && <>
          <td className="px-3 py-2">{row.quantity ?? "—"}</td>
          <td className="px-3 py-2">{row.value == null || row.quantity == null ? "Chưa đủ dữ liệu" : formatMoneyGrouped(row.value * row.quantity + (row.vat ?? 0))}</td>
          <td className="px-3 py-2"><QuoteMarkupInput label={"Markup · " + row.label}
            cost={row.value == null || row.quantity == null ? null : row.value * row.quantity + (row.vat ?? 0)}
            revenue={row.sale == null || row.quantity == null ? null : row.sale * row.quantity + (row.vat ?? 0)}
            disabled={!editable || pending || !row.quantity} onAmount={amount => row.writeSale?.(amount)} /></td>
          <td className="px-3 py-2">{row.value == null || row.sale == null || row.quantity == null || (currency !== "VND" && !notes.freight.vndRate) ? "Chưa đủ dữ liệu" : formatMoneyGrouped(Math.round((row.sale - row.value) * row.quantity * (currency === "VND" ? 1 : notes.freight.vndRate!)))}</td>
        </>}
      </tr>)}{rows.length === 0 && <tr><td colSpan={desk === "logistics" ? 8 : 4} className="px-3 py-4 text-muted-foreground">Chưa có dòng để nhập giá gốc.</td></tr>}</tbody>
    </table></TableHScroll>
  </section>;
}
