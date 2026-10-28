"use client";

import { useState } from "react";
import Link from "next/link";
import { Megaphone, Target, Users, ShoppingBag } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { ListView } from "@/components/shared/list-view";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { activeSources, CRM_TODAY, sourceLabels } from "@/config/crm";
import { canAccess } from "@/config/roles";
import { useBackoffice } from "@/features/backoffice/hooks";
import { FormDialog } from "@/features/backoffice/form-dialog";
import { useCrm } from "@/features/crm/hooks";
import { formatDate, formatNumber, formatVnd } from "@/lib/format";
import { canWrite, qualityOptions, sourceMetrics } from "@/services/backoffice/rules";
import type { Campaign, LeadFeedback } from "@/types/backoffice";
import type { LeadSource } from "@/types/crm";

export function MarketingDashboard({ conversion = false }: { conversion?: boolean }) {
  const { all, ready } = useCrm();
  const [from, setFrom] = useState("2026-07-01");
  const [to, setTo] = useState(CRM_TODAY);
  const valid = !!from && !!to && from <= to;
  const rows = valid ? sourceMetrics(all.leads, all.rfqs, all.contracts, from, to) : [];
  const total = rows.reduce((s, r) => ({ leads: s.leads + r.leads, rfq: s.rfq + r.rfq, orders: s.orders + r.orders }), { leads: 0, rfq: 0, orders: 0 });
  return <>
    <PageHeader title={conversion ? "Chuyển đổi & hiệu quả nguồn lead" : "Marketing"} description="Theo dõi cùng một tập lead từ nguồn tiếp cận đến RFQ và đơn hàng đã ký." />
    <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4">
      <Field label="Lead tạo từ ngày" htmlFor="m-from"><Input id="m-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
      <Field label="Đến ngày" htmlFor="m-to"><Input id="m-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      <p className="pb-2 text-sm text-muted-foreground">Cohort theo ngày tạo lead · chuyển đổi tính đến trạng thái hiện tại</p>
    </div>
    {!valid && <InlineAlert className="mb-4">Chọn khoảng ngày hợp lệ; ngày kết thúc không trước ngày bắt đầu.</InlineAlert>}
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Tổng lead · 3 nguồn" value={formatNumber(total.leads)} icon={Users} caption="Ads, Google và Organic" />
      <StatCard label="Lead có RFQ" value={formatNumber(total.rfq)} icon={Target} caption="Không tính RFQ đã hủy" />
      <StatCard label="Lead có đơn đã ký" value={formatNumber(total.orders)} icon={ShoppingBag} caption="Mỗi lead tính một lần" />
      <StatCard label="Lead → đơn" value={`${formatNumber(total.leads ? total.orders / total.leads * 100 : 0)}%`} icon={Megaphone} caption="Số lead có đơn đã ký / tổng lead" />
    </div>
    <div className="mb-6 grid gap-6 lg:grid-cols-2">
      <SectionCard title="Lead theo nguồn" description="Số lượng và tỷ trọng trong tập lead đang chọn">
        {!rows.some((r) => r.leads) && <p className="text-sm text-muted-foreground">Không có lead trong khoảng ngày này.</p>}
        <ul className="space-y-5">{rows.map((r) => <li key={r.source}>
          <div className="mb-2 flex justify-between text-sm"><span>{sourceLabels[r.source]}</span><strong className="tabular">{r.leads} lead · {formatNumber(total.leads ? r.leads / total.leads * 100 : 0)}%</strong></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden><div className="h-full bg-primary" style={{ width: `${total.leads ? r.leads / total.leads * 100 : 0}%` }} /></div>
        </li>)}</ul>
      </SectionCard>
      <SectionCard title="Cách đọc chỉ số" description="Dữ liệu đọc trực tiếp từ CRM trong trình duyệt">
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li>Lead → RFQ: lead có ít nhất một RFQ chưa hủy / tổng lead của nguồn.</li>
          <li>Lead → đơn: lead có ít nhất một hợp đồng đã ký / tổng lead của nguồn.</li>
          <li>Không cộng lặp khi một lead có nhiều RFQ hoặc đơn. Affiliate chưa triển khai nên không nằm trong ba nguồn này.</li>
          <li>Chi phí chiến dịch là dữ liệu mẫu độc lập. Chưa có liên kết lead–chiến dịch, chưa tính CPL/ROI để tránh gán doanh thu sai.</li>
        </ul>
      </SectionCard>
    </div>
    <DataTable loading={!ready} rows={rows} getRowId={(r) => r.source} columns={[
      { key: "source", header: "Nguồn", cell: (r) => sourceLabels[r.source] },
      { key: "leads", header: "Lead", cell: (r) => formatNumber(r.leads), align: "right" },
      { key: "rfq", header: "Lead có RFQ", cell: (r) => r.rfq, align: "right" },
      { key: "orders", header: "Lead có đơn", cell: (r) => r.orders, align: "right" },
      { key: "rfq-rate", header: "Lead → RFQ", cell: (r) => `${formatNumber(r.rfqRate)}%`, align: "right" },
      { key: "order-rate", header: "Lead → đơn", cell: (r) => `${formatNumber(r.orderRate)}%`, align: "right" },
    ]} />
  </>;
}

