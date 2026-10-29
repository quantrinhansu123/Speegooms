"use client";

import { AlarmClock, ArrowLeft, Check, HandCoins, Inbox, Plus, Send, X, RefreshCw } from "lucide-react";

import { useState } from "react";
import Link from "next/link";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { EmptyState } from "@/components/shared/empty-state";
import { ListView } from "@/components/shared/list-view";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CRM_TODAY, roleRouteScope } from "@/config/crm";
import { complaintStatusLabels as statuses } from "@/config/backoffice";
import { canAccess } from "@/config/roles";
import { useBackoffice } from "@/features/backoffice/hooks";
import { FormDialog } from "@/features/backoffice/form-dialog";
import { useOps } from "@/features/operations/hooks";
import { HistoryList } from "@/features/operations/components/history-list";
import { formatDate, formatVnd } from "@/lib/format";
import users from "@/mocks/users.json";
import { canApprove, canWrite, categories, complaintTransitions, priorities } from "@/services/backoffice/rules";
import type { Complaint, TicketStatus } from "@/types/backoffice";

const compensationLabels = { chua: "Chưa đề xuất", "cho-duyet": "Chờ duyệt", "da-duyet": "Đã duyệt mô phỏng", "tu-choi": "Từ chối" };
const handlers = users.filter((u) => u.role === "van-hanh");
function useComplaints() {
  const backoffice = useBackoffice();
  const ops = useOps();
  const scope = roleRouteScope[backoffice.user.role];
  const contracts = ops.crm.contracts.filter((c) => !scope || c.route === scope);
  const ids = new Set(contracts.map((c) => c.orderId));
  return { ...backoffice, ops, contracts, tickets: backoffice.data.complaints.filter((c) => ids.has(c.orderId)) };
}
function TicketBadge({ ticket }: { ticket: Complaint }) {
  return <StatusBadge tone={ticket.status === "hoan-tat" ? "success" : ticket.status === "moi" ? "neutral" : "info"}>{statuses[ticket.status]}</StatusBadge>;
}

