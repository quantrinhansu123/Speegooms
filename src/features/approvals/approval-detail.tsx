"use client";

import { useState } from "react";
import { ArrowLeft, Check, Paperclip, ShieldCheck, X } from "lucide-react";
import { proposalVerdictLabels, proposalVerdicts, type ProposalDecision, type ProposalRecord, type ProposalVerdict } from "@speego/shared";
import { InlineAlert } from "@/components/shared/form-fields";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Avatar, detailRows, formatDateTime, isMyTurn, statusMeta } from "./approval-shared";

const stepLook = {
  "da-duyet": { label: "Đồng ý", dot: "bg-success-soft text-success" },
  "tu-choi": { label: "Từ chối", dot: "bg-danger-soft text-danger" },
  "dang-duyet": { label: "Đang thực hiện", dot: "bg-warning-soft text-warning" },
  "cho": { label: "Chờ đến lượt", dot: "bg-muted text-muted-foreground" },
};

export function ApprovalDetail({ row, me, onBack, onChanged, onDecide, deciding, error }: {
  row: ProposalRecord;
  me: { id: string; name: string; role: string };
  onBack: () => void;
  /** Tải lại danh sách sau khi góp ý. */
  onChanged: () => void;
  onDecide: (decision: ProposalDecision, comment: string) => void;
  deciding: boolean;
  error?: string;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [verdict, setVerdict] = useState<ProposalVerdict>("du-dieu-kien");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [commentError, setCommentError] = useState<string>();
  const canComment = row.status === "cho-duyet" && (me.role === "admin" || row.requesterId === me.id || row.followers.some((f) => f.id === me.id) || row.steps.some((s) => s.approverId === me.id));

  const sendComment = () => {
    setSending(true);
    setCommentError(undefined);
    api(`/api/de-xuat/${row.id}/comments`, { method: "POST", body: JSON.stringify({ verdict, reason }) })
      .then(() => { setReason(""); setVerdict("du-dieu-kien"); onChanged(); })
      .catch((err: unknown) => setCommentError(err instanceof ApiError ? err.message : "Không gửi được góp ý"))
      .finally(() => setSending(false));
  };
  const [comment, setComment] = useState("");
  const mine = isMyTurn(row, me.id);
  const canDecide = row.status === "cho-duyet" && (mine || me.role === "admin");
  const rows = detailRows(row);
  const status = statusMeta[row.status];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon-lg" aria-label="Quay lại" onClick={onBack}><ArrowLeft /></Button>
        <h1 className="text-xl font-bold text-primary">Xem yêu cầu</h1>
      </div>

      <section className="rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold">{row.templateTitle}</p>
            <p className="text-sm text-muted-foreground">Số: {row.code}</p>
          </div>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Avatar name={row.requesterName} size={36} />
          <div>
            <p className="text-xs text-muted-foreground">Người tạo phiếu</p>
            <p className="text-sm font-medium">{row.requesterName} · {row.requesterId}</p>
            <p className="text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</p>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-5 shadow-xs">
        <div><p className="text-sm font-medium text-muted-foreground">Về việc</p><p className="whitespace-pre-wrap">{row.subject}</p></div>
        <div><p className="text-sm font-medium text-muted-foreground">Nội dung</p><p className="whitespace-pre-wrap">{row.content}</p></div>
        {rows.length > 0 && (
          <dl className="grid gap-3 rounded-lg bg-muted/60 p-3 sm:grid-cols-3">
            {rows.map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-sm font-semibold">{value}</dd></div>)}
          </dl>
        )}
        <div>
          <p className="mb-1 text-sm font-medium text-muted-foreground">Đính kèm</p>
          {row.attachments.length === 0 ? <p className="text-sm text-muted-foreground">Không có tập tin</p> : (
            <div className="flex flex-wrap gap-2">{row.attachments.map((a, i) => <span key={i} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm"><Paperclip aria-hidden className="size-3.5" />{a.name}</span>)}</div>
          )}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-xs">
        <h2 className="mb-3 text-lg font-semibold">Luồng phê duyệt</h2>
        <ol className="space-y-3">
          <li className="flex items-start gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success-soft text-success"><Check aria-hidden className="size-4" /></span>
            <div><p className="text-sm font-medium">Nộp yêu cầu</p><p className="text-xs text-muted-foreground">{row.requesterName} • {formatDateTime(row.createdAt)}</p></div>
          </li>
          {row.steps.map((step, i) => {
            const key = step.decision ?? (i === row.currentStep && row.status === "cho-duyet" ? "dang-duyet" : "cho");
            const look = stepLook[key];
            const who = step.decidedByName ?? step.approverName;
            return (
              <li key={i} className="flex items-start gap-3">
                <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", look.dot)}>
                  {step.decision === "da-duyet" ? <Check aria-hidden className="size-4" /> : step.decision === "tu-choi" ? <X aria-hidden className="size-4" /> : <ShieldCheck aria-hidden className="size-4" />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">Phê duyệt · <span className="text-muted-foreground">{look.label}</span></p>
                  <p className="text-sm">{who}</p>
                  <p className="text-xs text-muted-foreground">
                    {step.decidedAt ? `${step.decision === "da-duyet" ? "Đã duyệt" : "Đã từ chối"} bởi ${who} • ${formatDateTime(step.decidedAt)}` : "Người được chỉ định duyệt"}
                  </p>
                  {step.comment && <p className="text-xs text-muted-foreground">&ldquo;{step.comment}&rdquo;</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-xs">
        <h2 className="mb-3 text-lg font-semibold">Góp ý ({row.comments.length})</h2>
        {row.comments.length === 0 && <p className="mb-3 text-sm text-muted-foreground">Chưa có góp ý nào.</p>}
        <ul className="mb-3 space-y-3">
          {row.comments.map((c) => (
            <li key={c.id} className="flex items-start gap-3">
              <Avatar name={c.authorName} size={28} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <b>{c.authorName}</b>
                  <StatusBadge tone={c.verdict === "du-dieu-kien" ? "success" : "danger"}>{proposalVerdictLabels[c.verdict]}</StatusBadge>
                  <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                </p>
                {c.reason && <p className="mt-1 whitespace-pre-wrap text-sm">Lý do: {c.reason}</p>}
              </div>
            </li>
          ))}
        </ul>
        {canComment && (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
            <fieldset className="flex flex-wrap gap-4" aria-label="Kết luận góp ý">
              {proposalVerdicts.map((v) => (
                <label key={v} className="flex items-center gap-2 text-sm font-medium">
                  <input type="radio" name="verdict" checked={verdict === v} onChange={() => setVerdict(v)} />
                  {proposalVerdictLabels[v]}
                </label>
              ))}
            </fieldset>
            <Textarea aria-label="Lý do" rows={3} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder={verdict === "khong-du-dieu-kien" ? "Lý do không đủ điều kiện (bắt buộc)" : "Lý do (không bắt buộc)"} />
            {commentError && <InlineAlert>{commentError}</InlineAlert>}
            <Button type="button" disabled={sending} onClick={sendComment}>{sending ? "Đang gửi..." : "Gửi góp ý"}</Button>
          </div>
        )}
      </section>

      {row.followers.length > 0 && (
        <section className="rounded-xl border bg-card p-5 shadow-xs">
          <h2 className="mb-3 text-lg font-semibold">Người theo dõi</h2>
          <div className="flex flex-wrap gap-2">{row.followers.map((f) => <span key={f.id} className="inline-flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-sm"><Avatar name={f.name} size={22} />{f.name}</span>)}</div>
        </section>
      )}

      {error && <InlineAlert>{error}</InlineAlert>}
      {canDecide && (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t bg-background/95 py-3 backdrop-blur">
          {!mine && <p className="mr-auto text-sm text-muted-foreground">Bạn đang duyệt thay <b>{row.steps[row.currentStep]?.approverName}</b></p>}
          <Button variant="destructive" disabled={deciding} onClick={() => setRejecting(true)}><X /> Từ chối</Button>
          <Button disabled={deciding} onClick={() => onDecide("da-duyet", "")}><Check /> Đồng ý</Button>
        </div>
      )}

      {rejecting && (
        <Dialog open onOpenChange={(open) => { if (!open) setRejecting(false); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Lý do từ chối</DialogTitle></DialogHeader>
            <Textarea aria-label="Lý do từ chối" rows={4} maxLength={1000} placeholder="Nhập lý do từ chối (không bắt buộc)" value={comment} onChange={(e) => setComment(e.target.value)} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejecting(false)}>Hủy</Button>
              <Button variant="destructive" disabled={deciding} onClick={() => { setRejecting(false); onDecide("tu-choi", comment); setComment(""); }}>Xác nhận từ chối</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
