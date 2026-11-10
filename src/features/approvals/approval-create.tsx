"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Bell, Paperclip, Plus, Send, Trash2, UserPlus, X } from "lucide-react";
import {
  MAX_PROPOSAL_STEPS, leaveDayCount, proposalGroups, proposalPeriodLabels, proposalPeriodRange,
  type ProposalRecord, type ProposalTemplateRecord, type ProposalUser,
} from "@speego/shared";
import { ArrowText } from "@/components/shared/arrow-text";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { MoneyInput } from "@/components/shared/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api";
import { Avatar, PeopleDialog, today } from "./approval-shared";

type Picker = { kind: "step"; index: number } | { kind: "follower" } | null;

/** Số đơn của mẫu đã dùng trong chu kỳ hiện tại (đơn bị từ chối không tính), khớp cách server đếm. */
function usedInPeriod(template: ProposalTemplateRecord, rows: ProposalRecord[], userId: string) {
  const { start, end } = proposalPeriodRange(template.period, new Date());
  return rows.filter((r) => r.requesterId === userId && r.templateId === template.id && r.status !== "tu-choi" && new Date(r.createdAt) >= start && new Date(r.createdAt) < end).length;
}

/** Người duyệt mặc định của mẫu (bỏ chính mình); không có thì để 1 bước trống để chọn. */
const defaultApprovers = (t: ProposalTemplateRecord, meId: string) => {
  const ids = t.approvers.map((a) => a.id).filter((id) => id !== meId);
  return ids.length ? ids : [""];
};