export function ComplaintsView() {
  const { tickets, contracts, ops, actions, user } = useComplaints();
  const [open, setOpen] = useState(false);
  const writable = canWrite(user.role, "complaints") || canWrite(user.role, "feedback");
  return <>
    <ListView dateValue={(r) => r.history[0]?.at} title="Khiếu nại" description="Theo dõi sự cố theo đơn hàng, người xử lý và thời hạn. SLA và trách nhiệm xử lý là đề xuất." rows={tickets} getRowId={(c) => c.id} searchLabel="Tìm khiếu nại" searchPlaceholder="Mã ticket, đơn hàng, nội dung…" searchText={(c) => [c.id, c.orderId, c.title, c.description]}
      actions={writable && <Button disabled={!ops.ready || !contracts.length} onClick={() => setOpen(true)}><Plus /> Tạo khiếu nại</Button>}
      summary={<div className="mb-6 grid gap-4 sm:grid-cols-3"><StatCard label="Đang mở" icon={Inbox} value={String(tickets.filter((t) => t.status !== "hoan-tat").length)} /><StatCard label="Quá hạn" icon={AlarmClock} value={String(tickets.filter((t) => t.status !== "hoan-tat" && t.dueOn < CRM_TODAY).length)} caption="Theo ngày demo 28/10/2026" /><StatCard label="Chờ duyệt đền bù" icon={HandCoins} value={String(tickets.filter((t) => t.compensation.status === "cho-duyet").length)} caption="Mô phỏng, chưa phát sinh chi tiền" /></div>}
      filters={[
        { id: "status", label: "Mọi trạng thái", options: Object.entries(statuses).map(([value, label]) => ({ value, label })), match: (c, v) => c.status === v },
        { id: "priority", label: "Mọi mức ưu tiên", options: priorities.map((p) => ({ value: p, label: p })), match: (c, v) => c.priority === v },
        { id: "category", label: "Mọi loại sự cố", options: categories.map((p) => ({ value: p, label: p })), match: (c, v) => c.category === v },
      ]} toggles={[{ id: "overdue", label: "Chỉ quá hạn", match: (c) => c.status !== "hoan-tat" && c.dueOn < CRM_TODAY }]}
      columns={[
        { key: "title", header: "Ticket / Đơn hàng", cell: (c) => <div><Link className="font-medium text-primary hover:underline" href={`/khieu-nai/${c.id}`}>{c.title}</Link><p className="text-xs text-muted-foreground">{c.id} · {c.orderId}</p></div> },
        { key: "category", header: "Sự cố", cell: (c) => c.category },
        { key: "priority", header: "Ưu tiên", cell: (c) => <StatusBadge tone={c.priority === "Khẩn cấp" ? "danger" : c.priority === "Cao" ? "warning" : "neutral"}>{c.priority}</StatusBadge> },
        { key: "who", header: "Người xử lý", cell: (c) => ops.staffName(c.assigneeId) },
        { key: "due", header: "Thời hạn", cell: (c) => <div>{formatDate(c.dueOn)}{c.status !== "hoan-tat" && c.dueOn < CRM_TODAY && <p className="text-xs text-danger">Quá hạn</p>}</div> },
        { key: "status", header: "Trạng thái", cell: (c) => <TicketBadge ticket={c} /> },
      ]} />
    {open && <FormDialog title="Tạo khiếu nại" description="Liên kết đơn hàng đang có trong CRM. Thời hạn do người tạo chọn, chưa áp dụng SLA tự động." onClose={() => setOpen(false)} onSave={(f) => actions.createComplaint(user, Object.fromEntries(f))}>
      <Field label="Đơn hàng" htmlFor="kn-order" required><NativeSelect id="kn-order" name="orderId" required>{contracts.map((c) => <option key={c.orderId} value={c.orderId}>{c.orderId} · {ops.crm.customers.find((x) => x.customerId === c.customerId)?.name}</option>)}</NativeSelect></Field>
      <Field label="Tiêu đề" htmlFor="kn-title" required><Input id="kn-title" name="title" required maxLength={160} /></Field>
      <Field label="Mô tả sự cố" htmlFor="kn-description" required><Textarea id="kn-description" name="description" rows={3} required maxLength={2000} /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Loại sự cố" htmlFor="kn-category"><NativeSelect id="kn-category" name="category">{categories.map((c) => <option key={c}>{c}</option>)}</NativeSelect></Field><Field label="Ưu tiên" htmlFor="kn-priority"><NativeSelect id="kn-priority" name="priority">{priorities.map((p) => <option key={p}>{p}</option>)}</NativeSelect></Field></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Người xử lý" htmlFor="kn-assignee"><NativeSelect id="kn-assignee" name="assigneeId">{handlers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</NativeSelect></Field><Field label="Thời hạn" htmlFor="kn-due" required><Input id="kn-due" name="dueOn" type="date" defaultValue="2026-10-30" min={CRM_TODAY} required /></Field></div>
      <Field label="Mô tả bằng chứng" htmlFor="kn-evidence" hint="Chỉ lưu mô tả/tên tệp tham chiếu trong demo; chưa tải tệp lên."><Textarea id="kn-evidence" name="evidence" maxLength={2000} /></Field>
    </FormDialog>}
  </>;
}

function ComplaintEditor({ ticket }: { ticket: Complaint }) {
  const { actions, user } = useBackoffice();
  const [status, setStatus] = useState(ticket.status);
  const [result, setResult] = useState(ticket.result);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  return <SectionCard title="Xử lý ticket" description="Lưu trạng thái, phân công, bằng chứng và kết quả vào timeline">
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const error = actions.updateComplaint(user, ticket.id, { assigneeId: String(f.get("assigneeId")), dueOn: String(f.get("dueOn")), status, result, note: String(f.get("note")), evidence: String(f.get("evidence")) });
      setMessage(error); setSaved(!error);
      if (!error) { (e.currentTarget.elements.namedItem("note") as HTMLTextAreaElement).value = ""; (e.currentTarget.elements.namedItem("evidence") as HTMLTextAreaElement).value = ""; }
    }}>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Người xử lý" htmlFor="edit-assignee"><NativeSelect id="edit-assignee" name="assigneeId" defaultValue={ticket.assigneeId}>{handlers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</NativeSelect></Field><Field label="Thời hạn" htmlFor="edit-due"><Input id="edit-due" name="dueOn" type="date" defaultValue={ticket.dueOn} required /></Field></div>
      <Field label="Trạng thái" htmlFor="edit-status"><NativeSelect id="edit-status" value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)}>{[ticket.status, ...complaintTransitions[ticket.status]].map((s) => <option key={s} value={s}>{statuses[s]}</option>)}</NativeSelect></Field>
      <Field label="Ghi chú xử lý" htmlFor="edit-note"><Textarea id="edit-note" name="note" maxLength={2000} /></Field>
      <Field label="Thêm bằng chứng" htmlFor="edit-evidence" hint="Mô tả bằng chứng hoặc tên tệp; không tải lên dịch vụ ngoài."><Textarea id="edit-evidence" name="evidence" maxLength={2000} /></Field>
      <Field label="Kết quả" htmlFor="edit-result" required={status === "hoan-tat"}><Textarea id="edit-result" value={result} onChange={(e) => setResult(e.target.value)} maxLength={2000} required={status === "hoan-tat"} /></Field>
      {message && <InlineAlert>{message}</InlineAlert>}{saved && !message && <InlineAlert tone="success">Đã lưu xử lý ticket.</InlineAlert>}
      <Button type="submit"><RefreshCw aria-hidden /> Lưu xử lý</Button>
    </form>
  </SectionCard>;
}

