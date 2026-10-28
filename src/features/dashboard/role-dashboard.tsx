"use client";

import { useState } from "react";
import Link from "next/link";
import { Field, InlineAlert } from "@/components/shared/form-fields";
import { ErrorState } from "@/components/shared/error-state";
import { DataTable } from "@/components/shared/data-table";
import { ListView } from "@/components/shared/list-view";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard, type StatCardProps } from "@/components/shared/stat-card";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { CRM_TODAY, roleRouteScope, sourceLabels } from "@/config/crm";
import { canAccess, roleConfig } from "@/config/roles";
import { usePlatformData } from "@/features/reports/use-platform-data";
import { formatDate, formatNumber, formatVndCompact } from "@/lib/format";
import { buildReceivables } from "@/services/accounting/rules";
import { date, sourceMetrics } from "@/services/backoffice/rules";
import { delayDays } from "@/services/ops/rules";

interface WorkItem { id: string; title: string; due: string; status: string; href: string }

export function RoleDashboard() {
  const p = usePlatformData();
  const [from, setFrom] = useState("2026-10-01");
  const [to, setTo] = useState(CRM_TODAY);
  const role = p.user.role;
  const valid = date.safeParse(from).success && date.safeParse(to).success && from <= to;
  const inRange = (value: string) => valid && value.slice(0, 10) >= from && value.slice(0, 10) <= to;
  const scope = roleRouteScope[role];
  const leads = p.crm.leads.filter((l) => !scope || l.goodsOrigin === (scope === "vn" ? "vn" : "cn"));
  const rfqs = p.crm.rfqs.filter((r) => !scope || r.route === scope);
  const contracts = p.crm.contracts.filter((c) => !scope || c.route === scope);
  const inPeriod = contracts.filter((c) => c.status === "da-ky" && inRange(c.createdAt));
  const metrics = valid ? sourceMetrics(leads, rfqs, contracts, from, to) : [];
  const activeOrders = p.orders.filter((o) => o.stage !== "da-giao" && (!scope || o.contract.route === scope));
  const pendingDeposits = contracts.filter((c) => c.status === "da-ky" && (c.deposit.status === "cho-ke-toan" || c.deposit.status === "khong-khop"));
  const receivables = buildReceivables(p.crm, p.ops, p.acc, p.today).filter((r) => r.contract.currency === "VND");
  const hr = p.backoffice;
  const cards: StatCardProps[] = [];
  const work: WorkItem[] = [];
  const card = (label: string, value: string | number, href: string, caption: string) => cards.push({ label, value: String(value), href: canAccess(role, href) ? href : undefined, caption });
  const task = (id: string, title: string, due: string, status: string, href: string) => { if (canAccess(role, href)) work.push({ id, title, due, status, href }); };
  const executive = role === "admin" || role === "ban-gd";
  const sales = role === "sale-vn" || role === "sale-global";

  if (executive || sales || role === "marketing") {
    card("Lead mới trong kỳ", leads.filter((l) => inRange(l.createdAt)).length, "/crm/leads", "Theo ngày tạo lead; Sale khóa theo tuyến");
    card("Lead → đơn đã ký", `${formatNumber(metrics.reduce((s, m) => s + m.orders, 0) / Math.max(1, metrics.reduce((s, m) => s + m.leads, 0)) * 100)}%`, role === "marketing" ? "/marketing/hieu-qua-nguon" : "/reports", "Cohort 3 nguồn; đếm lead duy nhất");
  }
  if (executive || sales) {
    card("Hợp đồng ký · tạo trong kỳ", inPeriod.length, "/crm/hop-dong", "Không tính hủy hoặc soạn thảo");
    card("Giá trị ký VND trong kỳ", formatVndCompact(inPeriod.filter((c) => c.currency === "VND").reduce((s, c) => s + c.value, 0)), "/crm/hop-dong", "Hợp đồng tạo trong kỳ; không cộng USD");
    card("Đơn đang thực hiện", activeOrders.length, sales ? "/crm/hop-dong" : "/van-hanh/don-hang", "Trạng thái hiện tại, không theo kỳ");
    card("Cọc chờ đối soát", pendingDeposits.length, sales ? "/crm/hop-dong" : "/ke-toan/doi-soat", "Trạng thái hiện tại");
    leads.filter((l) => l.nextTask && !l.nextTask.done).forEach((l) => task(l.messId, `${l.contactName}: ${l.nextTask!.title}`, l.nextTask!.dueOn, l.nextTask!.dueOn < p.today ? "Quá hạn chăm sóc" : "Chăm sóc tiếp", `/crm/leads/${l.messId}`));
    contracts.filter((c) => c.deposit.status === "cho-ke-toan").forEach((c) => task(c.orderId, `Theo dõi cọc ${c.orderId}`, "", "Chờ Kế toán", `/crm/hop-dong/${c.orderId}`));
  }
  if (role === "marketing") {
    card("Chiến dịch đang chạy", hr.campaigns.filter((c) => c.status === "dang-chay").length, "/marketing/chien-dich", "Trạng thái chiến dịch hiện tại (mock)");
    card("Phản hồi Sales trong kỳ", hr.feedback.filter((f) => inRange(f.at)).length, "/marketing/phan-hoi", "Theo ngày gửi phản hồi");
    hr.feedback.filter((f) => f.quality !== "Tốt").forEach((f) => task(f.id, f.note, f.at.slice(0, 10), f.quality, "/marketing/phan-hoi"));
  }
  if (role === "van-hanh") {
    card("Đơn đang xử lý", activeOrders.length, "/van-hanh/don-hang", "Trạng thái hiện tại");
    card("Lô hàng chậm mốc", p.ops.shipments.filter((s) => delayDays(s, p.today) > 0).length, "/van-hanh/logistics", "Theo kế hoạch các mốc hiện có");
    card("Phiếu nhập chờ xử lý", p.wh.receipts.filter((r) => r.status !== "da-nhap").length, "/fulfillment/nhap-kho", "Trạng thái hiện tại");
    card("Yêu cầu Sale chưa trả lời", p.wh.inquiries.filter((q) => q.status !== "da-tra-loi").length, "/fulfillment/hoi-tinh-trang", "Trạng thái hiện tại");
    activeOrders.forEach((o) => task(o.contract.orderId, `${o.contract.orderId} · ${o.customer?.name ?? ""}`, o.state.dueOn, o.daysOverdue ? "Quá hạn giao" : "Đang xử lý", `/van-hanh/don-hang/${o.contract.orderId}`));
    hr.complaints.filter((c) => c.status !== "hoan-tat").forEach((c) => task(c.id, c.title, c.dueOn, "Khiếu nại mở", `/khieu-nai/${c.id}`));
  }
  if (role === "ke-toan" || executive) {
    if (role === "ke-toan") {
      card("Cọc chờ đối soát", pendingDeposits.length, "/ke-toan/doi-soat", "Hợp đồng đã ký, trạng thái hiện tại");
      card("Đã duyệt, chờ ghi nhận chi", p.acc.payments.filter((r) => r.status === "da-duyet").length, "/ke-toan/de-nghi-thanh-toan", "Chỉ Kế toán ghi nhận chi, không chuyển tiền thật");
    }
    card("Phải thu hiện tại (VND)", formatVndCompact(receivables.reduce((s, r) => s + r.outstanding, 0)), "/ke-toan/cong-no", "Toàn bộ số dư VND; không theo kỳ");
    card("Đề nghị chi chờ duyệt", p.acc.payments.filter((r) => r.status === "cho-duyet").length, "/ke-toan/duyet-thanh-toan", "Cấp duyệt vẫn theo cấu hình mô phỏng");
    pendingDeposits.forEach((c) => task(`coc-${c.orderId}`, `Đối soát cọc ${c.orderId}`, "", "Chờ xác nhận", `/ke-toan/doi-soat/${c.orderId}`));
    p.acc.payments.filter((r) => r.status === (role === "ke-toan" ? "da-duyet" : "cho-duyet")).forEach((r) => task(r.paymentId, `Đề nghị ${r.paymentId}`, r.requestedAt.slice(0, 10), role === "ke-toan" ? "Chờ ghi nhận chi" : "Chờ duyệt", `/ke-toan/de-nghi-thanh-toan/${r.paymentId}`));
  }
  if (role === "hcns") {
    card("Nhân sự đang làm việc", hr.employees.filter((e) => e.status === "chinh-thuc" || e.status === "thu-viec").length, "/hcns/nhan-vien", "Trạng thái hiện tại");
    card("Nhân viên vào làm trong kỳ", hr.employees.filter((e) => inRange(e.joinedOn)).length, "/hcns/nhan-vien", "Theo ngày vào làm");
    card("Ứng viên onboarding", hr.candidates.filter((c) => c.status === "onboarding").length, "/hcns/tuyen-dung", "Trạng thái hiện tại");
    card("Đã ghi nhận giờ vào hôm nay", hr.attendance.filter((a) => a.date === p.today && a.checkIn).length, "/hcns/cham-cong", "Ngày demo 28/10/2026, không theo kỳ");
    hr.candidates.filter((c) => c.status !== "hoan-tat").forEach((c) => task(c.id, `${c.name} · ${c.position}`, c.startOn, "Tuyển dụng / onboarding", "/hcns/tuyen-dung"));
    hr.employees.filter((e) => e.contractEnd && e.contractEnd <= "2026-11-27" && e.status !== "nghi-viec").forEach((e) => task(e.id, `Kiểm tra thời hạn hồ sơ ${e.name}`, e.contractEnd, "Cần rà soát (đề xuất)", `/hcns/nhan-vien/${e.id}`));
  }
  if (role === "phap-che") {
    card("Yêu cầu chưa hoàn tất", hr.legal.filter((t) => t.status !== "da-duyet").length, "/phap-che/yeu-cau", "Trạng thái hiện tại");
    card("Yêu cầu tạo trong kỳ", hr.legal.filter((t) => inRange(t.history[0]?.at ?? "")).length, "/phap-che/yeu-cau", "Theo ngày tạo yêu cầu");
    card("Quá hạn rà soát", hr.legal.filter((t) => t.status !== "da-duyet" && t.dueOn < p.today).length, "/phap-che/yeu-cau", "Theo ngày demo, SLA đề xuất");
    card("Chờ Ban Giám đốc duyệt", hr.legal.filter((t) => t.status === "cho-duyet").length, "/phap-che/yeu-cau", "Chỉ duyệt mô phỏng");
    hr.legal.filter((t) => t.status !== "da-duyet").forEach((t) => task(t.id, t.title, t.dueOn, "Rà soát pháp lý", `/phap-che/yeu-cau/${t.id}`));
  }
  if (executive) {
    hr.legal.filter((t) => t.status === "cho-duyet").forEach((t) => task(t.id, t.title, t.dueOn, "Chờ duyệt pháp lý", `/phap-che/yeu-cau/${t.id}`));
    hr.complaints.filter((c) => c.compensation.status === "cho-duyet").forEach((c) => task(c.id, c.title, c.dueOn, "Chờ duyệt đền bù", `/khieu-nai/${c.id}`));
    p.crm.quotations.filter((q) => q.status === "cho-duyet").forEach((q) => task(q.quoteId, `Báo giá ${q.quoteId}`, q.createdAt, "Chờ duyệt báo giá", `/crm/bao-gia/${q.quoteId}`));
  }
  if (p.error) return <ErrorState message={p.error} />;
  return <>
    <PageHeader title={executive ? "Tổng quan điều hành" : `Tổng quan ${roleConfig[role].label}`} description="Dữ liệu trực tiếp từ các module demo. Chỉ số theo kỳ và chỉ số tại thời điểm hiện tại được ghi rõ trên từng thẻ." actions={<Link className={buttonVariants({ variant: "outline" })} href="/demo-guide">Demo Guide</Link>} />
    <div className="mb-6 flex flex-wrap gap-4 rounded-xl border bg-card p-4"><Field label="Từ ngày" htmlFor="dash-from"><Input id="dash-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="Đến ngày" htmlFor="dash-to"><Input id="dash-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field><p className="self-end pb-2 text-sm text-muted-foreground">{scope ? `Khóa phạm vi: ${roleConfig[role].label}` : `Vai trò: ${roleConfig[role].label}`} · Ngày demo 28/10/2026</p></div>
    {!valid && <InlineAlert className="mb-4">Vui lòng chọn khoảng ngày hợp lệ.</InlineAlert>}
    {!p.ready ? <TableSkeleton rows={8} columns={5} /> : <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map((c) => <StatCard key={c.label} {...c} />)}</div>
      {(executive || sales || role === "marketing") && <SectionCard title="Hiệu quả nguồn lead trong kỳ" description="Lead duy nhất trong cohort 3 nguồn; RFQ chưa hủy và hợp đồng đã ký ở trạng thái hiện tại" className="mb-6"><DataTable rows={metrics} getRowId={(r) => r.source} columns={[
        { key: "name", header: "Nguồn", cell: (r) => sourceLabels[r.source] }, { key: "lead", header: "Lead", cell: (r) => r.leads, align: "right" }, { key: "rfq", header: "Lead có RFQ", cell: (r) => r.rfq, align: "right" }, { key: "order", header: "Lead có đơn", cell: (r) => r.orders, align: "right" }, { key: "rate", header: "Lead → đơn", cell: (r) => `${formatNumber(r.orderRate)}%`, align: "right" },
      ]} /></SectionCard>}
      <ListView headingLevel={2} title="Công việc cần theo dõi" description="Hàng đợi hiện tại theo role; ưu tiên việc quá hạn. Không bị lọc theo kỳ của các thẻ chỉ số." rows={work} getRowId={(w) => w.id} searchLabel="Tìm công việc" searchPlaceholder="Tìm mã, nội dung, trạng thái…" searchText={(w) => [w.id, w.title, w.status]} sort={(a, b) => (a.due || "9999").localeCompare(b.due || "9999")} columns={[
        { key: "title", header: "Công việc", cell: (w) => <Link className="font-medium text-primary hover:underline" href={w.href}>{w.title}</Link> }, { key: "status", header: "Trạng thái", cell: (w) => w.status }, { key: "due", header: "Mốc ngày / hạn", cell: (w) => w.due ? formatDate(w.due) : "Chưa có hạn" },
      ]} />
    </>}
  </>;
}
