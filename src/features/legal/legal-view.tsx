"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { ListView } from "@/components/shared/list-view";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CRM_TODAY } from "@/config/crm";
import { legalStatusLabels as statuses } from "@/config/backoffice";
import { useBackoffice } from "@/features/backoffice/hooks";
import { FormDialog } from "@/features/backoffice/form-dialog";
import { useOps } from "@/features/operations/hooks";
import { HistoryList } from "@/features/operations/components/history-list";
import { formatDate } from "@/lib/format";
import users from "@/mocks/users.json";
import { canApprove, canWrite, legalTransitions } from "@/services/backoffice/rules";
import type { LegalTicket } from "@/types/backoffice";

const legalStaff = users.filter((u) => u.role === "phap-che");
function LegalBadge({ status }: { status: LegalTicket["status"] }) {
  return <StatusBadge tone={status === "da-duyet" ? "success" : status === "tra-lai" ? "danger" : status === "cho-duyet" ? "warning" : "info"}>{statuses[status]}</StatusBadge>;
}

function LegalRequestForm({ initial, onClose }: { initial?: { refId: string; refType: LegalTicket["refType"] }; onClose: () => void }) {
  const { user, actions } = useBackoffice();
  const { crm, ops } = useOps();
  const [refType, setRefType] = useState<LegalTicket["refType"]>(initial?.refType ?? "hop-dong");
  const refs = refType === "hop-dong" ? crm.contracts.map((c) => ({ id: c.orderId, label: `${c.contractNo} · ${c.orderId}` })) : ops.documents.map((d) => ({ id: d.docId, label: `${d.docId} · ${d.fileName ?? d.type} · ${d.orderId}` }));
  return <FormDialog title="Yêu cầu ý kiến pháp lý" description="Luồng đề xuất: tiếp nhận → rà soát → chờ Ban Giám đốc duyệt → duyệt hoặc trả lại. Không thay đổi trạng thái hợp đồng/chứng từ gốc." onClose={onClose} onSave={(f) => actions.createLegal(user, { ...Object.fromEntries(f), refType })}>
    <Field label="Tiêu đề" htmlFor="pl-title" required><Input id="pl-title" name="title" required maxLength={160} /></Field>
    <Field label="Loại hồ sơ" htmlFor="pl-type"><NativeSelect id="pl-type" value={refType} onChange={(e) => setRefType(e.target.value as LegalTicket["refType"])}><option value="hop-dong">Hợp đồng</option><option value="chung-tu">Chứng từ</option></NativeSelect></Field>
    <Field label="Hồ sơ liên quan" htmlFor="pl-ref" required><NativeSelect key={refType} id="pl-ref" name="refId" required defaultValue={initial?.refType === refType ? initial.refId : undefined}>{refs.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</NativeSelect></Field>
    <Field label="Nội dung cần tư vấn / rà soát" htmlFor="pl-request" required><Textarea id="pl-request" name="request" maxLength={2000} rows={4} required /></Field>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Người xử lý" htmlFor="pl-handler"><NativeSelect id="pl-handler" name="assigneeId">{legalStaff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</NativeSelect></Field><Field label="Thời hạn" htmlFor="pl-due" required><Input id="pl-due" name="dueOn" type="date" defaultValue="2026-10-30" min={CRM_TODAY} required /></Field></div>
  </FormDialog>;
}

export function LegalReviewsView() {
  const { data, user } = useBackoffice();
  const { crm, ops, ready } = useOps();
  const [creating, setCreating] = useState<{ refId: string; refType: LegalTicket["refType"] }>();
  const rows = [
    ...crm.contracts.filter((c) => c.status !== "huy").map((c) => ({ id: c.orderId, name: c.contractNo, type: "hop-dong" as const, orderId: c.orderId, originStatus: c.status === "da-ky" ? "Đã ký" : "Soạn thảo" })),
    ...ops.documents.map((d) => ({ id: d.docId, name: d.fileName ?? d.type, type: "chung-tu" as const, orderId: d.orderId, originStatus: d.status === "da-duyet" ? "Đã duyệt chứng từ" : d.status === "thieu" ? "Thiếu chứng từ" : d.status === "tu-choi" ? "Từ chối chứng từ" : "Chờ duyệt chứng từ" })),
  ].map((r) => ({ ...r, ticket: data.legal.find((t) => t.refType === r.type && t.refId === r.id) }));
  return <>
    <ListView title="Hồ sơ cần rà soát pháp lý" description="Hợp đồng và chứng từ đọc từ CRM/Vận hành. Chưa có tiêu chí tự động xác định hồ sơ bắt buộc rà soát; danh mục dưới đây là đề xuất." rows={ready ? rows : []} getRowId={(r) => `${r.type}-${r.id}`} searchLabel="Tìm hồ sơ pháp lý" searchPlaceholder="Số hợp đồng, chứng từ, đơn hàng…" searchText={(r) => [r.id, r.name, r.orderId]}
      filters={[{ id: "type", label: "Mọi loại hồ sơ", options: [{ value: "hop-dong", label: "Hợp đồng" }, { value: "chung-tu", label: "Chứng từ" }], match: (r, v) => r.type === v }]}
      toggles={[{ id: "pending", label: "Chưa hoàn tất rà soát", match: (r) => r.ticket?.status !== "da-duyet", initial: true }]}
      banner={!ready && <p role="status" className="mb-4 text-sm">Đang tải hồ sơ liên quan…</p>}
      columns={[
        { key: "name", header: "Hồ sơ", cell: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.id} · {r.orderId}</p></div> },
        { key: "type", header: "Loại", cell: (r) => r.type === "hop-dong" ? "Hợp đồng" : "Chứng từ" },
        { key: "origin", header: "Trạng thái gốc", cell: (r) => r.originStatus },
        { key: "review", header: "Rà soát pháp lý", cell: (r) => r.ticket ? <LegalBadge status={r.ticket.status} /> : <StatusBadge>Chưa có yêu cầu</StatusBadge> },
        { key: "action", header: "Thao tác", cell: (r) => r.ticket ? <Link href={`/phap-che/yeu-cau/${r.ticket.id}`} className="text-primary hover:underline">Xem ticket</Link> : canWrite(user.role, "legal") ? <Button size="sm" variant="outline" onClick={() => setCreating({ refId: r.id, refType: r.type })}>Yêu cầu rà soát</Button> : "—" },
      ]} />
    {creating && <LegalRequestForm initial={creating} onClose={() => setCreating(undefined)} />}
  </>;
}

