"use client";

import { marketingKpiMet, type MarketingKpiType, type MarketingTask } from "@speego/shared";
import { Field, NativeSelect } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TaskKpiEditor({ task, types, canEditOrder, onChange }: {
  task: MarketingTask; types: MarketingKpiType[]; canEditOrder: boolean; onChange: (task: MarketingTask) => void;
}) {
  const kpis = task.kpis ?? [];
  return <div className="space-y-3 rounded-lg border p-4">
    <p className="font-medium">Chỉ tiêu KPI</p>
    {kpis.map(k => {
      const patch = (values: Partial<typeof k>) => onChange({ ...task, kpis: kpis.map(v => v.id === k.id ? { ...v, ...values } : v) });
      return <div key={k.id} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Field label={`${k.name} · ${k.unit} · ${k.direction === "at-most" ? "tối đa" : "tối thiểu"}`} htmlFor={`goal-${k.id}`}><Input id={`goal-${k.id}`} type="number" required step="any" min="0.000001" max="1000000000000000" disabled={!canEditOrder} value={k.target || ""} onChange={e => patch({ target: Number(e.target.value) })}/></Field>
        <Field label={`Thực hiện${k.actual === null ? "" : marketingKpiMet(k) ? " · Đạt chỉ tiêu" : " · Chưa đạt chỉ tiêu"}`} htmlFor={`actual-${k.id}`}><Input id={`actual-${k.id}`} type="number" min="0" step="any" max="1000000000000000" value={k.actual ?? ""} onChange={e => patch({ actual: e.target.value === "" ? null : Number(e.target.value) })}/></Field>
        {canEditOrder && <Button type="button" variant="outline" onClick={() => onChange({ ...task, kpis: kpis.filter(v => v.id !== k.id) })}>Bỏ KPI</Button>}
      </div>;
    })}
    {canEditOrder && <NativeSelect aria-label="Thêm loại KPI cho công việc" value="" disabled={kpis.length >= 30} onChange={e => {
      const type = types.find(t => t.id === e.target.value);
      if (type) onChange({ ...task, kpis: [...kpis, { id: type.id, name: type.name, unit: type.unit, direction: type.direction, target: type.defaultTarget, actual: null }] });
    }}><option value="">Chọn loại KPI để thêm</option>{types.filter(t => t.active && t.kind === task.kind && !kpis.some(k => k.id === t.id)).map(t => <option key={t.id} value={t.id}>{t.name} ({t.unit})</option>)}</NativeSelect>}
    {!kpis.length && <p className="text-sm text-muted-foreground">Chưa giao chỉ tiêu KPI cho công việc này.</p>}
  </div>;
}