function CompensationCard({ ticket }: { ticket: Complaint }) {
  const { user, actions } = useBackoffice();
  const [message, setMessage] = useState<string | null>(null);
  const [decision, setDecision] = useState("");
  return <SectionCard title="Đề xuất đền bù · mô phỏng" description="Vận hành đề xuất → Ban Giám đốc duyệt/trả lại. Chưa phải quy trình chính thức; không tạo phiếu chi.">
    <div className="mb-4 flex flex-wrap items-center gap-3"><StatusBadge tone={ticket.compensation.status === "cho-duyet" ? "warning" : "neutral"}>{compensationLabels[ticket.compensation.status]}</StatusBadge><strong>{formatVnd(ticket.compensation.amount)}</strong></div>
    {ticket.compensation.reason && <p className="mb-4 whitespace-pre-wrap text-sm">{ticket.compensation.reason}</p>}
    {canWrite(user.role, "complaints") && !["moi", "hoan-tat"].includes(ticket.status) && ["chua", "tu-choi"].includes(ticket.compensation.status) && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); setMessage(actions.proposeCompensation(user, ticket.id, { amount: Number(f.get("amount")), reason: String(f.get("reason")) })); }}>
      <Field label="Số tiền đề xuất (VND)" htmlFor="comp-amount" required><Input id="comp-amount" name="amount" type="number" min="1" max="1000000000000" step="1" required /></Field>
      <Field label="Căn cứ đề xuất" htmlFor="comp-reason" required><Textarea id="comp-reason" name="reason" maxLength={2000} required /></Field><Button type="submit" variant="outline"><Send /> Gửi đề xuất đền bù</Button>
    </form>}
    {canApprove(user.role) && ticket.compensation.status === "cho-duyet" && <div className="space-y-3">
      <Field label="Lý do quyết định" htmlFor="comp-decision" required><Textarea id="comp-decision" value={decision} onChange={(e) => setDecision(e.target.value)} maxLength={2000} /></Field>
      <div className="flex flex-wrap gap-2"><Button onClick={() => setMessage(actions.decideCompensation(user, ticket.id, true, decision))}><Check /> Duyệt mô phỏng</Button><Button variant="outline" onClick={() => setMessage(actions.decideCompensation(user, ticket.id, false, decision))}><X /> Từ chối</Button></div>
    </div>}
    {message && <InlineAlert className="mt-3">{message}</InlineAlert>}
  </SectionCard>;
}

export function ComplaintDetail({ id }: { id: string }) {
  const { tickets, ops, user } = useComplaints();
  const ticket = tickets.find((c) => c.id === id);
  if (!ops.ready) return <p role="status">Đang tải đơn hàng…</p>;
  if (!ticket) return <EmptyState title="Không tìm thấy ticket trong phạm vi truy cập" action={<Link href="/khieu-nai">Về danh sách</Link>} />;
  return <>
    <PageHeader title={ticket.title} description={`${ticket.id} · ${ticket.orderId} · ${ticket.category}`} actions={<TicketBadge ticket={ticket} />} />
    <div className="mb-6 flex flex-wrap gap-4 text-sm"><Link href="/khieu-nai" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft aria-hidden className="size-4" /> Danh sách khiếu nại</Link>{canAccess(user.role, "/van-hanh/don-hang") && <Link href={`/van-hanh/don-hang/${ticket.orderId}`} className="text-sm text-primary transition-colors hover:text-primary/70">Xem đơn hàng</Link>}</div>
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-6"><SectionCard title="Thông tin sự cố"><p className="mb-4 whitespace-pre-wrap text-sm">{ticket.description}</p><dl className="grid grid-cols-2 gap-3 text-sm"><dt className="text-muted-foreground">Người xử lý</dt><dd>{ops.staffName(ticket.assigneeId)}</dd><dt className="text-muted-foreground">Thời hạn</dt><dd>{formatDate(ticket.dueOn)}</dd><dt className="text-muted-foreground">Ưu tiên</dt><dd>{ticket.priority}</dd><dt className="text-muted-foreground">Kết quả</dt><dd className="whitespace-pre-wrap">{ticket.result || "Chưa có kết quả"}</dd></dl></SectionCard>
        {canWrite(user.role, "complaints") && ticket.status !== "hoan-tat" && <ComplaintEditor key={`${ticket.id}-${ticket.status}`} ticket={ticket} />}
        <SectionCard title="Bằng chứng" description="Tham chiếu dạng văn bản; chưa có lưu trữ tệp"><ul className="space-y-2 text-sm">{ticket.evidence.map((s, i) => <li key={i} className="break-words rounded-lg bg-muted p-3">{s}</li>)}</ul>{!ticket.evidence.length && <p className="text-sm text-muted-foreground">Chưa có bằng chứng.</p>}</SectionCard>
      </div>
      <div className="space-y-6"><CompensationCard ticket={ticket} /><HistoryList title="Timeline xử lý" entries={ticket.history} staffName={ops.staffName} /></div>
    </div>
  </>;
}
