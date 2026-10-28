"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { approvalMeta, simulatedApprovals } from "@/config/crm";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { quoteNeedsApproval, quoteTotals } from "@/services/crm/rules";
import type { Quotation, QuoteLine } from "@/types/crm";
import { useCrm } from "../hooks";
import { ChainTrace } from "./chain-trace";
import { QuoteBadge } from "./meta-badges";
import { QuotationPreview } from "./quotation-preview";

type Key = "goods" | "freight" | "surcharges";

function LinesEditor({
  title,
  hint,
  lines,
  currency,
  disabled,
  onChange,
}: {
  title: string;
  hint: string;
  lines: QuoteLine[];
  currency: Quotation["currency"];
  disabled: boolean;
  onChange: (lines: QuoteLine[]) => void;
}) {
  const set = (i: number, patch: Partial<QuoteLine>) => onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const sum = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  return (
    <SectionCard title={title} description={hint} bodyClassName="pt-3">
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có dòng nào.</p>
      ) : (
        <div className="space-y-3">
          {lines.map((l, i) => (
            <div key={l.id} className="grid grid-cols-12 gap-2 rounded-lg border bg-background p-2.5">
              <Input aria-label={`${title} dòng ${i + 1}: mô tả`} className="col-span-12 h-9 sm:col-span-6" placeholder="Mô tả" disabled={disabled} value={l.label} onChange={(e) => set(i, { label: e.target.value })} />
              <Input aria-label={`${title} dòng ${i + 1}: số lượng`} type="number" min={0} className="col-span-4 h-9 sm:col-span-2" placeholder="SL" disabled={disabled} value={l.quantity} onChange={(e) => set(i, { quantity: Number(e.target.value) })} />
              <Input aria-label={`${title} dòng ${i + 1}: đơn giá`} type="number" min={0} className="col-span-8 h-9 sm:col-span-4" placeholder="Đơn giá" disabled={disabled} value={l.unitPrice} onChange={(e) => set(i, { unitPrice: Number(e.target.value) })} />
              <div className="col-span-12 flex items-center justify-between gap-2 text-xs text-muted-foreground sm:col-span-12">
                <label className="flex items-center gap-1.5">
                  Giá vốn nội bộ
                  <Input aria-label={`${title} dòng ${i + 1}: giá vốn`} type="number" min={0} className="h-7 w-32" disabled={disabled} value={l.costPrice ?? ""} onChange={(e) => set(i, { costPrice: e.target.value === "" ? undefined : Number(e.target.value) })} />
                </label>
                <span className="tabular font-medium text-foreground">{formatMoney(l.quantity * l.unitPrice, currency)}</span>
                {!disabled && (
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Xóa dòng ${i + 1} của ${title}`} onClick={() => onChange(lines.filter((_, idx) => idx !== i))}>
                    <Trash2 />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        {!disabled ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...lines, { id: `${title[0]}${Date.now().toString(36)}`, label: "", quantity: 1, unitPrice: 0 }])}>
            <Plus /> Thêm dòng
          </Button>
        ) : (
          <span />
        )}
        <p className="tabular text-sm font-semibold">{formatMoney(sum, currency)}</p>
      </div>
    </SectionCard>
  );
}

export function QuotationEditor({ quoteId }: { quoteId: string }) {
  const { data, actions, can, user, staffName } = useCrm();
  const stored = data.quotations.find((q) => q.quoteId === quoteId);
  if (!stored) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState title="Không tìm thấy báo giá" description="Báo giá không tồn tại hoặc không thuộc phạm vi tuyến của bạn." />
      </div>
    );
  }
  return <EditorInner key={`${stored.quoteId}-${stored.status}-${stored.approval.state}`} stored={stored} actions={actions} can={can} role={user.role} title={user.title} staffName={staffName} />;
}

function EditorInner({
  stored,
  actions,
  can,
  role,
  title,
  staffName,
}: {
  stored: Quotation;
  actions: ReturnType<typeof useCrm>["actions"];
  can: ReturnType<typeof useCrm>["can"];
  role: string;
  title: string;
  staffName: (id: string) => string;
}) {
  const { all } = useCrm();
  const router = useRouter();
  const [draft, setDraft] = useState<Quotation>(stored);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "danger" | "success"; text: string }>();

  const editable = can("quote.write") && stored.status === "nhap";
  const dirty = JSON.stringify(draft) !== JSON.stringify(stored);
  const totals = quoteTotals(draft);
  const needsApproval = quoteNeedsApproval(draft);
  const rfq = all.rfqs.find((r) => r.rfqId === stored.rfqId);
  const customer = all.customers.find((c) => c.customerId === stored.customerId);
  const contract = all.contracts.find((c) => c.rfqId === stored.rfqId && c.status !== "huy");
  const isReviewer = role === "ban-gd" || role === "admin" || title.startsWith("Trưởng");
  const run = (r: { ok: boolean; error?: string }, success?: string) =>
    setMsg(r.ok ? (success ? { tone: "success", text: success } : undefined) : { tone: "danger", text: r.error ?? "Không thực hiện được" });

  const saveIfDirty = () => (dirty ? actions.saveQuotation(draft) : { ok: true as const });
  const setLines = (k: Key) => (lines: QuoteLine[]) => setDraft({ ...draft, [k]: lines });

  return (
    <>
      <Link href="/crm/bao-gia" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Danh sách báo giá
      </Link>
      <div className="mb-6 rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight text-primary">{stored.quoteId}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {customer?.name ?? stored.customerId} · tạo {formatDate(stored.createdAt)}
              {stored.sentAt && ` · gửi ${formatDate(stored.sentAt)}`}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <QuoteBadge value={stored.status} />
              <span className="text-xs text-muted-foreground">Phê duyệt: {approvalMeta[stored.approval.state]} (mô phỏng)</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Tổng cộng</p>
            <p className="tabular text-2xl font-semibold text-primary">{formatMoney(totals.total, draft.currency)}</p>
          </div>
        </div>
        <ChainTrace className="mt-4" messId={stored.messId} rfqId={stored.rfqId} orderId={contract?.orderId} customerId={stored.customerId} />
      </div>

      {msg && (
        <InlineAlert tone={msg.tone} className="mb-4">
          {msg.text}
        </InlineAlert>
      )}
      {stored.approval.state === "bi-tu-choi" && stored.approval.note && (
        <InlineAlert tone="danger" className="mb-4">
          Bị từ chối duyệt: {stored.approval.note}
        </InlineAlert>
      )}
      {stored.responseNote && <InlineAlert tone="info" className="mb-4">Phản hồi của khách: {stored.responseNote}</InlineAlert>}

      <div role="group" aria-label="Chế độ xem" className="mb-4 inline-flex rounded-lg bg-muted p-0.5 xl:hidden">
        {(
          [
            ["edit", "Soạn thảo"],
            ["preview", "Xem trước"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)} className={cn("h-8 rounded-md px-4 text-sm font-medium", view === k ? "bg-surface text-primary shadow-xs" : "text-muted-foreground")}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className={cn("space-y-6", view === "preview" && "hidden xl:block xl:space-y-6")}>
          <LinesEditor title="Tiền hàng" hint="Giá hàng/xưởng từ Sourcing" lines={draft.goods} currency={draft.currency} disabled={!editable} onChange={setLines("goods")} />
          <LinesEditor title="Cước vận chuyển" hint="Cước từ Logistics" lines={draft.freight} currency={draft.currency} disabled={!editable} onChange={setLines("freight")} />
          <LinesEditor title="Phụ phí" hint="Phí kho, xử lý, phát sinh đã có căn cứ" lines={draft.surcharges} currency={draft.currency} disabled={!editable} onChange={setLines("surcharges")} />

          <SectionCard title="Điều kiện và tổng hợp">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Tiền tệ" htmlFor="qe-cur">
                <NativeSelect id="qe-cur" disabled={!editable} value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value as Quotation["currency"] })}>
                  <option value="VND">VND</option>
                  <option value="USD">USD</option>
                </NativeSelect>
              </Field>
              <Field label="Giảm giá (%)" htmlFor="qe-disc">
                <Input id="qe-disc" type="number" min={0} max={100} disabled={!editable} value={draft.discountPercent} onChange={(e) => setDraft({ ...draft, discountPercent: Number(e.target.value) })} />
              </Field>
              <Field label="Hiệu lực đến" htmlFor="qe-valid">
                <Input id="qe-valid" type="date" disabled={!editable} value={draft.validUntil} onChange={(e) => setDraft({ ...draft, validUntil: e.target.value })} />
              </Field>
              <Field label="Điều khoản" htmlFor="qe-terms" className="sm:col-span-3">
                <Textarea id="qe-terms" rows={2} disabled={!editable} value={draft.termsNote} onChange={(e) => setDraft({ ...draft, termsNote: e.target.value })} />
              </Field>
            </div>
            <dl className="mt-4 space-y-1.5 border-t pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Tiền hàng</dt><dd className="tabular">{formatMoney(totals.goods, draft.currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Cước</dt><dd className="tabular">{formatMoney(totals.freight, draft.currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Phụ phí</dt><dd className="tabular">{formatMoney(totals.surcharges, draft.currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Giảm giá</dt><dd className="tabular">−{formatMoney(totals.discount, draft.currency)}</dd></div>
              <div className="flex justify-between border-t pt-1.5 font-semibold"><dt>Tổng báo khách</dt><dd className="tabular">{formatMoney(totals.total, draft.currency)}</dd></div>
              <div className="flex justify-between text-xs text-muted-foreground"><dt>Biên gộp nội bộ (không hiện cho khách)</dt><dd className="tabular">{formatMoney(totals.margin, draft.currency)}</dd></div>
            </dl>
            {needsApproval && (
              <InlineAlert tone="warning" className="mt-3 text-xs">
                Giảm giá {draft.discountPercent}% vượt ngưỡng mô phỏng {simulatedApprovals.quoteDiscountPercent}%, cần Trưởng phòng Sale duyệt trước khi gửi khách. Ngưỡng này chỉ để demo, chưa phải quy định của SpeeGo (tài liệu ghi ngưỡng chưa chốt).
              </InlineAlert>
            )}
          </SectionCard>

          <SectionCard title="Luồng xử lý">
            <div className="space-y-3">
              {editable && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={!dirty} onClick={() => run(actions.saveQuotation(draft), "Đã lưu nháp")}>
                    Lưu nháp
                  </Button>
                  <Button
                    onClick={() => {
                      const saved = saveIfDirty();
                      if (!saved.ok) return run(saved);
                      run(actions.submitQuotation(draft.quoteId), needsApproval && draft.approval.state !== "da-duyet" ? "Đã gửi duyệt" : "Đã gửi báo giá cho khách");
                    }}
                  >
                    {needsApproval && stored.approval.state !== "da-duyet" ? "Gửi duyệt" : "Gửi khách"}
                  </Button>
                </div>
              )}
              {stored.status === "cho-duyet" && (
                isReviewer ? (
                  <div className="space-y-2">
                    <Textarea aria-label="Ghi chú duyệt" rows={2} placeholder="Ghi chú (bắt buộc khi từ chối)" value={note} onChange={(e) => setNote(e.target.value)} />
                    <div className="flex gap-2">
                      <Button onClick={() => run(actions.reviewQuotation(stored.quoteId, true, note), "Đã duyệt (mô phỏng), Sale có thể gửi khách")}>Duyệt</Button>
                      <Button variant="destructive" onClick={() => run(actions.reviewQuotation(stored.quoteId, false, note))}>Từ chối</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Đang chờ Trưởng phòng Sale hoặc Ban GĐ duyệt (mô phỏng).</p>
                )
              )}
              {stored.status === "da-gui" && can("quote.write") && (
                <div className="space-y-2">
                  <Textarea aria-label="Phản hồi của khách" rows={2} placeholder="Phản hồi của khách (bắt buộc khi từ chối)" value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="flex gap-2">
                    <Button onClick={() => run(actions.recordQuoteResponse(stored.quoteId, true, note), "Đã ghi nhận khách chấp nhận")}>Khách chấp nhận</Button>
                    <Button variant="destructive" onClick={() => run(actions.recordQuoteResponse(stored.quoteId, false, note))}>Khách từ chối</Button>
                  </div>
                </div>
              )}
              {stored.status === "chap-nhan" &&
                (contract ? (
                  <p className="text-sm">
                    Đã có hợp đồng{" "}
                    <Link href={`/crm/hop-dong/${contract.orderId}`} className="font-mono text-primary hover:underline">
                      {contract.orderId}
                    </Link>
                  </p>
                ) : can("contract.write") ? (
                  <Button
                    onClick={() => {
                      const r = actions.createContractFromQuote(stored.quoteId);
                      if (r.ok && r.id) router.push(`/crm/hop-dong/${r.id}`);
                      else run(r);
                    }}
                  >
                    Tạo hợp đồng
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">Khách đã chấp nhận. Sale tạo hợp đồng ở bước tiếp theo.</p>
                ))}
              {stored.status === "tu-choi" && <p className="text-sm text-muted-foreground">Khách đã từ chối. Có thể soạn báo giá mới từ RFQ nếu khách quay lại.</p>}
              <p className="text-xs text-muted-foreground">Phụ trách: {staffName(stored.ownerId)}</p>
            </div>
          </SectionCard>
        </div>

        <div className={cn("xl:sticky xl:top-24 xl:self-start", view === "edit" && "hidden xl:block")}>
          <QuotationPreview quote={draft} customer={customer} rfq={rfq} ownerName={staffName(stored.ownerId)} />
        </div>
      </div>
    </>
  );
}
