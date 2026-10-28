"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarPlus, Check, FilePlus2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { CRM_TODAY, careStatusMeta, lostReasonLabels, originLabels, routeLabels, temperatureMeta } from "@/config/crm";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { routeFromOrigin, staffOfRoute } from "@/services/crm/rules";
import type { CareStatus, GoodsOrigin, Temperature } from "@/types/crm";
import { useCrm } from "../hooks";
import { ChainTrace } from "./chain-trace";
import { InteractionTimeline } from "./interaction-timeline";
import { LeadProfileForm } from "./lead-profile-form";
import { LostReasonDialog } from "./lost-reason-dialog";
import { CareBadge, RfqBadge, SourceTag, TemperatureBadge } from "./meta-badges";
import { RfqCreateDialog } from "./rfq-create-dialog";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words">{children}</dd>
    </div>
  );
}

export function LeadDetail({ messId }: { messId: string }) {
  const { data, all, actions, can, staffName } = useCrm();
  const router = useRouter();
  const [lostOpen, setLostOpen] = useState(false);
  const [rfqOpen, setRfqOpen] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState(CRM_TODAY);
  const [reopenNote, setReopenNote] = useState("");

  const lead = data.leads.find((l) => l.messId === messId);
  if (!lead) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState
          title="Không tìm thấy lead"
          description="Lead không tồn tại hoặc không thuộc phạm vi tuyến của bạn."
          action={
            <Link href="/crm/leads" className="text-sm font-medium text-primary hover:underline">
              Về danh sách lead
            </Link>
          }
        />
      </div>
    );
  }

  const writable = can("lead.write");
  const lost = lead.careStatus === "mat";
  const route = routeFromOrigin(lead.goodsOrigin);
  const customer = all.customers.find((c) => c.customerId === lead.customerId);
  const rfqs = all.rfqs.filter((r) => r.messId === messId);
  const contract = all.contracts.find((c) => rfqs.some((r) => r.rfqId === c.rfqId) && c.status !== "huy");
  const teamStaff = route ? staffOfRoute(all.staff, route) : all.staff.filter((s) => s.team === "sale-vn" || s.team === "sale-global");
  const result = (r: { ok: boolean; error?: string }) => setNotice(r.ok ? undefined : r.error);

  const changeOrigin = (origin: GoodsOrigin) => {
    result(actions.updateLead(messId, { goodsOrigin: origin }));
    const newRoute = routeFromOrigin(origin);
    // Đổi tuyến thì chuyển người phụ trách sang đúng nhóm Sale
    if (newRoute && !staffOfRoute(all.staff, newRoute).some((s) => s.id === lead.ownerId)) {
      const next = staffOfRoute(all.staff, newRoute)[0];
      if (next) actions.assignOwner(messId, next.id);
    }
  };

  return (
    <>
      <Link href="/crm/leads" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Danh sách lead
      </Link>

      <div className="mb-6 rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-primary">{lead.contactName}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{lead.company}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <TemperatureBadge value={lead.temperature} />
              <CareBadge value={lead.careStatus} />
              <SourceTag source={lead.source} />
            </div>
          </div>
          {writable && (
            <div className="flex flex-wrap items-center gap-2">
              {!lost && (
                <div role="group" aria-label="Phân loại lead" className="inline-flex rounded-lg bg-muted p-0.5">
                  {(Object.keys(temperatureMeta) as Temperature[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={lead.temperature === t}
                      onClick={() => result(actions.setTemperature(messId, t))}
                      className={cn("h-8 rounded-md px-3 text-sm font-medium", lead.temperature === t ? "bg-surface text-primary shadow-xs" : "text-muted-foreground hover:text-foreground")}
                    >
                      {temperatureMeta[t].label}
                    </button>
                  ))}
                </div>
              )}
              {!lost && can("rfq.write") && (
                <Button size="lg" disabled={lead.temperature !== "hot"} onClick={() => setRfqOpen(true)} title={lead.temperature !== "hot" ? "Chuyển lead sang Hot trước khi tạo RFQ" : undefined}>
                  <FilePlus2 /> Tạo RFQ
                </Button>
              )}
              {!lost && (
                <Button size="lg" variant="destructive" onClick={() => setLostOpen(true)}>
                  <XCircle /> Mất khách
                </Button>
              )}
            </div>
          )}
        </div>
        <ChainTrace className="mt-4" messId={lead.messId} rfqId={rfqs[0]?.rfqId} orderId={contract?.orderId} customerId={lead.customerId} />
      </div>

      {notice && (
        <InlineAlert tone="warning" className="mb-4">
          {notice}
        </InlineAlert>
      )}

      {lost && (
        <InlineAlert className="mb-4">
          <p className="font-medium">Đã mất khách. Lý do: {lead.lostReason ? lostReasonLabels[lead.lostReason] : "—"}</p>
          {lead.lostNote && <p className="mt-0.5">{lead.lostNote}</p>}
          {writable && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input aria-label="Lý do mở lại lead" className="h-8 max-w-sm bg-surface" placeholder="Lý do mở lại (khách quay lại, thay đổi nhu cầu…)" value={reopenNote} onChange={(e) => setReopenNote(e.target.value)} />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const r = actions.reopenLead(messId, reopenNote);
                  result(r);
                  if (r.ok) setReopenNote("");
                }}
              >
                <RotateCcw /> Mở lại lead
              </Button>
            </div>
          )}
        </InlineAlert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Nhu cầu" description="Tóm tắt nhu cầu khách nêu">
            <p className="text-sm">{lead.needSummary || "Chưa ghi nhu cầu."}</p>
          </SectionCard>
          <LeadProfileForm key={lead.messId} lead={lead} />
          <InteractionTimeline messId={messId} />
        </div>

        <div className="space-y-6">
          <SectionCard title="Hồ sơ khách hàng">
            <dl className="divide-y">
              <InfoRow label="Mã khách">
                <Link href={`/crm/khach-hang/${lead.customerId}`} className="font-mono text-primary hover:underline">
                  {lead.customerId}
                </Link>
              </InfoRow>
              <InfoRow label="Công ty">{customer?.name ?? lead.company}</InfoRow>
              <InfoRow label="Điện thoại">{lead.phone}</InfoRow>
              <InfoRow label="Email">{lead.email || "—"}</InfoRow>
              <InfoRow label="Ngày tạo lead">{formatDate(lead.createdAt)}</InfoRow>
            </dl>
          </SectionCard>

          <SectionCard title="Nguồn và phân tuyến" description="Xuất xứ hàng quyết định Sale Việt Nam hay Sale Global">
            <dl className="divide-y">
              <InfoRow label="Nguồn lead">
                <SourceTag source={lead.source} />
              </InfoRow>
              <InfoRow label="Phân tuyến">{route ? routeLabels[route] : "Chưa phân tuyến"}</InfoRow>
            </dl>
            {writable && (
              <Field label="Xuất xứ hàng" htmlFor="ld-origin" className="mt-3" hint={route ? undefined : "Chưa rõ xuất xứ: cần xác định trước khi tạo RFQ"}>
                <NativeSelect id="ld-origin" value={lead.goodsOrigin} onChange={(e) => changeOrigin(e.target.value as GoodsOrigin)}>
                  {(Object.keys(originLabels) as GoodsOrigin[]).map((o) => (
                    <option key={o} value={o}>
                      {originLabels[o]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
          </SectionCard>

          <SectionCard title="Phụ trách và chăm sóc">
            <div className="space-y-3">
              <Field label="Nhân viên phụ trách" htmlFor="ld-owner">
                <NativeSelect id="ld-owner" disabled={!writable} value={lead.ownerId} onChange={(e) => result(actions.assignOwner(messId, e.target.value))}>
                  {teamStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  {!teamStaff.some((s) => s.id === lead.ownerId) && <option value={lead.ownerId}>{staffName(lead.ownerId)}</option>}
                </NativeSelect>
              </Field>
              {!lost && lead.careStatus !== "da-co-rfq" && (
                <Field label="Trạng thái chăm sóc" htmlFor="ld-care">
                  <NativeSelect id="ld-care" disabled={!writable} value={lead.careStatus} onChange={(e) => result(actions.setCareStatus(messId, e.target.value as CareStatus))}>
                    {(["moi", "dang-cham", "ngu-dong"] as CareStatus[]).map((c) => (
                      <option key={c} value={c}>
                        {careStatusMeta[c].label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Công việc tiếp theo">
            {lead.nextTask && !lead.nextTask.done ? (
              <div className="space-y-2">
                <p className={cn("text-sm font-medium", lead.nextTask.dueOn < CRM_TODAY && "text-danger")}>{lead.nextTask.title}</p>
                <p className="text-xs text-muted-foreground">
                  Hạn {formatDate(lead.nextTask.dueOn)}
                  {lead.nextTask.dueOn < CRM_TODAY && " · Quá hạn"}
                </p>
                {writable && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      actions.addInteraction(messId, "note", `Hoàn thành việc: ${lead.nextTask!.title}`);
                      actions.setNextTask(messId, undefined);
                    }}
                  >
                    <Check /> Đánh dấu hoàn thành
                  </Button>
                )}
              </div>
            ) : (
              <p className="mb-3 text-sm text-muted-foreground">Chưa có việc tiếp theo.</p>
            )}
            {writable && !lost && (
              <form
                className="mt-3 space-y-2 border-t pt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!taskTitle.trim()) return;
                  result(actions.setNextTask(messId, { title: taskTitle.trim(), dueOn: taskDue, done: false }));
                  setTaskTitle("");
                }}
              >
                <Input aria-label="Tên công việc tiếp theo" placeholder="Việc cần làm tiếp" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
                <div className="flex gap-2">
                  <Input aria-label="Hạn công việc" type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
                  <Button type="submit" variant="outline">
                    <CalendarPlus /> {lead.nextTask && !lead.nextTask.done ? "Thay việc" : "Đặt việc"}
                  </Button>
                </div>
              </form>
            )}
          </SectionCard>

          <SectionCard title="RFQ của lead này">
            {rfqs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có RFQ. Chuyển lead sang Hot rồi tạo RFQ.</p>
            ) : (
              <ul className="space-y-2">
                {rfqs.map((r) => (
                  <li key={r.rfqId} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/crm/rfq/${r.rfqId}`} className="font-mono text-primary hover:underline">
                      {r.rfqId}
                    </Link>
                    <RfqBadge value={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      <LostReasonDialog messId={messId} open={lostOpen} onOpenChange={setLostOpen} />
      {rfqOpen && <RfqCreateDialog open onOpenChange={(o) => !o && setRfqOpen(false)} presetMessId={messId} onCreated={(id) => router.push(`/crm/rfq/${id}`)} />}
    </>
  );
}