export function ApprovalCreate({ template: initial, templates, users, rows, me, onBack, onCreated }: {
  template: ProposalTemplateRecord;
  templates: ProposalTemplateRecord[];
  users: ProposalUser[];
  rows: ProposalRecord[];
  me: { id: string; name: string; department: string };
  onBack: () => void;
  onCreated: () => void;
}) {
  const [template, setTemplate] = useState(initial);
  const [subject, setSubject] = useState(initial.subject || initial.title);
  const [content, setContent] = useState(initial.content);
  const [approvers, setApprovers] = useState<string[]>(defaultApprovers(initial, me.id));
  const [followers, setFollowers] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [d, setD] = useState({
    date: today(), checkIn: "", checkOut: "", type: "di-muon", time: "", amount: null as number | null, payee: "", bankAccount: "",
    startDate: today(), endDate: today(), leaveType: "phep-nam", duration: "full",
  });
  const [picker, setPicker] = useState<Picker>(null);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const candidates = users.filter((u) => u.id !== me.id);
  const used = template.limit ? usedInPeriod(template, rows, me.id) : 0;
  const limitReached = template.limit !== null && used >= template.limit;
  const monthTotal = useMemo(() => {
    const { start, end } = proposalPeriodRange("month", new Date());
    return rows.filter((r) => r.requesterId === me.id && new Date(r.createdAt) >= start && new Date(r.createdAt) < end).length;
  }, [rows, me.id]);

  const pickTemplate = (id: string) => {
    const next = templates.find((t) => t.id === id);
    if (!next) return;
    setTemplate(next);
    setSubject(next.subject || next.title);
    setContent(next.content);
    setApprovers(defaultApprovers(next, me.id));
    setError(undefined);
  };

  const details = (): Record<string, unknown> => {
    switch (template.kind) {
      case "cham-cong": return { date: d.date, ...(d.checkIn && { checkIn: d.checkIn }), ...(d.checkOut && { checkOut: d.checkOut }) };
      case "di-muon-ve-som": return { date: d.date, type: d.type, time: d.time };
      case "thanh-toan": return { amount: d.amount ?? 0, payee: d.payee, ...(d.bankAccount && { bankAccount: d.bankAccount }) };
      case "nghi-phep": return { startDate: d.startDate, endDate: d.endDate, leaveType: d.leaveType, duration: d.duration };
      default: return {};
    }
  };

  const submit = () => {
    setError(undefined);
    if (approvers.length === 0 || approvers.some((id) => !id)) return setError("Vui lòng chọn đầy đủ người phê duyệt hoặc xóa bước còn trống");
    setSubmitting(true);
    api<{ row: ProposalRecord }>("/api/de-xuat", {
      method: "POST",
      body: JSON.stringify({ templateId: template.id, subject, content, details: details(), attachments: attachments.map((name) => ({ name })), followerIds: followers, approverIds: approvers }),
    })
      .then(onCreated)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Có lỗi khi nộp yêu cầu"))
      .finally(() => setSubmitting(false));
  };

  const input = (key: keyof typeof d, label: string, type: "date" | "time" | "text", opts?: { required?: boolean; min?: string }) => (
    <Field label={label} htmlFor={`dx-${key}`} required={opts?.required}>
      <Input id={`dx-${key}`} type={type} min={opts?.min} value={d[key] as string} onChange={(e) => setD({ ...d, [key]: e.target.value })} />
    </Field>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="outline" size="icon-lg" aria-label="Quay lại" onClick={onBack}><ArrowLeft /></Button>
        <div>
          <h1 className="text-xl font-bold text-primary">Tạo đề xuất</h1>
          <p className="text-sm text-muted-foreground"><ArrowText>Điền thông tin → chọn người duyệt → gửi</ArrowText></p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-lg text-white" style={{ background: template.color }}><Send aria-hidden className="size-5" /></span>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Mẫu đang dùng</p>
            <p className="font-semibold">{template.title}</p>
            <p className="text-sm text-muted-foreground">{template.description}</p>
          </div>
        </div>
        <div className="flex gap-2 text-center text-xs text-muted-foreground">
          <div className={`rounded-lg border px-3 py-1.5 ${limitReached ? "border-danger text-danger" : ""}`}>
            Hạn mức<strong className="block text-sm text-foreground">{template.limit ? `${used}/${template.limit} mỗi ${proposalPeriodLabels[template.period]}` : "Không giới hạn"}</strong>
          </div>
          <div className="rounded-lg border px-3 py-1.5">Tháng này<strong className="block text-sm text-foreground">{monthTotal}</strong></div>
        </div>
      </div>
      {limitReached && <InlineAlert className="mb-4">Đã hết hạn mức {template.limit} lần/{proposalPeriodLabels[template.period]} của mẫu này.</InlineAlert>}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <section className="space-y-4 rounded-xl border bg-card p-5 shadow-xs">
          <div>
            <h2 className="text-lg font-semibold">Thông tin chung</h2>
            <p className="text-sm text-muted-foreground">Người tạo lấy theo tài khoản đăng nhập.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-lg bg-muted px-3 py-1.5">Họ và tên: <strong>{me.name}</strong></span>
            <span className="rounded-lg bg-muted px-3 py-1.5">Mã nhân sự: <strong>{me.id}</strong></span>
            {me.department && <span className="rounded-lg bg-muted px-3 py-1.5">Bộ phận: <strong>{me.department}</strong></span>}
          </div>

          <Field label="Mẫu yêu cầu" htmlFor="dx-template" required>
            <NativeSelect id="dx-template" value={template.id} onChange={(e) => pickTemplate(e.target.value)}>
              {proposalGroups.map((group) => {
                const items = templates.filter((t) => t.group === group);
                return items.length ? <optgroup key={group} label={group}>{items.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</optgroup> : null;
              })}
            </NativeSelect>
          </Field>
          <Field label="Về việc" htmlFor="dx-subject" required>
            <Input id="dx-subject" value={subject} maxLength={300} onChange={(e) => setSubject(e.target.value)} />
          </Field>

          {template.kind === "cham-cong" && (
            <div className="grid gap-4 sm:grid-cols-3">{input("date", "Ngày cần điều chỉnh", "date", { required: true })}{input("checkIn", "Giờ vào cần bổ sung", "time")}{input("checkOut", "Giờ ra cần bổ sung", "time")}</div>
          )}
          {template.kind === "di-muon-ve-som" && (
            <div className="grid gap-4 sm:grid-cols-3">
              {input("date", "Ngày", "date", { required: true })}
              <Field label="Loại" htmlFor="dx-type"><NativeSelect id="dx-type" value={d.type} onChange={(e) => setD({ ...d, type: e.target.value })}><option value="di-muon">Đi muộn</option><option value="ve-som">Về sớm</option></NativeSelect></Field>
              {input("time", d.type === "ve-som" ? "Giờ về dự kiến" : "Giờ đến dự kiến", "time", { required: true })}
            </div>
          )}
          {template.kind === "thanh-toan" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Số tiền (VND)" htmlFor="dx-amount" required><MoneyInput id="dx-amount" fractionDigits={0} value={d.amount} onValueChange={(amount) => setD({ ...d, amount })} /></Field>
              {input("payee", "Người / đơn vị thụ hưởng", "text", { required: true })}
              {input("bankAccount", "Tài khoản nhận (tuỳ chọn)", "text")}
            </div>
          )}
          {template.kind === "nghi-phep" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Từ ngày" htmlFor="dx-startDate" required>
                <Input id="dx-startDate" type="date" value={d.startDate} onChange={(e) => setD({ ...d, startDate: e.target.value, endDate: d.endDate < e.target.value ? e.target.value : d.endDate })} />
              </Field>
              {input("endDate", "Đến ngày", "date", { required: true, min: d.startDate })}
              <Field label="Loại nghỉ" htmlFor="dx-leaveType"><NativeSelect id="dx-leaveType" value={d.leaveType} onChange={(e) => setD({ ...d, leaveType: e.target.value })}><option value="phep-nam">Sử dụng phép năm</option><option value="khong-luong">Nghỉ không hưởng lương</option></NativeSelect></Field>
              <Field label="Thời lượng mỗi ngày" htmlFor="dx-duration" hint={`Tổng: ${String(leaveDayCount(d.startDate, d.endDate, d.duration === "half" ? "half" : "full")).replace(".", ",")} ngày`}>
                <NativeSelect id="dx-duration" value={d.duration} onChange={(e) => setD({ ...d, duration: e.target.value })}><option value="full">Cả ngày (1 công)</option><option value="half">Nửa ngày (0,5 công)</option></NativeSelect>
              </Field>
            </div>
          )}

          <Field label="Nội dung" htmlFor="dx-content" required>
            <Textarea id="dx-content" rows={5} value={content} maxLength={10000} placeholder={"Kính gửi Ban Lãnh đạo Công ty,\n\nNội dung đề xuất..."} onChange={(e) => setContent(e.target.value)} />
          </Field>

          <div className="space-y-2">
            <p className="text-sm font-medium">Đính kèm</p>
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => {
              // Chỉ lưu tên tệp để hiển thị — chưa có kho lưu tệp cho module này.
              setAttachments((prev) => [...prev, ...Array.from(e.target.files ?? []).map((f) => f.name)].slice(0, 20));
              e.target.value = "";
            }} />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}><Paperclip /> Thêm tập tin</Button>
            <div className="flex flex-wrap gap-2">
              {attachments.map((name, i) => (
                <span key={`${name}-${i}`} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm">
                  <Paperclip aria-hidden className="size-3.5" />{name}
                  <button type="button" aria-label={`Bỏ ${name}`} onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}><X className="size-3.5" /></button>
                </span>
              ))}
            </div>
            {attachments.length > 0 && <p className="text-xs text-muted-foreground">Hiện chỉ lưu tên tệp, chưa lưu nội dung tệp.</p>}
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-xl border bg-card p-5 shadow-xs">
            <h2 className="text-lg font-semibold">Người theo dõi</h2>
            <p className="mb-3 text-sm text-muted-foreground">Nhận thông báo khi đề xuất có kết quả.</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {followers.map((id) => (
                <span key={id} className="inline-flex items-center gap-1.5 rounded-full border py-1 pr-2 pl-1 text-sm">
                  <Avatar name={userById.get(id)?.name ?? id} size={22} />{userById.get(id)?.name ?? id}
                  <button type="button" aria-label="Bỏ người theo dõi" onClick={() => setFollowers(followers.filter((f) => f !== id))}><X className="size-3.5" /></button>
                </span>
              ))}
            </div>
            <Button type="button" variant="outline" onClick={() => setPicker({ kind: "follower" })}><Bell /> Thêm người theo dõi</Button>
          </section>

          <section className="rounded-xl border bg-card p-5 shadow-xs">
            <h2 className="text-lg font-semibold">Luồng phê duyệt</h2>
            <p className="mb-3 text-sm text-muted-foreground">Chọn người duyệt theo từng bước (tối đa {MAX_PROPOSAL_STEPS}).</p>
            <ol className="space-y-2">
              <li className="flex items-center gap-2 text-sm"><Avatar name={me.name} size={26} /><span><b>Nộp yêu cầu</b> · {me.name}</span></li>
              {approvers.map((id, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-warning-soft text-xs font-semibold text-warning">{index + 1}</span>
                  {id ? <span className="flex min-w-0 flex-1 items-center gap-2"><span className="truncate">{userById.get(id)?.name ?? id}</span></span>
                    : <button type="button" className="flex-1 rounded-lg border border-dashed px-3 py-1.5 text-left text-muted-foreground hover:bg-muted" onClick={() => setPicker({ kind: "step", index })}><UserPlus aria-hidden className="mr-1 inline size-4" />Chọn người phê duyệt</button>}
                  {id && <Button type="button" variant="ghost" size="icon-sm" aria-label="Đổi người duyệt" onClick={() => setPicker({ kind: "step", index })}><UserPlus /></Button>}
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Xóa bước phê duyệt" onClick={() => setApprovers(approvers.filter((_, i) => i !== index))}><Trash2 /></Button>
                </li>
              ))}
            </ol>
            {approvers.length < MAX_PROPOSAL_STEPS && <Button type="button" variant="outline" className="mt-3" onClick={() => setApprovers([...approvers, ""])}><Plus /> Thêm bước phê duyệt</Button>}
          </section>
        </div>
      </div>

      {error && <InlineAlert className="mt-4">{error}</InlineAlert>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onBack}>Hủy</Button>
        <Button disabled={submitting || limitReached} onClick={submit}><Send /> {submitting ? "Đang nộp..." : "Gửi đơn đề xuất"}</Button>
      </div>

      {picker && (
        <PeopleDialog
          title={picker.kind === "step" ? "Chọn người phê duyệt" : "Thêm người theo dõi"}
          users={candidates.filter((u) => (picker.kind === "step" ? !approvers.includes(u.id) : !followers.includes(u.id)))}
          onClose={() => setPicker(null)}
          onPick={(id) => {
            if (picker.kind === "step") setApprovers(approvers.map((a, i) => (i === picker.index ? id : a)));
            else setFollowers([...followers, id]);
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}