export function CampaignsView({ source }: { source?: LeadSource }) {
  const { data, actions, user } = useBackoffice();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const writable = canWrite(user.role, "marketing");
  const columns: Column<Campaign>[] = [
    { key: "name", header: "Chiến dịch", cell: (c) => <div><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.id}</p></div> },
    { key: "source", header: "Nguồn", cell: (c) => sourceLabels[c.source] },
    { key: "period", header: "Thời gian", cell: (c) => `${formatDate(c.startOn)} – ${formatDate(c.endOn)}` },
    { key: "budget", header: "Ngân sách", cell: (c) => formatVnd(c.budget), align: "right" },
    { key: "spent", header: "Đã chi (mock)", cell: (c) => formatVnd(c.spent), align: "right" },
    { key: "status", header: "Trạng thái", cell: (c) => <StatusBadge tone={c.status === "dang-chay" ? "success" : "neutral"}>{c.status === "dang-chay" ? "Đang chạy" : c.status === "tam-dung" ? "Tạm dừng" : "Kết thúc"}</StatusBadge> },
    ...(writable ? [{ key: "action", header: "Thao tác", cell: (c: Campaign) => <Button size="sm" variant="outline" disabled={c.status === "ket-thuc"} onClick={() => setError(actions.toggleCampaign(user, c.id))}>{c.status === "dang-chay" ? "Tạm dừng" : "Tiếp tục"}</Button> }] : []),
  ];
  return <>
    <ListView title={source ? `Chiến dịch · ${sourceLabels[source]}` : "Chiến dịch Marketing"} description="Danh sách và ngân sách mẫu; thay đổi trạng thái chỉ có hiệu lực trong demo." rows={data.campaigns.filter((c) => !source || c.source === source)} columns={columns} getRowId={(c) => c.id} searchLabel="Tìm chiến dịch" searchPlaceholder="Tên, mã chiến dịch…" searchText={(c) => [c.id, c.name]} filters={[{ id: "source", label: "Mọi nguồn", options: activeSources.map((s) => ({ value: s, label: sourceLabels[s] })), match: (c, v) => c.source === v }]} actions={writable && <Button onClick={() => setOpen(true)}>Tạo chiến dịch</Button>} banner={error && <InlineAlert className="mb-4">{error}</InlineAlert>} />
    {open && <FormDialog title="Tạo chiến dịch mẫu" description="Chưa kết nối nền tảng Ads/Google; số tiền nhập bằng VND." onClose={() => setOpen(false)} onSave={(f) => actions.saveCampaign(user, { ...Object.fromEntries(f), budget: Number(f.get("budget")), spent: Number(f.get("spent")) })}>
      <Field label="Tên chiến dịch" htmlFor="c-name" required><Input id="c-name" name="name" required maxLength={160} /></Field>
      <Field label="Nguồn" htmlFor="c-source"><NativeSelect id="c-source" name="source" defaultValue={source ?? "ads"}>{activeSources.map((s) => <option key={s} value={s}>{sourceLabels[s]}</option>)}</NativeSelect></Field>
      <div className="grid gap-4 sm:grid-cols-2">{[["startOn", "Bắt đầu"], ["endOn", "Kết thúc"]].map(([name, label]) => <Field key={name} label={label} htmlFor={`c-${name}`} required><Input id={`c-${name}`} name={name} type="date" required defaultValue={CRM_TODAY} /></Field>)}</div>
      <div className="grid gap-4 sm:grid-cols-2">{[["budget", "Ngân sách (VND)"], ["spent", "Đã chi (VND)"]].map(([name, label]) => <Field key={name} label={label} htmlFor={`c-${name}`}><Input id={`c-${name}`} name={name} type="number" min="0" step="1" defaultValue="0" required /></Field>)}</div>
    </FormDialog>}
  </>;
}

