"use client";

import { ArrowText } from "@/components/shared/arrow-text";

import { useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { ListView } from "@/components/shared/list-view";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CRM_TODAY } from "@/config/crm";
import { departmentLabels, departmentOptions } from "@/config/departments";
import { useBackoffice } from "@/features/backoffice/hooks";
import { FormDialog } from "@/features/backoffice/form-dialog";
import { formatDate } from "@/lib/format";
import { canWrite, onboardingTasks } from "@/services/backoffice/rules";
import type { Candidate, Employee } from "@/types/backoffice";

const employeeStatuses: Record<Employee["status"], string> = { "thu-viec": "Thử việc", "chinh-thuc": "Chính thức", "tam-nghi": "Tạm nghỉ", "nghi-viec": "Nghỉ việc" };
const candidateStatuses: Record<Candidate["status"], string> = { "ung-tuyen": "Ứng tuyển", "phong-van": "Phỏng vấn", offer: "Offer", onboarding: "Onboarding", "hoan-tat": "Hoàn tất" };

function EmployeeForm({ employee, onClose }: { employee?: Employee; onClose: () => void }) {
  const { data, user, actions } = useBackoffice();
  return <FormDialog title={employee ? "Cập nhật hồ sơ nhân viên" : "Thêm nhân viên"} description="Hồ sơ minh họa, không nhập giấy tờ nhạy cảm thật. Thay đổi phòng ban/vị trí không thay đổi quyền đăng nhập." onClose={onClose} onSave={(f) => actions.saveEmployee(user, employee?.id, Object.fromEntries(f))}>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Họ tên" htmlFor="nv-name" required><Input id="nv-name" name="name" defaultValue={employee?.name} required maxLength={120} /></Field><Field label="Email" htmlFor="nv-email" required><Input id="nv-email" name="email" type="email" defaultValue={employee?.email} required /></Field></div>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Phòng ban" htmlFor="nv-dept"><NativeSelect id="nv-dept" name="department" defaultValue={employee?.department ?? "hcns"}>{departmentOptions.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</NativeSelect></Field><Field label="Vị trí" htmlFor="nv-position" required><Input id="nv-position" name="position" defaultValue={employee?.position} required maxLength={120} /></Field></div>
    <Field label="Người quản lý trực tiếp" htmlFor="nv-manager"><NativeSelect id="nv-manager" name="managerId" defaultValue={employee?.managerId ?? ""}><option value="">Chưa phân công</option>{data.employees.filter((e) => e.id !== employee?.id && e.status !== "nghi-viec").map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</NativeSelect></Field>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Ngày vào làm" htmlFor="nv-joined" required><Input id="nv-joined" name="joinedOn" type="date" defaultValue={employee?.joinedOn ?? CRM_TODAY} required /></Field><Field label="Trạng thái" htmlFor="nv-status"><NativeSelect id="nv-status" name="status" defaultValue={employee?.status ?? "thu-viec"}>{Object.entries(employeeStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect></Field></div>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Loại hợp đồng lao động" htmlFor="nv-contract" required><Input id="nv-contract" name="contractType" defaultValue={employee?.contractType ?? "Thử việc (mock)"} maxLength={120} required /></Field><Field label="Ngày hết hạn hợp đồng" htmlFor="nv-end"><Input id="nv-end" name="contractEnd" type="date" defaultValue={employee?.contractEnd} /></Field></div>
    <Field label="Danh mục hồ sơ" htmlFor="nv-docs" hint="Mỗi dòng một tên hồ sơ; chỉ lưu danh mục, không tải tệp."><Textarea id="nv-docs" name="documents" rows={3} maxLength={2000} defaultValue={employee?.documents.join("\n")} /></Field>
  </FormDialog>;
}

export function EmployeesView() {
  const { data, user } = useBackoffice();
  const [open, setOpen] = useState(false);
  return <>
    <ListView dateLabel="Ngày vào làm" dateValue={(r) => r.joinedOn} title="Nhân viên" description="Phòng ban, vị trí và trạng thái lao động. Dữ liệu nhân sự mẫu, độc lập với phân quyền đăng nhập." rows={data.employees} getRowId={(e) => e.id} searchLabel="Tìm nhân viên" searchPlaceholder="Tên, mã, email, vị trí…" searchText={(e) => [e.id, e.name, e.email, e.position]}
      actions={canWrite(user.role, "hrm") && <Button onClick={() => setOpen(true)}>Thêm nhân viên</Button>}
      summary={<div className="mb-6 grid gap-4 sm:grid-cols-3"><StatCard label="Đang làm việc" value={String(data.employees.filter((e) => ["thu-viec", "chinh-thuc"].includes(e.status)).length)} icon={Users} /><StatCard label="Thử việc" value={String(data.employees.filter((e) => e.status === "thu-viec").length)} /><StatCard label="Phòng ban" value={String(new Set(data.employees.map((e) => e.department)).size)} /></div>}
      filters={[{ id: "department", label: "Mọi phòng ban", options: departmentOptions, match: (e, v) => e.department === v }, { id: "status", label: "Mọi trạng thái", options: Object.entries(employeeStatuses).map(([value, label]) => ({ value, label })), match: (e, v) => e.status === v }]}
      columns={[
        { key: "name", header: "Nhân viên", cell: (e) => <div><Link href={`/hcns/nhan-vien/${e.id}`} className="font-medium text-primary hover:underline">{e.name}</Link><p className="text-xs text-muted-foreground">{e.id} · {e.email}</p></div> },
        { key: "department", header: "Phòng ban", cell: (e) => departmentLabels[e.department] },
        { key: "position", header: "Vị trí", cell: (e) => e.position },
        { key: "joined", header: "Vào làm", cell: (e) => formatDate(e.joinedOn) },
        { key: "status", header: "Trạng thái", cell: (e) => <StatusBadge tone={e.status === "chinh-thuc" ? "success" : "neutral"}>{employeeStatuses[e.status]}</StatusBadge> },
      ]} />
    {open && <EmployeeForm onClose={() => setOpen(false)} />}
  </>;
}

export function EmployeeDetail({ id }: { id: string }) {
  const { data, user } = useBackoffice();
  const [open, setOpen] = useState(false);
  const employee = data.employees.find((e) => e.id === id);
  if (!employee) return <EmptyState title="Không tìm thấy nhân viên" action={<Link href="/hcns/nhan-vien">Về danh sách</Link>} />;
  return <>
    <PageHeader title={employee.name} description={`${employee.id} · ${departmentLabels[employee.department]} · ${employee.position}`} actions={canWrite(user.role, "hrm") && <Button onClick={() => setOpen(true)}>Chỉnh sửa hồ sơ</Button>} />
    <Link href="/hcns/nhan-vien" className="mb-6 inline-block text-sm text-primary hover:underline"><ArrowText>{"←"}</ArrowText> Danh sách nhân viên</Link>
    <div className="grid gap-6 lg:grid-cols-2"><SectionCard title="Hồ sơ lao động" description="Thông tin mẫu, chưa dùng để quản lý hợp đồng lao động thực tế"><dl className="grid grid-cols-2 gap-4 text-sm"><dt className="text-muted-foreground">Trạng thái</dt><dd>{employeeStatuses[employee.status]}</dd><dt className="text-muted-foreground">Email</dt><dd className="break-all">{employee.email}</dd><dt className="text-muted-foreground">Ngày vào làm</dt><dd>{formatDate(employee.joinedOn)}</dd><dt className="text-muted-foreground">Loại hợp đồng</dt><dd>{employee.contractType}</dd><dt className="text-muted-foreground">Hết hạn</dt><dd>{employee.contractEnd ? formatDate(employee.contractEnd) : "Chưa khai báo"}</dd><dt className="text-muted-foreground">Quản lý trực tiếp</dt><dd>{data.employees.find((e) => e.id === employee.managerId)?.name ?? "Chưa phân công"}</dd></dl></SectionCard><SectionCard title="Danh mục hồ sơ" description="Tên hồ sơ tham chiếu; chưa lưu tệp"><ul className="space-y-2 text-sm">{employee.documents.map((s, i) => <li key={i} className="rounded-lg bg-muted p-3">{s}</li>)}</ul>{!employee.documents.length && <p className="text-sm text-muted-foreground">Chưa có hồ sơ.</p>}</SectionCard></div>
    {open && <EmployeeForm employee={employee} onClose={() => setOpen(false)} />}
  </>;
}

export function OrganizationView() {
  const { data } = useBackoffice();
  return <>
    <PageHeader title="Cơ cấu tổ chức" description="Ban Giám đốc → phòng ban → nhân viên. Quan hệ quản lý trực tiếp là dữ liệu đề xuất, cập nhật từ hồ sơ nhân sự." />
    <div className="mb-6 rounded-xl border bg-primary p-5 text-primary-foreground"><p className="font-semibold">Ban Giám đốc</p><p className="mt-1 text-sm">Trần Thế Tài · Giám đốc điều hành (demo)</p></div>
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{departmentOptions.map((d) => {
      const employees = data.employees.filter((e) => e.department === d.value && e.status !== "nghi-viec");
      return <SectionCard key={d.value} title={d.label} description={`${employees.length} nhân viên · gồm cả nhân sự tạm nghỉ`}>
        {!employees.length && <p className="text-sm text-muted-foreground">Chưa phân bổ nhân viên.</p>}
        <ul className="divide-y">{employees.map((e) => <li key={e.id} className="py-3 text-sm"><Link className="font-medium text-primary hover:underline" href={`/hcns/nhan-vien/${e.id}`}>{e.name}</Link><p>{e.position} · {employeeStatuses[e.status]}</p><p className="mt-1 text-xs text-muted-foreground">Quản lý: {data.employees.find((x) => x.id === e.managerId)?.name ?? "Chưa phân công"}</p></li>)}</ul>
      </SectionCard>;
    })}</div>
  </>;
}

function CandidateDetail({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  const { user, actions } = useBackoffice();
  const [status, setStatus] = useState(candidate.status);
  const [tasks, setTasks] = useState(candidate.tasks);
  const flow = Object.keys(candidateStatuses) as Candidate["status"][];
  const index = flow.indexOf(candidate.status);
  const writable = canWrite(user.role, "hrm") && candidate.status !== "hoan-tat";
  return <FormDialog title={candidate.name} description={`${candidate.position} · ${departmentLabels[candidate.department]} · Ngày dự kiến: ${formatDate(candidate.startOn)}. Hoàn tất checklist không tự tạo tài khoản; hồ sơ nhân viên được thêm tại danh sách nhân viên.`} onClose={onClose} onSave={() => writable ? actions.updateCandidate(user, candidate.id, status, tasks) : null} submitLabel={writable ? "Lưu tiến độ" : "Đóng"}>
    <Field label="Giai đoạn" htmlFor="uv-status"><NativeSelect id="uv-status" value={status} disabled={!writable} onChange={(e) => setStatus(e.target.value as Candidate["status"])}>{flow.filter((_, i) => i === index || i === index + 1).map((s) => <option key={s} value={s}>{candidateStatuses[s]}</option>)}</NativeSelect></Field>
    {(candidate.status === "onboarding" || candidate.status === "hoan-tat") && <fieldset className="space-y-3"><legend className="mb-3 font-medium">Checklist onboarding · đề xuất</legend>{onboardingTasks.map((task) => <label key={task} className="flex min-h-9 items-center gap-3"><input type="checkbox" className="size-4" disabled={!writable} checked={tasks.includes(task)} onChange={(e) => setTasks(e.target.checked ? [...tasks, task] : tasks.filter((t) => t !== task))} />{task}</label>)}</fieldset>}
    <InlineAlert tone="info">Luồng đề xuất: Ứng tuyển <ArrowText>{"→"}</ArrowText> Phỏng vấn <ArrowText>{"→"}</ArrowText> Offer <ArrowText>{"→"}</ArrowText> Onboarding <ArrowText>{"→"}</ArrowText> Hoàn tất. Cần đủ checklist để hoàn tất onboarding.</InlineAlert>
  </FormDialog>;
}

export function RecruitmentView() {
  const { data, user, actions } = useBackoffice();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string>();
  const current = data.candidates.find((c) => c.id === selected);
  return <>
    <ListView dateLabel="Dự kiến nhận việc" dateValue={(r) => r.startOn} title="Tuyển dụng & onboarding" description="Pipeline ứng viên và checklist hội nhập ở mức đề xuất. Không gửi email hoặc tạo tài khoản ngoài hệ thống." rows={data.candidates} getRowId={(c) => c.id} searchLabel="Tìm ứng viên" searchPlaceholder="Tên, email, vị trí…" searchText={(c) => [c.name, c.email, c.position]} actions={canWrite(user.role, "hrm") && <Button onClick={() => setCreating(true)}>Thêm ứng viên</Button>}
      filters={[{ id: "department", label: "Mọi phòng ban", options: departmentOptions, match: (c, v) => c.department === v }, { id: "status", label: "Mọi giai đoạn", options: Object.entries(candidateStatuses).map(([value, label]) => ({ value, label })), match: (c, v) => c.status === v }]}
      columns={[
        { key: "name", header: "Ứng viên", cell: (c) => <div><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.email}</p></div> },
        { key: "position", header: "Vị trí", cell: (c) => <div>{c.position}<p className="text-xs text-muted-foreground">{departmentLabels[c.department]}</p></div> },
        { key: "status", header: "Giai đoạn", cell: (c) => <StatusBadge tone={c.status === "hoan-tat" ? "success" : "info"}>{candidateStatuses[c.status]}</StatusBadge> },
        { key: "date", header: "Dự kiến nhận việc", cell: (c) => formatDate(c.startOn) },
        { key: "tasks", header: "Onboarding", cell: (c) => `${c.tasks.length}/${onboardingTasks.length}` },
        { key: "action", header: "Thao tác", cell: (c) => <Button variant="outline" size="sm" onClick={() => setSelected(c.id)}>Xem tiến độ</Button> },
      ]} />
    {current && <CandidateDetail key={current.id} candidate={current} onClose={() => setSelected(undefined)} />}
    {creating && <FormDialog title="Thêm ứng viên" description="Tạo hồ sơ tuyển dụng mẫu, bắt đầu từ giai đoạn ứng tuyển." onClose={() => setCreating(false)} onSave={(f) => actions.addCandidate(user, Object.fromEntries(f))}>
      <Field label="Họ tên" htmlFor="uv-name" required><Input id="uv-name" name="name" required maxLength={120} /></Field>
      <Field label="Email" htmlFor="uv-email" required><Input id="uv-email" name="email" type="email" required /></Field>
      <Field label="Phòng ban" htmlFor="uv-dept"><NativeSelect id="uv-dept" name="department">{departmentOptions.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</NativeSelect></Field>
      <Field label="Vị trí ứng tuyển" htmlFor="uv-position" required><Input id="uv-position" name="position" required maxLength={120} /></Field>
      <Field label="Ngày dự kiến nhận việc" htmlFor="uv-start" required><Input id="uv-start" name="startOn" type="date" defaultValue="2026-11-02" required /></Field>
    </FormDialog>}
  </>;
}

export function AttendanceView() {
  const { data, user, actions } = useBackoffice();
  const [open, setOpen] = useState(false);
  const active = data.employees.filter((e) => !["nghi-viec", "tam-nghi"].includes(e.status));
  const rows = active.map((e) => ({ ...e, attendance: data.attendance.find((a) => a.employeeId === e.id && a.date === CRM_TODAY) }));
  return <>
    <ListView title="Chấm công mock" description="Ngày 28/10/2026 · Nhập giờ thủ công để minh họa; chưa có ca làm, nghỉ phép, tính lương hoặc kết nối máy chấm công." rows={rows} getRowId={(r) => r.id} searchLabel="Tìm chấm công" searchPlaceholder="Tên nhân viên, mã…" searchText={(r) => [r.name, r.id]} actions={canWrite(user.role, "hrm") && <Button disabled={!active.length} onClick={() => setOpen(true)}>Ghi nhận giờ công</Button>}
      filters={[{ id: "department", label: "Mọi phòng ban", options: departmentOptions, match: (r, v) => r.department === v }]}
      columns={[
        { key: "name", header: "Nhân viên", cell: (r) => r.name }, { key: "dept", header: "Phòng ban", cell: (r) => departmentLabels[r.department] },
        { key: "in", header: "Giờ vào", cell: (r) => r.attendance?.checkIn || "—" }, { key: "out", header: "Giờ ra", cell: (r) => r.attendance?.checkOut || "—" },
        { key: "status", header: "Ghi nhận", cell: (r) => <StatusBadge tone={r.attendance?.checkOut ? "success" : "neutral"}>{r.attendance?.checkOut ? "Đã ghi nhận vào/ra" : r.attendance ? "Đã vào, chưa ra" : "Chưa ghi nhận"}</StatusBadge> },
      ]} />
    {open && <FormDialog title="Ghi nhận chấm công" description="Ngày demo 28/10/2026. Lưu lại sẽ thay giờ công hiện có của nhân viên trong ngày; ca qua đêm chưa được mô phỏng." onClose={() => setOpen(false)} onSave={(f) => actions.recordAttendance(user, String(f.get("employeeId")), String(f.get("checkIn")), String(f.get("checkOut")))}>
      <Field label="Nhân viên" htmlFor="cc-employee"><NativeSelect id="cc-employee" name="employeeId">{active.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</NativeSelect></Field>
      <Field label="Giờ vào" htmlFor="cc-in" required><Input id="cc-in" name="checkIn" type="time" required /></Field><Field label="Giờ ra" htmlFor="cc-out"><Input id="cc-out" name="checkOut" type="time" /></Field>
    </FormDialog>}
  </>;
}
