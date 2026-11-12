"use client";
import { activeLogisticsFees, quoteCurrencies, quoteMoneyValue, resolvedFreightCurrency, type QuoteNotes, type QuoteOrder } from "@speego/shared";
import { NativeSelect } from "@/components/shared/form-fields";
import { MoneyInput } from "@/components/shared/money-input";
import { formatMoneyGrouped } from "@/lib/format";
import { orderPackageMetrics } from "@/services/crm/quote-lines";
import { TableHScroll } from "./table-h-scroll";
type Fee = QuoteNotes["logisticsFees"][number];
type Details = NonNullable<Fee["originalDetails"]>;
export function FreightPricingTable({ notes, order, shippingMode, original = false, disabled, onChange }: {
  notes: QuoteNotes; order?: QuoteOrder; shippingMode: "AIR" | "SEA" | null;
  original?: boolean; disabled: boolean; onChange: (notes: QuoteNotes) => void;
}) {
  const currency = resolvedFreightCurrency(notes, order?.currency || "VND");
  const metrics = orderPackageMetrics(order?.lines ?? [], shippingMode);
  const itemMode = notes.freight.basis === "item";
  const itemRows = (order?.lines ?? []).map((line, index) => {
    const stt = line.stt.trim() || String(index + 1);
    return { key: stt, label: stt + ". " + (line.productName || line.spec || "Mặt hàng"), fee: notes.logisticsFees.find(row => row.itemStt === stt), quantity: orderPackageMetrics([line], shippingMode).chargeableKg || null, unit: "kg" };
  });
  const rows = itemMode ? itemRows : [];
  if (original && !itemMode) rows.push({ key: "freight", label: "Cước vận chuyển", fee: undefined,
    quantity: notes.freight.basis === "cbm" ? metrics.cbm || null : notes.freight.basis === "lump" ? 1 : metrics.chargeableKg || null,
    unit: notes.freight.basis === "cbm" ? "CBM" : notes.freight.basis === "lump" ? "gói" : "kg" });
  if (original) activeLogisticsFees(notes).filter(fee => !itemMode || !itemRows.some(row => row.key === fee.itemStt)).forEach((fee, index) => rows.push({ key: "fee-" + index, label: fee.label, fee, quantity: fee.weightKg ?? 1, unit: fee.itemStt ? "kg" : "gói" }));
  return <TableHScroll><table className="w-full min-w-[1000px] text-sm">
    <thead><tr className="border-b text-left">{["Mặt hàng / Chi phí", "Loại tiền cước", "Tỷ giá VND", "Đơn giá cước", "Cân nặng / lượng tính cước", "Tổng tiền cước", ...(original ? ["Lợi nhuận (VND)"] : [])].map(label => <th key={label} className="px-3 py-2">{label}</th>)}</tr></thead>
    <tbody>{rows.map(row => {
      const freightRow = row.key === "freight";
      const source = freightRow ? notes.freight : row.fee;
      const details = source?.originalDetails;
      const code = (original ? details?.currency : row.fee?.currency) || currency;
      const ownFx = original ? details?.vndRate : row.fee?.vndRate;
      const fx = code === "VND" ? 1 : ownFx !== undefined ? ownFx : code === currency ? notes.freight.vndRate ?? null : null;
      const rate = original ? details?.rate ?? null : row.fee?.rate ?? null;
      const quantity = original ? details?.quantity ?? row.quantity : row.fee?.weightKg ?? row.quantity;
      const amount = original ? source?.originalPrice ?? null : quoteMoneyValue(row.fee?.value || "");
      const saleAmount = freightRow ? notes.freight.total : quoteMoneyValue(row.fee?.value || "");
      const saleCode = row.fee?.currency || currency;
      const saleFx = saleCode === "VND" ? 1 : row.fee?.vndRate !== undefined ? row.fee.vndRate : saleCode === currency ? notes.freight.vndRate : null;
      const profit = amount == null || saleAmount == null || !saleFx || !fx ? null : Math.round(saleAmount * saleFx - amount * fx);
      const write = (patch: Partial<Details> & { total?: number | null }) => {
        const next = { currency: code, vndRate: fx, rate, quantity, ...patch };
        const total = "total" in patch ? patch.total ?? null : "rate" in patch || "quantity" in patch ? next.rate == null || next.quantity == null ? null : Math.round(next.rate * next.quantity * 1000) / 1000 : amount;
        if (original && freightRow) { onChange({ ...notes, freight: { ...notes.freight, originalDetails: next, originalPrice: total } }); return; }
        const fee: Fee = row.fee ?? { label: ("Mặt hàng " + row.label).slice(0, 120), labelEn: "", itemStt: row.key, value: "", currency: "" };
        const updated: Fee = original ? { ...fee, originalDetails: next, originalPrice: total }
          : { ...fee, currency: next.currency, vndRate: next.vndRate, rate: next.rate, weightKg: next.quantity, value: total == null ? "" : String(total).replace(".", ",") };
        if (!row.fee && notes.logisticsFees.length >= 30) return;
        onChange({ ...notes, logisticsFees: row.fee ? notes.logisticsFees.map(fee => fee === row.fee ? updated : fee) : [...notes.logisticsFees, updated] });
      };
      const locked = disabled || (!row.fee && !freightRow && notes.logisticsFees.length >= 30);
      return <tr key={row.key} className="border-b align-middle last:border-0">
        <td className="px-3 py-2">{row.label}</td>
        <td className="px-3 py-2"><NativeSelect aria-label={"Loại tiền · " + row.label} value={code} disabled={locked} onChange={event => write({ currency: event.target.value, vndRate: event.target.value === "VND" ? 1 : null })}>{[...new Set([...quoteCurrencies, code])].map(code => <option key={code}>{code}</option>)}</NativeSelect></td>
        <td className="px-3 py-2"><MoneyInput className="min-w-28" aria-label={"Tỷ giá · " + row.label} value={fx} fractionDigits={4} disabled={locked || code === "VND"} onValueChange={vndRate => write({ vndRate })} /></td>
        <td className="px-3 py-2"><MoneyInput className="min-w-28" aria-label={"Đơn giá cước · " + row.label} value={rate} fractionDigits={3} disabled={locked} onValueChange={rate => write({ rate })} /></td>
        <td className="px-3 py-2"><div className="flex items-center gap-2"><MoneyInput className="min-w-28" aria-label={"Lượng tính cước · " + row.label} value={quantity} fractionDigits={3} disabled={locked} onValueChange={quantity => write({ quantity })} /><span className="shrink-0 text-muted-foreground">{row.unit}</span></div></td>
        <td className="px-3 py-2"><MoneyInput className="min-w-32" aria-label={"Tổng tiền cước · " + row.label} value={amount} fractionDigits={3} disabled={locked} onValueChange={total => write({ total })} /></td>
        {original && <td className="px-3 py-2 tabular-nums">{profit == null ? "Chưa đủ dữ liệu" : formatMoneyGrouped(profit)}</td>}
      </tr>;
    })}{rows.length === 0 && <tr><td colSpan={original ? 7 : 6} className="p-3">Chưa có mặt hàng.</td></tr>}</tbody>
  </table></TableHScroll>;
}
