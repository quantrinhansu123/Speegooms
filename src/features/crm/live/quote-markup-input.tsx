"use client";

import { quoteAmountWithMarkup, quoteMarkupPercent } from "@speego/shared";
import { Input } from "@/components/ui/input";

export function QuoteMarkupInput({ cost, revenue, disabled, label, onAmount }: {
  cost: number | null; revenue: number | null; disabled: boolean; label: string;
  onAmount: (amount: number) => boolean | void;
}) {
  const percent = quoteMarkupPercent(cost, revenue);
  return <div className="flex items-center gap-2">
    <Input key={String(cost) + ":" + String(revenue)} className="min-w-24" type="number" step="0.01" min={-100}
      aria-label={label} defaultValue={percent ?? ""} disabled={disabled || cost == null || cost <= 0}
      placeholder="—" title="Markup = (giá báo Sale − giá gốc) / giá gốc × 100%. Nhập % rồi rời ô để áp dụng."
      onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }}
      onBlur={event => {
        const input = event.currentTarget;
        if (!input.value.trim()) { input.value = percent == null ? "" : String(percent); return; }
        const amount = quoteAmountWithMarkup(cost, input.valueAsNumber);
        if (amount == null) { input.value = percent == null ? "" : String(percent); return; }
        if (percent !== input.valueAsNumber && onAmount(amount) === false) input.value = percent == null ? "" : String(percent);
      }} />
    <span className="shrink-0 text-muted-foreground">%</span>
  </div>;
}
