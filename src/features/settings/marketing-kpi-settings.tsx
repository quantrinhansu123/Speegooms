"use client";

import { useEffect, useState } from "react";
import { marketingKinds, marketingKindLabels, marketingKpiSettingsSchema, type MarketingKpiSettings } from "@speego/shared";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export function MarketingKpiSettingsView() {
  const [data, setData] = useState<MarketingKpiSettings | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const load = async () => {
    setBusy(true); setError("");
    try { const result = await api<MarketingKpiSettings>("/api/marketing/settings"); setData(result); setSavedIds(result.types.map(t => t.id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Không tải được cấu hình KPI"); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);
  const save = async () => {
    const parsed = marketingKpiSettingsSchema.safeParse(data);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api<MarketingKpiSettings>("/api/marketing/settings", { method: "PUT", body: JSON.stringify(parsed.data) });
      setData(result); setSavedIds(result.types.map(t => t.id)); setNotice("Đã lưu cấu hình KPI Marketing");
    } catch (e) { setError(e instanceof Error ? e.message : "Không lưu được cấu hình KPI"); }
    finally { setBusy(false); }
  };
  return <SectionCard className="mt-6" title="KPI giao việc Marketing" description="Cấu hình KPI riêng cho Media, Content, Ads và SEO. Loại đã lưu giữ nguyên tên, nhóm, đơn vị và cách đánh giá để bảo toàn lịch sử; có thể ngừng sử dụng và tạo loại mới.">
    {error && <InlineAlert className="mb-4">{error} <Button variant="outline" size="sm" disabled={busy} onClick={() => void load()}>Tải lại</Button></InlineAlert>}
    {notice && <p role="status" className="mb-4 text-sm">{notice}</p>}
    {data && <form onSubmit={e => { e.preventDefault(); void save(); }}>
      <fieldset disabled={busy} className="space-y-4">
        {data.types.map((type, index) => {
          const locked = savedIds.includes(type.id);
          const patch = (values: Partial<typeof type>) => setData({ ...data, types: data.types.map((t, i) => i === index ? { ...t, ...values } : t) });
          return <div key={type.id} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3 xl:grid-cols-6">
            <Field label="Nhóm việc" htmlFor={`kpi-kind-${type.id}`}><NativeSelect id={`kpi-kind-${type.id}`} disabled={locked} value={type.kind} onChange={e => patch({ kind: e.target.value as typeof type.kind })}>{marketingKinds.map(k => <option key={k} value={k}>{marketingKindLabels[k]}</option>)}</NativeSelect></Field>
            <Field label="Tên KPI" htmlFor={`kpi-name-${type.id}`}><Input id={`kpi-name-${type.id}`} required maxLength={120} disabled={locked} value={type.name} onChange={e => patch({ name: e.target.value })}/></Field>
            <Field label="Đơn vị" htmlFor={`kpi-unit-${type.id}`}><Input id={`kpi-unit-${type.id}`} required maxLength={40} disabled={locked} value={type.unit} onChange={e => patch({ unit: e.target.value })}/></Field>
            <Field label="Đánh giá" htmlFor={`kpi-direction-${type.id}`}><NativeSelect id={`kpi-direction-${type.id}`} disabled={locked} value={type.direction} onChange={e => patch({ direction: e.target.value as typeof type.direction })}><option value="at-least">Tối thiểu (≥)</option><option value="at-most">Tối đa (≤)</option></NativeSelect></Field>
            <Field label="Chỉ tiêu mặc định" htmlFor={`kpi-target-${type.id}`}><Input id={`kpi-target-${type.id}`} required type="number" min="0.000001" max="1000000000000000" step="any" value={type.defaultTarget || ""} onChange={e => patch({ defaultTarget: Number(e.target.value) })}/></Field>
            <div className="flex items-end gap-3"><label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={type.active} onChange={e => patch({ active: e.target.checked })}/> Đang sử dụng</label>{!locked && <Button variant="outline" type="button" onClick={() => setData({ ...data, types: data.types.filter(t => t.id !== type.id) })}>Bỏ</Button>}</div>
          </div>;
        })}
        <div className="flex gap-3"><Button type="button" variant="outline" disabled={data.types.length >= 100} onClick={() => setData({ ...data, types: [...data.types, { id: crypto.randomUUID(), kind: "media", name: "", unit: "", direction: "at-least", defaultTarget: 1, active: true }] })}>Thêm loại KPI</Button><Button type="submit">{busy ? "Đang lưu…" : "Lưu cấu hình KPI"}</Button></div>
      </fieldset>
    </form>}
  </SectionCard>;
}
