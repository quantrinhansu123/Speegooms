"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, FilePlus2, Pencil, Trash2, X } from "lucide-react";
import {
  MAX_PROPOSAL_STEPS, proposalGroups, proposalPeriodLabels, proposalPeriods,
  type ProposalPeriod, type ProposalTemplateRecord, type ProposalUser,
} from "@speego/shared";
import { ArrowText } from "@/components/shared/arrow-text";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api";
import { matchesQuery } from "@/lib/text";
import { Avatar } from "./approval-shared";

type Draft = {
  recordId: string | null; baseId: string | null; group: string; title: string; description: string; subject: string; content: string;
  color: string; approverIds: string[]; limited: boolean; limit: string; period: ProposalPeriod;
};

const fromTemplate = (t: ProposalTemplateRecord): Draft => ({
  recordId: t.recordId, baseId: t.baseId, group: t.group, title: t.title, description: t.description, subject: t.subject, content: t.content,
  color: t.color, approverIds: t.approvers.map((a) => a.id), limited: t.limit !== null, limit: String(t.limit ?? 1), period: t.period,
});

const blank: Draft = { recordId: null, baseId: null, group: "CHUNG", title: "", description: "", subject: "", content: "", color: "#16a34a", approverIds: [], limited: false, limit: "1", period: "month" };

