"use client";

import { Plus, Trash2 } from "lucide-react";
import { fclChargeTotal, fclTotals, type FclQuote } from "@speego/shared";
import { Field } from "@/components/shared/form-fields";
import { MoneyInput } from "@/components/shared/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";

const chargeNames = [
  "Ocean Freight", "Local charge China port", "Trucking", "Lift on/off", "Factory inspection fee",
  "Customs Clearance", "AMS / ISF", "H/L + DOC", "Import Customs Clearance",
  "US import customs fee", "Trucking fee US",
];

export const emptyFclQuote = (customer: string, commodity: string, weight: string): FclQuote => ({
  to: customer, pol: "", pod: "", etd: "", weight, volume: "", commodity,
  stuffingDate: "", charges: chargeNames.map((name, index) => ({ name, rate: null, quantity: 1, unit: "cont", vatAmount: 0, note: "", optional: index === chargeNames.length - 1 })), notes: "",
});

export function FclQuoteForm({ value, onChange, shipmentEditable, chargesEditable, currency = "USD" }: {
  currency?: string;
  value: FclQuote;
  onChange: (value: FclQuote) => void;
  shipmentEditable: boolean;
  chargesEditable: boolean;
}) {
  const shipment = [
    ["to", "To"], ["pol", "POL · cảng đi"], ["pod", "POD · cảng đến / địa chỉ giao"],
    ["etd", "ETD · ngày tàu chạy"], ["weight", "Weight · trọng lượng"],
    ["volume", "Volume · số lượng, loại container"], ["commodity", "Commodity · hàng hóa"],
    ["stuffingDate", "Ngày đóng hàng"],
  ] as const;
  const totals = fclTotals(value.charges);
  return <section className="grid gap-4 rounded-xl border p-4">
    <div>
      <h3 className="font-semibold">Logistics FCL · Door to Door</h3>
      <p className="text-sm text-muted-foreground">Thông tin lô hàng và bảng chi phí theo mẫu FCL.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      {shipment.map(([key, label]) => <Field key={key} label={label} htmlFor={`fcl-${key}`}>
        <Input id={`fcl-${key}`} value={value[key]} disabled={!shipmentEditable} onChange={(event) => onChange({ ...value, [key]: event.target.value })} />
      </Field>)}
    </div>
    <div className="flex items-center justify-between gap-2">
      <h4 className="font-medium">Bảng chi phí ({currency})</h4>
      {chargesEditable && <Button type="button" variant="outline" size="sm" disabled={value.charges.length >= 30} onClick={() => onChange({ ...value, charges: [...value.charges, { name: "", rate: null, quantity: 1, unit: value.volume || "cont", vatAmount: 0, note: "", optional: false }] })}><Plus />Thêm phí</Button>}
    </div>
    <div className="overflow-x-auto">
      <Table className="w-full min-w-[900px] text-sm">
        <thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">STT</th><th className="p-2">Tên chi phí</th><th className="p-2">Đơn giá</th><th className="p-2">Số lượng</th><th className="p-2">Đơn vị</th><th className="p-2">VAT 8% (số tiền {currency})</th><th className="p-2">Thành tiền</th><th className="p-2">Ghi chú</th><th className="p-2">Phí tùy chọn</th><th className="p-2" /></tr></thead>
        <tbody>{value.charges.map((row, index) => {
          const patch = (next: Partial<typeof row>) => onChange({ ...value, charges: value.charges.map((item, i) => i === index ? { ...item, ...next } : item) });
          return <tr key={index} className="border-b align-top">
            <td className="p-2">{index + 1}</td>
            <td className="p-2"><Input aria-label={`Tên phí ${index + 1}`} value={row.name} disabled={!chargesEditable} onChange={(event) => patch({ name: event.target.value })} /></td>
            <td className="p-2"><MoneyInput aria-label={`Đơn giá phí ${index + 1}`} value={row.rate} disabled={!chargesEditable} onValueChange={(rate) => patch({ rate })} /></td>
            <td className="p-2"><Input aria-label={`Số lượng phí ${index + 1}`} type="number" min={0} step="any" value={row.quantity ?? ""} disabled={!chargesEditable} onChange={(event) => patch({ quantity: event.target.value === "" ? null : Number(event.target.value) })} /></td>
            <td className="p-2"><Input aria-label={`Đơn vị phí ${index + 1}`} value={row.unit} disabled={!chargesEditable} onChange={(event) => patch({ unit: event.target.value })} /></td>
            <td className="p-2"><Input aria-label={`VAT phí ${index + 1}`} type="number" min={0} step="any" value={row.vatAmount} disabled={!chargesEditable} onChange={(event) => patch({ vatAmount: Number(event.target.value) })} /></td>
            <td className="p-2 whitespace-nowrap">{fclChargeTotal(row) == null ? "—" : formatMoney(fclChargeTotal(row)!, currency)}</td>
            <td className="p-2"><Input aria-label={`Ghi chú phí ${index + 1}`} value={row.note} disabled={!chargesEditable} onChange={(event) => patch({ note: event.target.value })} /></td>
            <td className="p-2 text-center"><input aria-label={`Phí tùy chọn ${index + 1}`} type="checkbox" checked={row.optional} disabled={!chargesEditable} onChange={(event) => patch({ optional: event.target.checked })} /></td>
            <td className="p-2">{chargesEditable && <Button type="button" variant="ghost" size="icon-sm" aria-label={`Xóa phí ${index + 1}`} onClick={() => onChange({ ...value, charges: value.charges.filter((_, i) => i !== index) })}><Trash2 /></Button>}</td>
          </tr>;
        })}</tbody>
      </Table>
    </div>
    <div className="grid gap-1 text-right font-medium"><p>Tổng chưa gồm phí tùy chọn: {formatMoney(totals.base, currency)}</p><p>Tổng gồm tất cả chi phí: {formatMoney(totals.all, currency)}</p></div>
    <Field label="Lưu ý" htmlFor="fcl-notes"><Textarea id="fcl-notes" rows={3} value={value.notes} disabled={!chargesEditable} onChange={(event) => onChange({ ...value, notes: event.target.value })} /></Field>
  </section>;
}
