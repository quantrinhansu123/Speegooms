"use client";

import { useEffect, useState } from "react";
import { Banknote, Hourglass, Plus, Receipt, Save, Users, X } from "lucide-react";
import { createInternalExpenseSchema, createPayrollSchema, expenseStatusLabels, payrollNet } from "@speego/shared";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { MoneyInput } from "@/components/shared/money-input";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { departmentLabels, departmentOptions } from "@/config/departments";
import { canPerform } from "@/config/permissions";
import { useSession } from "@/features/auth/session-provider";
import { FilterSelect, ListSearchBar, useAppliedSearch } from "@/features/crm/live/list-search-bar";
import { TableHScroll } from "@/features/crm/live/table-h-scroll";
import { ApiError, api } from "@/lib/api";
import { formatDate, formatNumber, formatVnd, formatVndCompact } from "@/lib/format";
import type { StatusTone } from "@/types/status";
import { useListData } from "./list-query";

type PayrollRecord = {
  id: string;
  code: string;
  period: string;
  employeeCode: string;
  fullName: string;
  department: string;
  position: string | null;
  baseSalary: number;
  allowance: number;
  insuranceDeduction: number;
  netPay: number;
};

type EmployeeOption = { code: string; name: string; department: string; position: string };

type ExpenseRecord = {
  id: string;
  code: string;
  spentOn: string;
  department: string;
  category: string;
  content: string;
  amount: number;
  status: keyof typeof expenseStatusLabels;
};

const expenseTone: Record<ExpenseRecord["status"], StatusTone> = { CHO_DUYET: "warning", DA_CHI: "success" };
const departmentFilter = departmentOptions.map((option) => [option.value, option.label] as const);
const expenseStatusFilter = (Object.keys(expenseStatusLabels) as ExpenseRecord["status"][]).map((value) => [value, expenseStatusLabels[value]] as const);
const departmentName = (value: string) => (departmentLabels as Record<string, string>)[value] ?? value;
const currentMonth = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);

