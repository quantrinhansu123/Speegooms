"use client";

import Link from "next/link";
import { Banknote, Hourglass, Receipt, Users } from "lucide-react";
import { ListView } from "@/components/shared/list-view";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { departmentLabels, departmentOptions } from "@/config/departments";
import { INSURANCE_RATE, PAYROLL_MONTH, expenseStatusMeta, internalExpenses, simulatedPay, type InternalExpense } from "@/config/payroll";
import { useBackoffice } from "@/features/backoffice/hooks";
import { formatDate, formatNumber, formatVnd, formatVndCompact } from "@/lib/format";
import type { Employee } from "@/types/backoffice";

type PayRow = Employee & ReturnType<typeof simulatedPay>;

/** Lương & chi phí nội bộ (mô phỏng): bảng lương theo nhân sự và chi phí nội bộ theo phòng ban. */
export function PayrollView() {
  const { data, ready } = useBackoffice();
  if (!ready) return <TableSkeleton rows={8} columns={5} />;

  const payRows: PayRow[] = data.employees
    .filter((e) => e.status !== "nghi-viec")
    .map((e) => ({ ...e, ...simulatedPay(e.position) }));
  const totalNet = payRows.reduce((s, r) => s + r.net, 0);
  const paid = internalExpenses.filter((x) => x.status === "da-chi").reduce((s, x) => s + x.amount, 0);
  const pending = internalExpenses.filter((x) => x.status === "cho-duyet");
  const pendingTotal = pending.reduce((s, x) => s + x.amount, 0);

  return <>
    <PageHeader title="Lương & chi phí nội bộ" description={`Kỳ ${PAYROLL_MONTH}. Số liệu mô phỏng, chưa tính thuế TNCN và chưa kết nối hệ thống chi trả thật.`} />
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Quỹ lương thực nhận" value={formatVndCompact(totalNet)} icon={Banknote} caption={`Sau khấu trừ bảo hiểm ${(INSURANCE_RATE * 100).toFixed(1)}%`} />
      <StatCard label="Nhân sự tính lương" value={formatNumber(payRows.length)} icon={Users} caption="Không gồm nhân sự đã nghỉ việc" />
      <StatCard label="Chi phí nội bộ đã chi" value={formatVndCompact(paid)} icon={Receipt} caption={`Tháng ${PAYROLL_MONTH}`} />
      <StatCard label="Chi phí chờ duyệt" value={formatVndCompact(pendingTotal)} icon={Hourglass} caption={`${pending.length} khoản`} />
    </div>

    <ListView<PayRow>
      headingLevel={2}
      title="Bảng lương nhân sự"
      description="Lương cơ bản suy ra từ chức danh theo quy tắc mô phỏng."
      rows={payRows}
      getRowId={(r) => r.id}
      searchLabel="Tìm nhân sự"
      searchPlaceholder="Tên, mã, vị trí…"
      searchText={(r) => [r.id, r.name, r.position]}
      exportFilename={`speego-bang-luong-${PAYROLL_MONTH.replace("/", "-")}.csv`}
      filters={[{ id: "department", label: "Mọi phòng ban", options: departmentOptions, match: (r, v) => r.department === v }]}
      columns={[
        { key: "name", header: "Nhân sự", sortValue: (r) => r.name, exportValue: (r) => r.name, cell: (r) => <div><Link href={`/hcns/nhan-vien/${r.id}`} className="font-medium text-primary transition-colors hover:text-primary/70">{r.name}</Link><p className="text-xs text-muted-foreground">{r.id}</p></div> },
        { key: "department", header: "Phòng ban", exportValue: (r) => departmentLabels[r.department], cell: (r) => departmentLabels[r.department] },
        { key: "position", header: "Vị trí", exportValue: (r) => r.position, cell: (r) => r.position },
        { key: "base", header: "Lương cơ bản", align: "right", sortValue: (r) => r.base, exportValue: (r) => r.base, cell: (r) => formatVnd(r.base) },
        { key: "allowance", header: "Phụ cấp", align: "right", exportValue: (r) => r.allowance, cell: (r) => formatVnd(r.allowance) },
        { key: "insurance", header: "Khấu trừ BH", align: "right", exportValue: (r) => r.insurance, cell: (r) => `−${formatVnd(r.insurance)}` },
        { key: "net", header: "Thực nhận", align: "right", sortValue: (r) => r.net, exportValue: (r) => r.net, cell: (r) => <span className="font-semibold">{formatVnd(r.net)}</span> },
      ]}
    />

    <div className="mt-8">
      <ListView<InternalExpense>
        headingLevel={2}
        title="Chi phí nội bộ theo phòng ban"
        description="Văn phòng phẩm, đi lại, phần mềm, tiếp khách… không gồm thanh toán nhà cung cấp."
        rows={internalExpenses}
        getRowId={(x) => x.id}
        searchLabel="Tìm chi phí"
        searchPlaceholder="Mã, nội dung, hạng mục…"
        searchText={(x) => [x.id, x.description, x.category]}
        dateValue={(x) => x.date}
        dateLabel="Ngày chi"
        exportFilename={`speego-chi-phi-noi-bo-${PAYROLL_MONTH.replace("/", "-")}.csv`}
        sort={(a, b) => b.date.localeCompare(a.date)}
        filters={[
          { id: "department", label: "Mọi phòng ban", options: departmentOptions, match: (x, v) => x.department === v },
          { id: "status", label: "Mọi trạng thái", options: Object.entries(expenseStatusMeta).map(([value, m]) => ({ value, label: m.label })), match: (x, v) => x.status === v },
        ]}
        columns={[
          { key: "id", header: "Mã", exportValue: (x) => x.id, cell: (x) => <span className="font-mono text-xs">{x.id}</span> },
          { key: "date", header: "Ngày", sortValue: (x) => x.date, exportValue: (x) => x.date, cell: (x) => formatDate(x.date) },
          { key: "department", header: "Phòng ban", exportValue: (x) => departmentLabels[x.department], cell: (x) => departmentLabels[x.department] },
          { key: "category", header: "Hạng mục", exportValue: (x) => x.category, cell: (x) => x.category },
          { key: "description", header: "Nội dung", exportValue: (x) => x.description, cell: (x) => x.description },
          { key: "amount", header: "Số tiền", align: "right", sortValue: (x) => x.amount, exportValue: (x) => x.amount, cell: (x) => formatVnd(x.amount) },
          { key: "status", header: "Trạng thái", exportValue: (x) => expenseStatusMeta[x.status].label, cell: (x) => <StatusBadge tone={expenseStatusMeta[x.status].tone}>{expenseStatusMeta[x.status].label}</StatusBadge> },
        ]}
      />
    </div>
  </>;
}
