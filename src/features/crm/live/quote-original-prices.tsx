"use client";

import { useId } from "react";
import { canViewQuoteOriginalPrice, quoteCurrencies, resolvedFreightCurrency, withFreightCurrency, type QuoteDesk, type QuoteNotes, type QuoteOrder } from "@speego/shared";
import { Field, NativeSelect } from "@/components/shared/form-fields";
import { MoneyInput } from "@/components/shared/money-input";
import { useSession } from "@/features/auth/session-provider";
import { pricingBasisLabels } from "@/services/crm/quote-lines";
import { TableHScroll } from "./table-h-scroll";

export function QuoteOriginalPrices({ desk, orders, notes, editable, pending, onLinePrice, onNotesChange }: {
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
  const rows: { key: string; label: string; currency: string; unit: string; value: number | null | undefined; write: (value: number | null) => void }[] = [];
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
      unit: charge.unit || "đơn vị", value: charge.originalPrice,
      write: value => onNotesChange({ ...notes, fcl: { ...fcl, charges: fcl.charges.map((row, i) => i === index ? { ...row, originalPrice: value } : row) } }),
    }));
  } else {
    rows.push({ key: "freight", label: "Cước vận chuyển", currency, unit: "tổng cước", value: notes.freight.originalPrice,
      write: value => onNotesChange({ ...notes, freight: { ...notes.freight, originalPrice: value } }) });
    notes.logisticsFees.forEach((fee, index) => rows.push({
      key: `fee-${index}`, label: fee.label || `Phụ phí ${index + 1}`, currency: fee.currency || currency, unit: "tổng phí", value: fee.originalPrice,
      write: value => onNotesChange({ ...notes, logisticsFees: notes.logisticsFees.map((row, i) => i === index ? { ...row, originalPrice: value } : row) }),
    }));
  }
  return <section className="grid gap-3 rounded-xl border p-4" aria-label={`Giá gốc ${desk === "sourcing" ? "Sourcing" : "Logistics"}`}>
    <div><h3 className="font-semibold">Giá gốc nội bộ</h3><p className="text-sm text-muted-foreground">Chỉ dùng nội bộ, không hiển thị trên báo giá gửi khách.</p></div>
    {desk === "logistics" && <Field label="Loại tiền cước / giá gốc" htmlFor={currencyId} hint="Dùng chung cho cước và giá gốc. Đổi loại tiền giữ nguyên số đã nhập.">
      <NativeSelect id={currencyId} aria-label="Loại tiền cước / giá gốc" className="w-fit min-w-32" value={currency} disabled={!editable || pending} onChange={event => onNotesChange(withFreightCurrency(notes, order, event.target.value))}>
        {currencies.map(code => <option key={code} value={code}>{code}</option>)}
      </NativeSelect>
    </Field>}
    <TableHScroll className="rounded-lg"><table className="w-full text-sm">
      <thead><tr className="border-b bg-muted/50 text-left">
        <th className="px-3 py-2">Mặt hàng / Chi phí</th><th className="px-3 py-2">Giá gốc</th><th className="px-3 py-2">Loại tiền</th><th className="px-3 py-2">Cách tính</th>
      </tr></thead>
      <tbody>{rows.map(row => <tr key={row.key} className="border-b last:border-0">
        <td className="px-3 py-2">{row.label}</td>
        <td className="px-3 py-2"><MoneyInput className="min-w-32" aria-label={`Giá gốc · ${row.label}`} value={row.value ?? null} fractionDigits={3} disabled={!editable || pending} onValueChange={row.write} /></td>
        <td className="px-3 py-2">{row.currency}</td><td className="px-3 py-2">{row.unit}</td>
      </tr>)}{rows.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-muted-foreground">Chưa có dòng để nhập giá gốc.</td></tr>}</tbody>
    </table></TableHScroll>
  </section>;
}
