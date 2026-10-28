"use client";

import Link from "next/link";
import { DataTable, type Column } from "@/components/shared/data-table";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { canAccess } from "@/config/roles";
import { usePlatformData } from "@/features/reports/use-platform-data";
import { formatNumber, formatVndCompact } from "@/lib/format";
import { buildReceivables } from "@/services/accounting/rules";
import { delayDays } from "@/services/ops/rules";

interface Metric { name: string; definition: string; value: string; href: string }
interface Group { title: string; metrics: Metric[] }

const MONTH_START = "2026-10-01";

/** COA – Hệ thống & chỉ số: danh mục chỉ số vận hành của từng phòng ban, mỗi chỉ số có định nghĩa và giá trị hiện tại. */
export function CoaView() {
  const p = usePlatformData();
  if (!p.ready) return <TableSkeleton rows={8} columns={4} />;

  const { leads, rfqs, quotations, contracts } = p.crm;
  const signed = contracts.filter((c) => c.status === "da-ky");
  const hr = p.backoffice;
  const receivable = buildReceivables(p.crm, p.ops, p.acc, p.today).filter((r) => r.contract.currency === "VND").reduce((s, r) => s + r.outstanding, 0);
  const withRfq = leads.filter((l) => l.careStatus === "da-co-rfq").length;
  const pct = (a: number, b: number) => `${b ? Math.round((a / b) * 100) : 0}%`;

  const groups: Group[] = [
    { title: "Marketing", metrics: [
      { name: "Lead mới trong tháng", definition: `Lead có ngày tạo từ ${MONTH_START.split("-").reverse().join("/")}`, value: formatNumber(leads.filter((l) => l.createdAt.slice(0, 10) >= MONTH_START).length), href: "/crm/leads" },
      { name: "Tỷ lệ lead đã có RFQ", definition: "Lead ở trạng thái “Đã có RFQ” trên tổng lead", value: pct(withRfq, leads.length), href: "/marketing/hieu-qua-nguon" },
      { name: "Chiến dịch đang chạy", definition: "Chiến dịch ở trạng thái đang chạy (dữ liệu mô phỏng)", value: formatNumber(hr.campaigns.filter((c) => c.status === "dang-chay").length), href: "/marketing/chien-dich" },
    ] },
    { title: "Sale", metrics: [
      { name: "RFQ đang mở", definition: "RFQ mới, chờ giá hoặc đã có giá", value: formatNumber(rfqs.filter((r) => ["moi", "cho-gia", "da-co-gia"].includes(r.status)).length), href: "/crm/rfq" },
      { name: "Báo giá chờ duyệt", definition: "Báo giá đã gửi duyệt, chưa có quyết định", value: formatNumber(quotations.filter((q) => q.status === "cho-duyet").length), href: "/crm/bao-gia" },
      { name: "Hợp đồng đã ký", definition: "Hợp đồng trạng thái đã ký, không tính hủy hoặc soạn thảo", value: formatNumber(signed.length), href: "/crm/hop-dong" },
      { name: "Giá trị ký (VND)", definition: "Tổng giá trị hợp đồng VND đã ký, không cộng USD", value: formatVndCompact(signed.filter((c) => c.currency === "VND").reduce((s, c) => s + c.value, 0)), href: "/crm/hop-dong" },
    ] },
    { title: "Vận hành & Fulfillment", metrics: [
      { name: "Đơn đang thực hiện", definition: "Đơn chưa ở giai đoạn đã giao", value: formatNumber(p.orders.filter((o) => o.stage !== "da-giao").length), href: "/van-hanh/don-hang" },
      { name: "Lô hàng chậm mốc", definition: "Lô có ít nhất một mốc trễ so với kế hoạch", value: formatNumber(p.ops.shipments.filter((s) => delayDays(s, p.today) > 0).length), href: "/van-hanh/logistics" },
      { name: "Kiện trong kho", definition: "Tổng số kiện đang được ghi nhận tại kho", value: formatNumber(p.wh.packages.length), href: "/fulfillment/ton-kho" },
      { name: "Yêu cầu Sale chưa trả lời", definition: "Câu hỏi tình trạng đơn chưa có phản hồi từ kho", value: formatNumber(p.wh.inquiries.filter((q) => q.status !== "da-tra-loi").length), href: "/fulfillment/hoi-tinh-trang" },
    ] },
    { title: "Kế toán", metrics: [
      { name: "Phải thu hiện tại (VND)", definition: "Giá trị hợp đồng đã ký trừ cọc và khoản thu đã ghi nhận", value: formatVndCompact(receivable), href: "/ke-toan/cong-no" },
      { name: "Cọc chờ đối soát", definition: "Cọc đang chờ Kế toán xác nhận hoặc bị báo không khớp", value: formatNumber(signed.filter((c) => c.deposit.status === "cho-ke-toan" || c.deposit.status === "khong-khop").length), href: "/ke-toan/doi-soat" },
      { name: "Đề nghị chi chờ duyệt", definition: "Đề nghị thanh toán ở trạng thái chờ duyệt", value: formatNumber(p.acc.payments.filter((r) => r.status === "cho-duyet").length), href: "/ke-toan/duyet-thanh-toan" },
    ] },
    { title: "HCNS, Pháp chế & Khiếu nại", metrics: [
      { name: "Nhân sự đang làm việc", definition: "Nhân viên chính thức hoặc thử việc", value: formatNumber(hr.employees.filter((e) => e.status === "chinh-thuc" || e.status === "thu-viec").length), href: "/hcns/nhan-vien" },
      { name: "Yêu cầu pháp lý chưa hoàn tất", definition: "Yêu cầu ý kiến pháp lý chưa được duyệt hoặc trả lại", value: formatNumber(hr.legal.filter((t) => t.status !== "da-duyet" && t.status !== "tra-lai").length), href: "/phap-che/yeu-cau" },
      { name: "Khiếu nại đang mở", definition: "Khiếu nại chưa hoàn tất xử lý", value: formatNumber(hr.complaints.filter((c) => c.status !== "hoan-tat").length), href: "/khieu-nai" },
    ] },
  ];

  const columns = (role: Parameters<typeof canAccess>[0]): Column<Metric>[] => [
    { key: "name", header: "Chỉ số", cell: (m) => <div><p className="font-medium">{m.name}</p><p className="text-xs text-muted-foreground">{m.definition}</p></div> },
    { key: "value", header: "Giá trị", align: "right", cell: (m) => <span className="font-semibold">{m.value}</span> },
    { key: "source", header: "Nguồn", cell: (m) => canAccess(role, m.href) ? <Link href={m.href} className="text-sm text-primary transition-colors hover:text-primary/70">Mở module</Link> : <span className="text-sm text-muted-foreground">—</span> },
  ];

  return <>
    <PageHeader title="COA – Hệ thống & chỉ số" description={`Danh mục chỉ số theo phòng ban, tính từ dữ liệu demo tại ngày ${p.today.split("-").reverse().join("/")}. Chưa đặt mục tiêu cho từng chỉ số.`} />
    <div className="grid gap-6 xl:grid-cols-2">
      {groups.map((g) => (
        <SectionCard key={g.title} title={g.title} flush>
          <DataTable className="rounded-t-none border-0 shadow-none" columns={columns(p.user.role)} rows={g.metrics} getRowId={(m) => m.name} />
        </SectionCard>
      ))}
    </div>
  </>;
}