export function LegalTicketsView() {
  const { data, user } = useBackoffice();
  const { ready, staffName } = useOps();
  const [open, setOpen] = useState(false);
  return <>
    <ListView title="Yêu cầu ý kiến pháp lý" description="Phân công, thời hạn và lịch sử phê duyệt riêng cho từng yêu cầu. Phê duyệt ở đây chỉ là mô phỏng." rows={data.legal} getRowId={(t) => t.id} searchLabel="Tìm ticket pháp lý" searchPlaceholder="Mã yêu cầu, nội dung, hồ sơ…" searchText={(t) => [t.id, t.title, t.refId, t.request]} actions={canWrite(user.role, "legal") && <Button disabled={!ready} onClick={() => setOpen(true)}>Tạo yêu cầu</Button>}
      filters={[{ id: "status", label: "Mọi trạng thái", options: Object.entries(statuses).map(([value, label]) => ({ value, label })), match: (t, v) => t.status === v }]}
      columns={[
        { key: "title", header: "Yêu cầu", cell: (t) => <div><Link className="font-medium text-primary hover:underline" href={`/phap-che/yeu-cau/${t.id}`}>{t.title}</Link><p className="text-xs text-muted-foreground">{t.id} · {t.refId}</p></div> },
        { key: "who", header: "Người xử lý", cell: (t) => staffName(t.assigneeId) },
        { key: "due", header: "Thời hạn", cell: (t) => <div>{formatDate(t.dueOn)}{t.status !== "da-duyet" && t.dueOn < CRM_TODAY && <p className="text-xs text-danger">Quá hạn</p>}</div> },
        { key: "status", header: "Trạng thái", cell: (t) => <LegalBadge status={t.status} /> },
      ]} />
    {open && <LegalRequestForm onClose={() => setOpen(false)} />}
  </>;
}

export function LegalTicketDetail({ id }: { id: string }) {
  const { data, user, actions } = useBackoffice();
  const { staffName } = useOps();
  const ticket = data.legal.find((t) => t.id === id);
  const [opinion, setOpinion] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  if (!ticket) return <EmptyState title="Không tìm thấy yêu cầu" action={<Link href="/phap-che/yeu-cau">Về danh sách</Link>} />;
  const next = legalTransitions[ticket.status].filter((s) => s === "da-duyet" || s === "tra-lai" ? canApprove(user.role) : canWrite(user.role, "legal"));
  return <>
    <PageHeader title={ticket.title} description={`${ticket.id} · Hồ sơ ${ticket.refId} · Hạn ${formatDate(ticket.dueOn)}`} actions={<LegalBadge status={ticket.status} />} />
    <Link href="/phap-che/yeu-cau" className="mb-6 inline-block text-sm text-primary hover:underline">← Danh sách yêu cầu</Link>
    <div className="grid gap-6 lg:grid-cols-2"><div className="space-y-6"><SectionCard title="Nội dung yêu cầu" description={`Người xử lý: ${staffName(ticket.assigneeId)}`}><p className="whitespace-pre-wrap text-sm">{ticket.request}</p><p className="mt-4 text-sm font-medium">Ý kiến gần nhất</p><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{ticket.opinion || "Chưa có ý kiến"}</p></SectionCard>
      {next.length > 0 && <SectionCard title="Xử lý & phê duyệt · đề xuất" description="Pháp chế rà soát và trình duyệt; Ban Giám đốc duyệt hoặc trả lại có lý do.">
        <Field label="Ý kiến / lý do quyết định" htmlFor="legal-opinion" required><Textarea id="legal-opinion" value={opinion} onChange={(e) => setOpinion(e.target.value)} rows={5} maxLength={2000} /></Field>
        {message && <InlineAlert className="mt-3">{message}</InlineAlert>}
        <div className="mt-4 flex flex-wrap gap-2">{next.map((s) => <Button key={s} variant={s === "tra-lai" ? "outline" : "default"} onClick={() => { const error = actions.updateLegal(user, id, s, opinion); setMessage(error); if (!error) setOpinion(""); }}>{s === "dang-ra-soat" ? "Tiếp nhận rà soát" : s === "cho-duyet" ? "Trình duyệt" : s === "da-duyet" ? "Duyệt mô phỏng" : "Trả lại"}</Button>)}</div>
      </SectionCard>}
    </div><HistoryList title="Lịch sử xử lý & phê duyệt" entries={ticket.history} staffName={staffName} /></div>
  </>;
}