function TemplateForm({ draft: initial, users, onClose, onSaved }: { draft: Draft; users: ProposalUser[]; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState(initial);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id;
  const departments = [...new Set(users.map((u) => u.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi"));
  const shown = users.filter((u) => (!dept || u.department === dept) && matchesQuery(q, `${u.name} ${u.id} ${u.title}`)).slice(0, 80);

  const toggle = (id: string) => {
    if (draft.approverIds.includes(id)) return set("approverIds", draft.approverIds.filter((a) => a !== id));
    if (draft.approverIds.length >= MAX_PROPOSAL_STEPS) return setError(`Tối đa ${MAX_PROPOSAL_STEPS} người phê duyệt`);
    setError(undefined);
    set("approverIds", [...draft.approverIds, id]);
  };
  const move = (i: number, dir: -1 | 1) => {
    const next = [...draft.approverIds];
    [next[i], next[i + dir]] = [next[i + dir]!, next[i]!];
    set("approverIds", next);
  };

  const save = () => {
    setSaving(true);
    setError(undefined);
    api(draft.recordId ? `/api/de-xuat/templates/${draft.recordId}` : "/api/de-xuat/templates", {
      method: draft.recordId ? "PUT" : "POST",
      body: JSON.stringify({
        baseId: draft.baseId, group: draft.group, title: draft.title, description: draft.description, subject: draft.subject, content: draft.content,
        color: draft.color, approverIds: draft.approverIds, limit: draft.limited ? Number(draft.limit) || 0 : null, period: draft.period,
      }),
    })
      .then(onSaved)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không lưu được mẫu"))
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="px-5 pt-5 pr-12 pb-3">
          <DialogTitle>{draft.recordId || draft.baseId ? "Sửa mẫu đề xuất" : "Tạo mẫu đề xuất"}</DialogTitle>
          <DialogDescription>Tạo mẫu sẵn (tiêu đề, nội dung, người duyệt). Khi nhân viên chọn mẫu, form tự điền.</DialogDescription>
        </DialogHeader>
        <div className="no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-2">
          <Field label="Tên mẫu" htmlFor="tpl-title" required><Input id="tpl-title" value={draft.title} maxLength={150} placeholder="VD: ĐỀ XUẤT MUA VPP" onChange={(e) => set("title", e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nhóm" htmlFor="tpl-group"><NativeSelect id="tpl-group" value={draft.group} onChange={(e) => set("group", e.target.value)}>{proposalGroups.map((g) => <option key={g}>{g}</option>)}</NativeSelect></Field>
            <Field label="Màu icon" htmlFor="tpl-color"><Input id="tpl-color" type="color" value={draft.color} onChange={(e) => set("color", e.target.value)} /></Field>
          </div>
          <Field label="Mô tả ngắn" htmlFor="tpl-desc"><Input id="tpl-desc" value={draft.description} maxLength={300} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field label="Về việc (mặc định)" htmlFor="tpl-subject"><Input id="tpl-subject" value={draft.subject} maxLength={300} onChange={(e) => set("subject", e.target.value)} /></Field>
          <Field label="Nội dung mẫu (mặc định)" htmlFor="tpl-content"><Textarea id="tpl-content" rows={6} value={draft.content} onChange={(e) => set("content", e.target.value)} /></Field>

          <div className="space-y-3 rounded-lg border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={draft.limited} onChange={(e) => set("limited", e.target.checked)} />
              Giới hạn số lần một nhân viên được tạo phiếu
            </label>
            {draft.limited && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Số lần tối đa" htmlFor="tpl-limit"><Input id="tpl-limit" type="number" min={1} step={1} value={draft.limit} onChange={(e) => set("limit", e.target.value)} /></Field>
                <Field label="Chu kỳ tự đặt lại" htmlFor="tpl-period"><NativeSelect id="tpl-period" value={draft.period} onChange={(e) => set("period", e.target.value as ProposalPeriod)}>{proposalPeriods.map((p) => <option key={p} value={p}>Mỗi {proposalPeriodLabels[p]}</option>)}</NativeSelect></Field>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Người phê duyệt mặc định</p>
            <p className="text-xs text-muted-foreground">Tick nhiều người — thứ tự tick / sắp xếp là luồng duyệt khi nhân viên tạo đề xuất.</p>
            {draft.approverIds.length > 0 && (
              <ol className="space-y-1">
                {draft.approverIds.map((id, i) => (
                  <li key={id} className="flex items-center gap-2 rounded-lg border px-2 py-1 text-sm">
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{i + 1}</span>
                    <span className="flex-1 truncate">{nameOf(id)}</span>
                    <Button type="button" variant="ghost" size="icon-xs" aria-label="Lên" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                    <Button type="button" variant="ghost" size="icon-xs" aria-label="Xuống" disabled={i === draft.approverIds.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                    <Button type="button" variant="ghost" size="icon-xs" aria-label="Bỏ" onClick={() => toggle(id)}><X /></Button>
                  </li>
                ))}
              </ol>
            )}
            <div className="flex gap-2">
              <Input aria-label="Tìm nhân sự" value={q} placeholder="Tìm nhân sự để chọn..." onChange={(e) => setQ(e.target.value)} />
              <NativeSelect aria-label="Lọc bộ phận" className="w-44" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">Tất cả bộ phận</option>{departments.map((d) => <option key={d}>{d}</option>)}</NativeSelect>
            </div>
            <ul className="max-h-48 divide-y overflow-y-auto rounded-lg border">
              {shown.map((u) => (
                <li key={u.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-1.5 hover:bg-muted">
                    <input type="checkbox" checked={draft.approverIds.includes(u.id)} onChange={() => toggle(u.id)} />
                    <Avatar name={u.name} size={26} />
                    <span className="min-w-0"><span className="block truncate text-sm font-medium">{u.name}</span><span className="block truncate text-xs text-muted-foreground">{[u.id, u.title, u.department].filter(Boolean).join(" · ")}</span></span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {error && <div className="px-5 pb-2"><InlineAlert>{error}</InlineAlert></div>}
        <DialogFooter className="m-0 px-5">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button type="button" disabled={saving} onClick={save}>{saving ? "Đang lưu..." : "Lưu mẫu đề xuất"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApprovalTemplates({ templates, users, search, canManage, onUse, onChanged }: {
  templates: ProposalTemplateRecord[];
  users: ProposalUser[];
  search: string;
  canManage: boolean;
  onUse: (t: ProposalTemplateRecord) => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<ProposalTemplateRecord | null>(null);
  const [error, setError] = useState<string>();
  const shown = templates.filter((t) => matchesQuery(search, `${t.title} ${t.group} ${t.description}`));

  const remove = () => {
    const t = removing;
    setRemoving(null);
    if (!t?.recordId) return;
    api(`/api/de-xuat/templates/${t.recordId}`, { method: "DELETE" })
      .then(onChanged)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không xóa được mẫu"));
  };

  return (
    <div className="space-y-5 p-4">
      {canManage && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setEditing(blank)}><FilePlus2 /> Tạo mẫu đề xuất</Button>
          <span className="text-sm text-muted-foreground"><ArrowText>Tạo mẫu sẵn → khi chọn mẫu, form tự điền Về việc & nội dung</ArrowText></span>
        </div>
      )}
      {error && <InlineAlert>{error}</InlineAlert>}
      {proposalGroups.map((group) => {
        const items = shown.filter((t) => t.group === group);
        if (!items.length) return null;
        return (
          <section key={group}>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">{group}</h3>
            <ul className="divide-y rounded-xl border bg-card">
              {items.map((t) => (
                <li key={t.id} className="flex items-center gap-1 pr-2">
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-muted/60" onClick={() => onUse(t)}>
                    <span className="size-9 shrink-0 rounded-lg" style={{ background: t.color }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{t.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        Người tạo: {t.createdByName ?? "Mẫu hệ thống"}
                        {t.content && " · Có nội dung mẫu"}
                        {t.limit ? ` · Tối đa ${t.limit} lần/${proposalPeriodLabels[t.period]}` : ""}
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
                  </button>
                  {canManage && (
                    <>
                      <Button variant="ghost" size="icon-sm" aria-label={`Sửa mẫu ${t.title}`} onClick={() => setEditing(fromTemplate(t))}><Pencil /></Button>
                      {t.recordId && <Button variant="ghost" size="icon-sm" aria-label={t.baseId ? `Đặt lại mẫu ${t.title}` : `Xóa mẫu ${t.title}`} onClick={() => setRemoving(t)}><Trash2 /></Button>}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {shown.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Không tìm thấy mẫu yêu cầu</p>}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        title={removing?.baseId ? "Đặt lại mẫu về mặc định?" : "Xóa mẫu đề xuất?"}
        description={removing?.baseId ? `Mẫu "${removing.title}" sẽ quay về nội dung hệ thống.` : `Xóa mẫu "${removing?.title ?? ""}". Các đề xuất đã tạo không bị ảnh hưởng.`}
        confirmLabel={removing?.baseId ? "Đặt lại" : "Xóa"}
        destructive
        onConfirm={remove}
      />
      {editing && <TemplateForm draft={editing} users={users} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />}
    </div>
  );
}