function DepartmentSelect({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  return (
    <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Chọn phòng ban</option>
      {departmentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </NativeSelect>
  );
}

function CreatePayrollDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (row: PayrollRecord) => void }) {
  const [period, setPeriod] = useState(currentMonth());
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [employeeError, setEmployeeError] = useState<string>();
  const [employeeCode, setEmployeeCode] = useState("");
  const employee = employees.find((item) => item.code === employeeCode);
  const [baseSalary, setBaseSalary] = useState<number | null>(null);
  const [allowance, setAllowance] = useState<number | null>(0);
  const [insurance, setInsurance] = useState<number | null>(0);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const net = payrollNet({ baseSalary: baseSalary ?? 0, allowance: allowance ?? 0, insuranceDeduction: insurance ?? 0 });

  useEffect(() => {
    let cancelled = false;
    api<{ employees: EmployeeOption[] }>("/api/ke-toan/payroll-employees")
      .then((body) => { if (!cancelled) setEmployees(body.employees); })
      .catch((cause) => { if (!cancelled) setEmployeeError(cause instanceof ApiError ? cause.message : "Không tải được danh sách nhân viên"); })
      .finally(() => { if (!cancelled) setLoadingEmployees(false); });
    return () => { cancelled = true; };
  }, []);

  const submit = async () => {
    if (!employee) {
      setError("Vui lòng chọn nhân viên");
      return;
    }
    const parsed = createPayrollSchema.safeParse({
      period,
      employeeCode,
      fullName: employee.name,
      department: employee.department,
      position: employee.position,
      baseSalary: baseSalary ?? 0,
      allowance: allowance ?? 0,
      insuranceDeduction: insurance ?? 0,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const body = await api<{ payroll: PayrollRecord }>("/api/ke-toan/payroll", { method: "POST", body: JSON.stringify(parsed.data) });
      onCreated(body.payroll);
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 409 ? "Nhân sự này đã có dòng lương trong kỳ" : cause instanceof ApiError ? cause.message : "Không lưu được dòng lương");
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nhập dòng lương</DialogTitle>
          <DialogDescription>Một dòng lương của một nhân sự trong một kỳ. Thực nhận = lương cơ bản + phụ cấp − khấu trừ bảo hiểm.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nhân viên" htmlFor="pr-employee" required className="sm:col-span-2">
            <NativeSelect id="pr-employee" value={employeeCode} onChange={(event) => { setEmployeeCode(event.target.value); setError(undefined); }} disabled={loadingEmployees || saving}>
              <option value="">{loadingEmployees ? "Đang tải…" : employeeError ? "Không tải được danh sách nhân viên" : employees.length === 0 ? "Chưa có nhân viên" : "Chọn nhân viên"}</option>
              {employees.map((item) => <option key={item.code} value={item.code}>{item.name} · {item.code}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Kỳ lương" htmlFor="pr-period" required>
            <Input id="pr-period" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
          </Field>
          <Field label="Mã nhân sự" htmlFor="pr-code" required>
            <Input id="pr-code" value={employee?.code ?? ""} readOnly />
          </Field>
          <Field label="Họ tên" htmlFor="pr-name" required>
            <Input id="pr-name" value={employee?.name ?? ""} readOnly />
          </Field>
          <Field label="Phòng ban" htmlFor="pr-dept" required>
            <Input id="pr-dept" value={departmentName(employee?.department ?? "")} readOnly />
          </Field>
          <Field label="Vị trí" htmlFor="pr-position" className="sm:col-span-2">
            <Input id="pr-position" value={employee?.position ?? ""} readOnly />
          </Field>
          <Field label="Lương cơ bản (VND)" htmlFor="pr-base" required>
            <MoneyInput id="pr-base" value={baseSalary} onValueChange={setBaseSalary} fractionDigits={0} />
          </Field>
          <Field label="Phụ cấp (VND)" htmlFor="pr-allowance">
            <MoneyInput id="pr-allowance" value={allowance} onValueChange={setAllowance} fractionDigits={0} />
          </Field>
          <Field label="Khấu trừ bảo hiểm (VND)" htmlFor="pr-insurance">
            <MoneyInput id="pr-insurance" value={insurance} onValueChange={setInsurance} fractionDigits={0} />
          </Field>
          <p className="self-end text-sm">Thực nhận: <strong>{formatVnd(net)}</strong></p>
        </div>
        {employeeError && <InlineAlert>{employeeError}</InlineAlert>}
        {error && <InlineAlert>{error}</InlineAlert>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}><X /> Hủy</Button>
          <Button onClick={submit} disabled={saving || loadingEmployees || !employee}><Save aria-hidden /> {saving ? "Đang lưu…" : "Nhập mới"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateExpenseDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (row: ExpenseRecord) => void }) {
  const [spentOn, setSpentOn] = useState(today());
  const [department, setDepartment] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const parsed = createInternalExpenseSchema.safeParse({ spentOn, department, category, content, amount: amount ?? 0 });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const body = await api<{ expense: ExpenseRecord }>("/api/ke-toan/expenses", { method: "POST", body: JSON.stringify(parsed.data) });
      onCreated(body.expense);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không lưu được chi phí");
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nhập chi phí nội bộ</DialogTitle>
          <DialogDescription>Văn phòng phẩm, đi lại, phần mềm, tiếp khách… Không gồm thanh toán nhà cung cấp.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ngày chi" htmlFor="ex-date" required>
            <Input id="ex-date" type="date" value={spentOn} onChange={(event) => setSpentOn(event.target.value)} />
          </Field>
          <Field label="Phòng ban" htmlFor="ex-dept" required>
            <DepartmentSelect id="ex-dept" value={department} onChange={setDepartment} />
          </Field>
          <Field label="Hạng mục" htmlFor="ex-category" required className="sm:col-span-2">
            <Input id="ex-category" value={category} maxLength={120} onChange={(event) => setCategory(event.target.value)} placeholder="Ví dụ: Văn phòng phẩm" />
          </Field>
          <Field label="Nội dung" htmlFor="ex-content" required className="sm:col-span-2">
            <Input id="ex-content" value={content} maxLength={500} onChange={(event) => setContent(event.target.value)} />
          </Field>
          <Field label="Số tiền (VND)" htmlFor="ex-amount" required>
            <MoneyInput id="ex-amount" value={amount} onValueChange={setAmount} fractionDigits={0} />
          </Field>
        </div>
        {error && <InlineAlert>{error}</InlineAlert>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}><X /> Hủy</Button>
          <Button onClick={submit} disabled={saving}><Save aria-hidden /> {saving ? "Đang lưu…" : "Nhập mới"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PayrollSection({ canWrite }: { canWrite: boolean }) {
  const filters = useAppliedSearch({ q: "", from: "", to: "", department: "" });
  const { rows, loading, error, reload } = useListData<PayrollRecord>("/api/ke-toan/payroll", "payroll", filters.applied, "Không tải được bảng lương");
  const [notice, setNotice] = useState<string>();
  const [creating, setCreating] = useState(false);

  const totalNet = rows.reduce((sum, row) => sum + row.netPay, 0);

  return (
    <>
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <StatCard label="Quỹ lương thực nhận" value={formatVndCompact(totalNet)} icon={Banknote} caption="Theo bộ lọc hiện tại" />
        <StatCard label="Dòng lương" value={formatNumber(rows.length)} icon={Users} caption="Mỗi nhân sự một dòng mỗi kỳ" />
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Chưa tính thuế TNCN và chưa kết nối hệ thống chi trả.</p>
        {canWrite && <Button onClick={() => setCreating(true)}><Plus aria-hidden /> Nhập mới</Button>}
      </div>
      {notice && <InlineAlert tone="success" className="mb-4">{notice}</InlineAlert>}
      {error && <InlineAlert className="mb-4">{error}</InlineAlert>}
      <ListSearchBar
        q={filters.draft.q}
        from={filters.draft.from}
        to={filters.draft.to}
        onQ={(value) => filters.set("q", value)}
        onFrom={(value) => filters.set("from", value)}
        onTo={(value) => filters.set("to", value)}
        onSearch={filters.search}
        onReset={filters.reset}
        dateLabel="Từ kỳ (ngày đầu kỳ)"
        searchPlaceholder="Mã, tên nhân sự, phòng ban, vị trí…"
      >
        <FilterSelect id="pr-filter-dept" label="Phòng ban" value={filters.draft.department} onChange={(value) => filters.set("department", value)} options={departmentFilter} />
      </ListSearchBar>
      <TableHScroll className="-mx-1 overscroll-x-contain">
        <table className="w-max min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Mã</th>
              <th className="px-3 py-2 font-medium">Kỳ</th>
              <th className="px-3 py-2 font-medium">Nhân sự</th>
              <th className="px-3 py-2 font-medium">Phòng ban</th>
              <th className="px-3 py-2 font-medium">Vị trí</th>
              <th className="px-3 py-2 text-right font-medium">Lương cơ bản</th>
              <th className="px-3 py-2 text-right font-medium">Phụ cấp</th>
              <th className="px-3 py-2 text-right font-medium">Khấu trừ BH</th>
              <th className="px-3 py-2 text-right font-medium">Thực nhận</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Đang tải…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">{filters.active ? "Không có kết quả." : "Chưa có dòng lương."}</td></tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">{row.code}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.period.split("-").reverse().join("/")}</td>
                <td className="px-3 py-3 whitespace-nowrap"><span className="font-medium">{row.fullName}</span><p className="text-xs text-muted-foreground">{row.employeeCode}</p></td>
                <td className="px-3 py-3 whitespace-nowrap">{departmentName(row.department)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.position || "—"}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap">{formatVnd(row.baseSalary)}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap">{formatVnd(row.allowance)}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap">−{formatVnd(row.insuranceDeduction)}</td>
                <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">{formatVnd(row.netPay)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableHScroll>
      {creating && (
        <CreatePayrollDialog
          onClose={() => setCreating(false)}
          onCreated={(row) => {
            setCreating(false);
            setNotice(`Đã nhập dòng lương ${row.code} cho ${row.fullName}.`);
            reload();
          }}
        />
      )}
    </>
  );
}

function ExpenseSection({ canWrite }: { canWrite: boolean }) {
  const filters = useAppliedSearch({ q: "", from: "", to: "", department: "", status: "" });
  const { rows, loading, error, reload } = useListData<ExpenseRecord>("/api/ke-toan/expenses", "expenses", filters.applied, "Không tải được chi phí nội bộ");
  const [notice, setNotice] = useState<string>();
  const [creating, setCreating] = useState(false);

  const paid = rows.filter((row) => row.status === "DA_CHI").reduce((sum, row) => sum + row.amount, 0);
  const pending = rows.filter((row) => row.status === "CHO_DUYET");
  const pendingTotal = pending.reduce((sum, row) => sum + row.amount, 0);

  return (
    <>
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <StatCard label="Chi phí nội bộ đã chi" value={formatVndCompact(paid)} icon={Receipt} caption="Theo bộ lọc hiện tại" />
        <StatCard label="Chi phí chờ duyệt" value={formatVndCompact(pendingTotal)} icon={Hourglass} caption={`${pending.length} khoản`} />
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Văn phòng phẩm, đi lại, phần mềm, tiếp khách… không gồm thanh toán nhà cung cấp.</p>
        {canWrite && <Button onClick={() => setCreating(true)}><Plus aria-hidden /> Nhập mới</Button>}
      </div>
      {notice && <InlineAlert tone="success" className="mb-4">{notice}</InlineAlert>}
      {error && <InlineAlert className="mb-4">{error}</InlineAlert>}
      <ListSearchBar
        q={filters.draft.q}
        from={filters.draft.from}
        to={filters.draft.to}
        onQ={(value) => filters.set("q", value)}
        onFrom={(value) => filters.set("from", value)}
        onTo={(value) => filters.set("to", value)}
        onSearch={filters.search}
        onReset={filters.reset}
        dateLabel="Từ ngày chi"
        searchPlaceholder="Mã, hạng mục, nội dung, số tiền…"
      >
        <FilterSelect id="ex-filter-dept" label="Phòng ban" value={filters.draft.department} onChange={(value) => filters.set("department", value)} options={departmentFilter} />
        <FilterSelect id="ex-filter-status" label="Trạng thái" value={filters.draft.status} onChange={(value) => filters.set("status", value)} options={expenseStatusFilter} />
      </ListSearchBar>
      <TableHScroll className="-mx-1 overscroll-x-contain">
        <table className="w-max min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Mã</th>
              <th className="px-3 py-2 font-medium">Ngày</th>
              <th className="px-3 py-2 font-medium">Phòng ban</th>
              <th className="px-3 py-2 font-medium">Hạng mục</th>
              <th className="min-w-56 px-3 py-2 font-medium">Nội dung</th>
              <th className="px-3 py-2 text-right font-medium">Số tiền</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Đang tải…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">{filters.active ? "Không có kết quả." : "Chưa có chi phí nội bộ."}</td></tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">{row.code}</td>
                <td className="px-3 py-3 whitespace-nowrap">{formatDate(row.spentOn)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{departmentName(row.department)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.category}</td>
                <td className="min-w-56 max-w-80 px-3 py-3">{row.content}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap">{formatVnd(row.amount)}</td>
                <td className="px-3 py-3 whitespace-nowrap"><StatusBadge tone={expenseTone[row.status]}>{expenseStatusLabels[row.status]}</StatusBadge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableHScroll>
      {creating && (
        <CreateExpenseDialog
          onClose={() => setCreating(false)}
          onCreated={(row) => {
            setCreating(false);
            setNotice(`Đã nhập chi phí ${row.code}.`);
            reload();
          }}
        />
      )}
    </>
  );
}

/** Lương & chi phí nội bộ lấy từ API; Kế toán nhập mới dòng lương và chi phí. */
export function PayrollLiveView() {
  const user = useSession();
  return (
    <>
      <PageHeader title="Lương & chi phí nội bộ" description="Bảng lương theo nhân sự và chi phí nội bộ theo phòng ban. Chỉ ghi nhận số liệu, chưa kết nối hệ thống chi trả." />
      <Tabs defaultValue="payroll">
        <TabsList className="mb-4">
          <TabsTrigger value="payroll">Bảng lương nhân sự</TabsTrigger>
          <TabsTrigger value="expenses">Chi phí nội bộ</TabsTrigger>
        </TabsList>
        <TabsContent value="payroll"><PayrollSection canWrite={canPerform(user.role, "payroll.write")} /></TabsContent>
        <TabsContent value="expenses"><ExpenseSection canWrite={canPerform(user.role, "expense.write")} /></TabsContent>
      </Tabs>
    </>
  );
}
