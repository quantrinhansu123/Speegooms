"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, RefreshCw } from "lucide-react";
import { createKpiSchema, manageableKpiDepartments, kpiDepartmentLabels, kpiPeriodLabels, type CreateKpiInput, type KpiDefinition, type KpiDepartment } from "@speego/shared";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSession } from "@/features/auth/session-provider";
import { api } from "@/lib/api";

type Draft = CreateKpiInput & { id?: string; version?: number };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Không lưu được cấu hình KPI";

export function KpiSettings() {
  const user = useSession();
  const departments = manageableKpiDepartments(user.role);
  const [department, setDepartment] = useState<KpiDepartment>("marketing");
  const [definitions, setDefinitions] = useState<KpiDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [target, setTarget] = useState("");
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api<{ definitions: KpiDefinition[] }>("/api/settings/kpis", { signal: controller.signal })
      .then(body => {
        if (!controller.signal.aborted) { setDefinitions(body.definitions); setLoaded(true); setError(""); }
      })
      .catch((err: unknown) => { if (!controller.signal.aborted) setError(errorMessage(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, user.id, user.role]);

  function open(definition?: KpiDefinition) {
    setFormError("");
    setTarget(definition?.target == null ? "" : String(definition.target));
    setEditing(definition ?? { department, group: department === "marketing" ? "Content" : department.startsWith("sale-") ? "Sale" : kpiDepartmentLabels[department], code: "", name: "", unit: "", target: null, period: "month", active: true });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || pending) return;
    const { id, version, ...fields } = editing;
    const parsed = createKpiSchema.safeParse({ ...fields, target: target.trim() === "" ? null : Number(target) });
    if (!parsed.success) { setFormError(parsed.error.issues[0].message); return; }
    setPending(true);
    setFormError("");
    setNotice("");
    try {
      const body = await api<{ definition: KpiDefinition }>(id ? `/api/settings/kpis/${id}` : "/api/settings/kpis", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(id ? { ...parsed.data, version } : parsed.data),
      });
      setDefinitions(rows => [...rows.filter(row => row.id !== body.definition.id), body.definition]);
      setNotice(`Đã lưu KPI ${body.definition.code}.`);
      setEditing(null);
    } catch (err) { setFormError(errorMessage(err)); }
    finally { setPending(false); }
  }

  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setEditing(draft => draft ? { ...draft, [key]: value } : draft);
  }

  const filtered = definitions.filter(row => row.department === department);
  const groups = [...new Set(filtered.map(row => row.group))].sort((a, b) => a.localeCompare(b, "vi"));

  return <SectionCard className="mt-6" title="Cấu hình KPI theo phòng ban"
    description="Quản lý mã KPI, bộ phận, đơn vị và chỉ tiêu theo kỳ. Để trống chỉ tiêu khi chưa chốt mức giao."
    action={<Button variant="outline" disabled={loading || pending} onClick={() => { setLoading(true); setNotice(""); setRevision(value => value + 1); }}><RefreshCw /> Tải lại</Button>}>
    {error && <InlineAlert className="mb-4">{error}</InlineAlert>}
    {notice && <InlineAlert tone="success" className="mb-4">{notice}</InlineAlert>}
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <Field label="Phòng ban" htmlFor="kpi-department" className="w-full sm:w-64">
        <NativeSelect id="kpi-department" value={department} disabled={pending} onChange={e => { setDepartment(e.target.value as KpiDepartment); setNotice(""); }}>
          {departments.map(value => <option key={value} value={value}>{kpiDepartmentLabels[value]}</option>)}
        </NativeSelect>
      </Field>
      <Button disabled={loading || !loaded || pending} onClick={() => open()}><Plus /> Thêm KPI</Button>
    </div>
    {user.role === "marketing-lead" && <p className="mb-4 text-sm text-muted-foreground">Leader Marketing được cấu hình KPI của P.MKT.</p>}
    {loading ? <p role="status" className="text-sm text-muted-foreground">Đang tải cấu hình KPI…</p> : loaded && <>
      {!filtered.length && <p className="text-sm text-muted-foreground">Chưa có KPI cho {kpiDepartmentLabels[department]}. Bấm Thêm KPI để cấu hình.</p>}
      <div className="space-y-6">{groups.map(group => <div key={group}>
        <h3 className="mb-2 font-semibold">KPI {group}</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead><tr className="border-b text-left text-muted-foreground">
              {["Mã KPI", "Chỉ số", "Đơn vị", "Chỉ tiêu / kỳ", "Trạng thái", "Thao tác"].map(label => <th key={label} scope="col" className="px-2 py-3 font-medium">{label}</th>)}
            </tr></thead>
            <tbody>{filtered.filter(row => row.group === group).sort((a, b) => a.code.localeCompare(b.code)).map(row => <tr key={row.id} className="border-b last:border-0">
              <th scope="row" className="px-2 py-3 text-left font-mono font-medium">{row.code}</th>
              <td className="px-2 py-3">{row.name}</td>
              <td className="px-2 py-3">{row.unit}</td>
              <td className="px-2 py-3">{row.target === null ? "Chưa đặt" : row.target.toLocaleString("vi-VN")} / {kpiPeriodLabels[row.period].toLowerCase()}</td>
              <td className="px-2 py-3"><span className={`rounded-full px-2 py-1 text-xs ${row.active ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"}`}>{row.active ? "Áp dụng" : "Tạm ngưng"}</span></td>
              <td className="px-2 py-3"><Button size="sm" variant="outline" disabled={pending} aria-label={`Sửa ${row.code}`} onClick={() => open(row)}><Pencil /> Sửa</Button></td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>)}</div>
    </>}

    <Dialog open={Boolean(editing)} onOpenChange={value => { if (!value && !pending) setEditing(null); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing?.id ? "Sửa KPI" : "Thêm KPI"}</DialogTitle>
          <DialogDescription>{editing && kpiDepartmentLabels[editing.department]} · Cấu hình chỉ số và chỉ tiêu theo kỳ.</DialogDescription>
        </DialogHeader>
        {editing && <form onSubmit={save} className="space-y-4">
          <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
            <Field label="Bộ phận" htmlFor="kpi-group" required>
              <Input id="kpi-group" list="kpi-group-options" required maxLength={80} value={editing.group} onChange={e => change("group", e.target.value)} />
            </Field>
            <datalist id="kpi-group-options">{[...new Set([...(department === "marketing" ? ["Content", "Media"] : []), ...filtered.map(row => row.group)])].map(group => <option key={group} value={group} />)}</datalist>
            <Field label="Mã KPI" htmlFor="kpi-code" required hint="Ví dụ: KPI_1_C_MKT">
              <Input id="kpi-code" required maxLength={64} value={editing.code} onChange={e => change("code", e.target.value.toUpperCase())} />
            </Field>
            <Field label="Tên chỉ số" htmlFor="kpi-name" required className="sm:col-span-2">
              <Input id="kpi-name" required maxLength={160} value={editing.name} onChange={e => change("name", e.target.value)} />
            </Field>
            <Field label="Đơn vị tính" htmlFor="kpi-unit" required>
              <Input id="kpi-unit" required maxLength={40} placeholder="Lượt, người, giây…" value={editing.unit} onChange={e => change("unit", e.target.value)} />
            </Field>
            <Field label="Chỉ tiêu" htmlFor="kpi-target" hint="Để trống nếu chưa giao chỉ tiêu.">
              <Input id="kpi-target" type="number" min={0} max={1e15} step="any" value={target} onChange={e => setTarget(e.target.value)} />
            </Field>
            <Field label="Kỳ đánh giá" htmlFor="kpi-period">
              <NativeSelect id="kpi-period" value={editing.period} onChange={e => change("period", e.target.value as Draft["period"])}>
                {Object.entries(kpiPeriodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Trạng thái" htmlFor="kpi-active">
              <NativeSelect id="kpi-active" value={String(editing.active)} onChange={e => change("active", e.target.value === "true")}>
                <option value="true">Áp dụng</option><option value="false">Tạm ngưng</option>
              </NativeSelect>
            </Field>
          </fieldset>
          {formError && <InlineAlert>{formError}</InlineAlert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setEditing(null)}>Hủy</Button>
            <Button type="submit" disabled={pending}>{pending ? "Đang lưu…" : "Lưu KPI"}</Button>
          </div>
        </form>}
      </DialogContent>
    </Dialog>
  </SectionCard>;
}