export function FeedbackView() {
  const { data, actions, user } = useBackoffice();
  const crm = useCrm();
  const [open, setOpen] = useState(false);
  const leads = crm.data.leads;
  const leadMap = new Map(leads.map((l) => [l.messId, l]));
  const columns: Column<LeadFeedback>[] = [
    { key: "lead", header: "Lead", cell: (f) => <div>{canAccess(user.role, "/crm/leads") ? <Link className="font-medium text-primary hover:underline" href={`/crm/leads/${f.messId}`}>{leadMap.get(f.messId)?.contactName ?? f.messId}</Link> : <p className="font-medium">{leadMap.get(f.messId)?.contactName ?? f.messId}</p>}<p className="text-xs text-muted-foreground">{f.messId}</p></div> },
    { key: "source", header: "Nguồn", cell: (f) => sourceLabels[leadMap.get(f.messId)?.source ?? "organic"] },
    { key: "quality", header: "Chất lượng", cell: (f) => <StatusBadge tone={f.quality === "Tốt" ? "success" : "warning"}>{f.quality}</StatusBadge> },
    { key: "note", header: "Phản hồi từ Sales", cell: (f) => <p className="max-w-80 whitespace-pre-wrap">{f.note}</p> },
    { key: "by", header: "Người phản hồi", cell: (f) => crm.staffName(f.by) },
    { key: "at", header: "Ngày", cell: (f) => formatDate(f.at.slice(0, 10)) },
  ];
  return <>
    <ListView title="Phản hồi chất lượng lead" description="Sales đánh giá theo tuyến phụ trách. Marketing xem để cải thiện nguồn lead; tiêu chí đánh giá đang ở mức đề xuất." rows={data.feedback.filter((f) => leadMap.has(f.messId))} columns={columns} getRowId={(f) => f.id} searchLabel="Tìm phản hồi" searchPlaceholder="Tên khách, mã lead, nội dung…" searchText={(f) => [f.messId, f.note, leadMap.get(f.messId)?.contactName]} filters={[{ id: "quality", label: "Mọi đánh giá", options: qualityOptions.map((q) => ({ value: q, label: q })), match: (f, v) => f.quality === v }]} actions={canWrite(user.role, "feedback") && <Button disabled={!crm.ready || !leads.length} onClick={() => setOpen(true)}>Gửi phản hồi</Button>} />
    {open && <FormDialog title="Phản hồi lead" description="Đánh giá nội bộ từ Sales, không gửi ra ngoài." onClose={() => setOpen(false)} onSave={(f) => actions.addFeedback(user, Object.fromEntries(f))}>
      <Field label="Lead" htmlFor="f-lead" required><NativeSelect id="f-lead" name="messId" required>{leads.map((l) => <option key={l.messId} value={l.messId}>{l.contactName} · {l.messId}</option>)}</NativeSelect></Field>
      <Field label="Chất lượng" htmlFor="f-quality"><NativeSelect id="f-quality" name="quality">{qualityOptions.map((q) => <option key={q}>{q}</option>)}</NativeSelect></Field>
      <Field label="Nhận xét cụ thể" htmlFor="f-note" required><Textarea id="f-note" name="note" required maxLength={2000} rows={4} /></Field>
    </FormDialog>}
  </>;
}
