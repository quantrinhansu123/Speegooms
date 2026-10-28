import { CRM_TODAY, roleRouteScope } from "@/config/crm";
import { complaintStatusLabels, legalStatusLabels } from "@/config/backoffice";
import { getSnapshot as getCrm } from "@/features/crm/store";
import { getSnapshot as getOps } from "@/features/operations/store";
import { backofficeSeed } from "@/mocks/backoffice";
import users from "@/mocks/users.json";
import { createLocalRepository } from "@/services/repository-factory";
import { createStore } from "@/services/store-factory";
import { campaignSchema, candidateSchema, canApprove, canWrite, complaintSchema, complaintTransitionError, compensationSchema, date, employeeSchema, feedbackSchema, legalSchema, legalTransitions, noteSchema, onboardingTasks } from "@/services/backoffice/rules";
import type { Activity, BackofficeSnapshot, Candidate, Complaint, Employee, LegalTicket } from "@/types/backoffice";
import type { CurrentUser } from "@/types/user";

const empty: BackofficeSnapshot = { campaigns: [], feedback: [], complaints: [], employees: [], candidates: [], attendance: [], legal: [] };
const store = createStore(createLocalRepository<BackofficeSnapshot>("speego-backoffice-v1", async () => backofficeSeed()), empty);
export const { subscribe, getSnapshot, getServerSnapshot, start } = store;
export const resetBackoffice = store.reset;
const denied = "Vai trò hiện tại không có quyền thao tác";
const now = () => `${CRM_TODAY}T${new Date().toTimeString().slice(0, 8)}`;
const activity = (user: CurrentUser, text: string, orderId = ""): Activity => ({ id: crypto.randomUUID(), at: now(), by: user.id, text, orderId });
const id = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
const assigned = (staffId: string, role: string) => users.some((u) => u.id === staffId && u.role === role);
export function visibleOrderIds(user: CurrentUser) {
  const scope = roleRouteScope[user.role];
  return new Set(getCrm().data.contracts.filter((c) => !scope || c.route === scope).map((c) => c.orderId));
}

export const actions = {
  saveCampaign(user: CurrentUser, input: unknown) {
    if (!canWrite(user.role, "marketing")) return denied;
    const parsed = campaignSchema.safeParse(input);
    if (!parsed.success) return parsed.error.issues[0].message;
    store.commit((d) => ({ ...d, campaigns: [...d.campaigns, { ...parsed.data, id: id("CD"), status: "dang-chay" }] }));
    return null;
  },
  toggleCampaign(user: CurrentUser, campaignId: string) {
    if (!canWrite(user.role, "marketing")) return denied;
    const current = getSnapshot().data.campaigns.find((c) => c.id === campaignId);
    if (!current || current.status === "ket-thuc") return "Chiến dịch không khả dụng";
    store.commit((d) => ({ ...d, campaigns: d.campaigns.map((c) => c.id === campaignId ? { ...c, status: c.status === "dang-chay" ? "tam-dung" : "dang-chay" } : c) }));
    return null;
  },
  addFeedback(user: CurrentUser, input: unknown) {
    if (!canWrite(user.role, "feedback")) return denied;
    const parsed = feedbackSchema.safeParse(input);
    if (!parsed.success) return parsed.error.issues[0].message;
    const lead = getCrm().data.leads.find((l) => l.messId === parsed.data.messId);
    const scope = roleRouteScope[user.role];
    if (!lead || (scope && lead.goodsOrigin !== (scope === "vn" ? "vn" : "cn"))) return "Lead không thuộc phạm vi của bạn";
    store.commit((d) => ({ ...d, feedback: [{ ...parsed.data, id: id("PH"), by: user.id, at: now() }, ...d.feedback] }));
    return null;
  },
  createComplaint(user: CurrentUser, input: unknown) {
    if (!canWrite(user.role, "complaints") && !canWrite(user.role, "feedback")) return denied;
    const parsed = complaintSchema.safeParse(input);
    if (!parsed.success) return parsed.error.issues[0].message;
    const value = parsed.data;
    if (!visibleOrderIds(user).has(value.orderId)) return "Đơn hàng không khả dụng trong phạm vi của bạn";
    if (!assigned(value.assigneeId, "van-hanh")) return "Chọn người xử lý thuộc Vận hành";
    if (value.dueOn < CRM_TODAY) return "Thời hạn không được trước ngày demo hôm nay";
    const item: Complaint = { ...value, id: id("KN"), evidence: value.evidence ? [value.evidence] : [], status: "moi", result: "", compensation: { amount: 0, reason: "", status: "chua" }, history: [activity(user, "Tạo khiếu nại", value.orderId)] };
    store.commit((d) => ({ ...d, complaints: [item, ...d.complaints] }));
    return null;
  },
  updateComplaint(user: CurrentUser, ticketId: string, input: { assigneeId: string; dueOn: string; status: Complaint["status"]; result: string; note: string; evidence: string }) {
    if (!canWrite(user.role, "complaints")) return denied;
    const ticket = getSnapshot().data.complaints.find((c) => c.id === ticketId);
    if (!ticket || ticket.status === "hoan-tat") return "Ticket đã đóng hoặc không tồn tại";
    if (!assigned(input.assigneeId, "van-hanh") || !date.safeParse(input.dueOn).success) return "Người xử lý hoặc thời hạn không hợp lệ";
    if ([input.result, input.note, input.evidence].some((s) => s.length > 2000)) return "Mỗi nội dung tối đa 2.000 ký tự";
    if (input.status !== ticket.status) {
      const error = complaintTransitionError(ticket, input.status, input.result);
      if (error) return error;
    }
    const details = [
      `Cập nhật xử lý: ${complaintStatusLabels[input.status]}`,
      `Người xử lý: ${users.find((u) => u.id === input.assigneeId)?.name}; hạn: ${input.dueOn}`,
      input.note.trim(),
      input.evidence.trim() && `Thêm bằng chứng: ${input.evidence.trim()}`,
      input.result.trim() && `Kết quả: ${input.result.trim()}`,
    ].filter(Boolean).join(". ");
    store.commit((d) => ({
      ...d,
      complaints: d.complaints.map((c) => c.id !== ticketId ? c : {
        ...c, assigneeId: input.assigneeId, dueOn: input.dueOn, status: input.status,
        result: input.result.trim(),
        evidence: input.evidence.trim() ? [...c.evidence, input.evidence.trim()] : c.evidence,
        history: [...c.history, activity(user, details, c.orderId)],
      }),
    }));
    return null;
  },
  proposeCompensation(user: CurrentUser, ticketId: string, input: unknown) {
    if (!canWrite(user.role, "complaints")) return denied;
    const parsed = compensationSchema.safeParse(input);
    if (!parsed.success) return "Nhập số tiền dương hợp lệ (tối đa 1.000 tỷ VND) và lý do";
    const ticket = getSnapshot().data.complaints.find((c) => c.id === ticketId);
    if (!ticket || ticket.status === "moi" || ticket.status === "hoan-tat" || !["chua", "tu-choi"].includes(ticket.compensation.status)) return "Chưa thể gửi đề xuất ở trạng thái này";
    store.commit((d) => ({ ...d, complaints: d.complaints.map((c) => c.id !== ticketId ? c : { ...c, compensation: { ...parsed.data, status: "cho-duyet" }, history: [...c.history, activity(user, `Đề xuất đền bù ${parsed.data.amount} VND: ${parsed.data.reason}`, c.orderId)] }) }));
    return null;
  },
  decideCompensation(user: CurrentUser, ticketId: string, approve: boolean, reason: string) {
    if (!canApprove(user.role)) return denied;
    if (!noteSchema.safeParse(reason).success) return "Cần ghi lý do quyết định (tối đa 2.000 ký tự)";
    const ticket = getSnapshot().data.complaints.find((c) => c.id === ticketId);
    if (!ticket || ticket.compensation.status !== "cho-duyet") return "Không có đề xuất chờ duyệt";
    store.commit((d) => ({ ...d, complaints: d.complaints.map((c) => c.id !== ticketId ? c : { ...c, compensation: { ...c.compensation, status: approve ? "da-duyet" : "tu-choi" }, history: [...c.history, activity(user, `${approve ? "Duyệt" : "Từ chối"} đền bù mô phỏng: ${reason.trim()}`, c.orderId)] }) }));
    return null;
  },
  saveEmployee(user: CurrentUser, employeeId: string | undefined, input: unknown) {
    if (!canWrite(user.role, "hrm")) return denied;
    const parsed = employeeSchema.safeParse(input);
    if (!parsed.success) return parsed.error.issues[0].message;
    const d = getSnapshot().data;
    if (employeeId && !d.employees.some((e) => e.id === employeeId)) return "Không tìm thấy nhân viên";
    const value = parsed.data;
    if (d.employees.some((e) => e.email.toLowerCase() === value.email.toLowerCase() && e.id !== employeeId)) return "Email đã có trong hồ sơ nhân sự";
    const seen = new Set(employeeId ? [employeeId] : []);
    let manager = value.managerId;
    while (manager) {
      if (seen.has(manager)) return "Cơ cấu quản lý không được tạo vòng lặp";
      seen.add(manager);
      const parent = d.employees.find((e) => e.id === manager);
      if (!parent || parent.status === "nghi-viec") return "Người quản lý không khả dụng";
      manager = parent.managerId;
    }
    const item: Employee = { ...value, id: employeeId ?? id("NV"), documents: value.documents.split("\n").map((s) => s.trim()).filter(Boolean) };
    store.commit((s) => ({ ...s, employees: employeeId ? s.employees.map((e) => e.id === employeeId ? item : e) : [...s.employees, item] }));
    return null;
  },
  deleteEmployee(user: CurrentUser, employeeId: string) {
    if (!canWrite(user.role, "hrm")) return denied;
    const d = getSnapshot().data;
    if (!d.employees.some((e) => e.id === employeeId)) return "Không tìm thấy nhân viên";
    if (d.employees.some((e) => e.managerId === employeeId)) return "Nhân viên đang là người quản lý trực tiếp của người khác";
    store.commit((s) => ({ ...s, employees: s.employees.filter((e) => e.id !== employeeId), attendance: s.attendance.filter((a) => a.employeeId !== employeeId) }));
    return null;
  },
  saveCandidate(user: CurrentUser, candidateId: string, input: unknown) {
    if (!canWrite(user.role, "hrm")) return denied;
    const parsed = candidateSchema.safeParse(input);
    if (!parsed.success) return parsed.error.issues[0].message;
    if (!getSnapshot().data.candidates.some((c) => c.id === candidateId)) return "Không tìm thấy ứng viên";
    store.commit((d) => ({ ...d, candidates: d.candidates.map((c) => c.id === candidateId ? { ...c, ...parsed.data } : c) }));
    return null;
  },
  deleteCandidate(user: CurrentUser, candidateId: string) {
    if (!canWrite(user.role, "hrm")) return denied;
    if (!getSnapshot().data.candidates.some((c) => c.id === candidateId)) return "Không tìm thấy ứng viên";
    store.commit((d) => ({ ...d, candidates: d.candidates.filter((c) => c.id !== candidateId) }));
    return null;
  },
  addCandidate(user: CurrentUser, input: unknown) {
    if (!canWrite(user.role, "hrm")) return denied;
    const parsed = candidateSchema.safeParse(input);
    if (!parsed.success) return parsed.error.issues[0].message;
    store.commit((d) => ({ ...d, candidates: [...d.candidates, { ...parsed.data, id: id("UV"), status: "ung-tuyen", tasks: [] }] }));
    return null;
  },
  updateCandidate(user: CurrentUser, candidateId: string, next: Candidate["status"], tasks: string[]) {
    if (!canWrite(user.role, "hrm")) return denied;
    const flow: Candidate["status"][] = ["ung-tuyen", "phong-van", "offer", "onboarding", "hoan-tat"];
    const current = getSnapshot().data.candidates.find((c) => c.id === candidateId);
    if (!current || current.status === "hoan-tat" || (next !== current.status && flow.indexOf(next) !== flow.indexOf(current.status) + 1)) return "Bước tuyển dụng không hợp lệ";
    if (tasks.some((t) => !onboardingTasks.includes(t)) || (current.status !== "onboarding" && tasks.length)) return "Checklist chỉ dành cho bước onboarding";
    if (next === "hoan-tat" && !onboardingTasks.every((t) => tasks.includes(t))) return "Cần hoàn tất toàn bộ checklist onboarding";
    store.commit((d) => ({ ...d, candidates: d.candidates.map((c) => c.id === candidateId ? { ...c, status: next, tasks: [...new Set(tasks)] } : c) }));
    return null;
  },
  recordAttendance(user: CurrentUser, employeeId: string, checkIn: string, checkOut: string) {
    if (!canWrite(user.role, "hrm")) return denied;
    if (!getSnapshot().data.employees.some((e) => e.id === employeeId && !["nghi-viec", "tam-nghi"].includes(e.status))) return "Nhân viên không ở trạng thái làm việc";
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!time.test(checkIn) || (checkOut && (!time.test(checkOut) || checkOut <= checkIn))) return "Giờ ra phải sau giờ vào, định dạng HH:mm";
    store.commit((d) => ({ ...d, attendance: [...d.attendance.filter((a) => a.employeeId !== employeeId || a.date !== CRM_TODAY), { id: id("CC"), employeeId, date: CRM_TODAY, checkIn, checkOut }] }));
    return null;
  },
  createLegal(user: CurrentUser, input: unknown) {
    if (!canWrite(user.role, "legal")) return denied;
    const parsed = legalSchema.safeParse(input);
    if (!parsed.success) return parsed.error.issues[0].message;
    const value = parsed.data;
    if (!assigned(value.assigneeId, "phap-che")) return "Chọn người thuộc Pháp chế";
    const exists = value.refType === "hop-dong" ? getCrm().data.contracts.some((c) => c.orderId === value.refId) : getOps().data.documents.some((d) => d.docId === value.refId);
    if (!exists) return "Hợp đồng/chứng từ không tồn tại";
    if (value.dueOn < CRM_TODAY) return "Thời hạn không được trước ngày demo hôm nay";
    store.commit((d) => ({ ...d, legal: [{ ...value, id: id("PL"), status: "moi", opinion: "", history: [activity(user, "Tạo yêu cầu ý kiến pháp lý")] }, ...d.legal] }));
    return null;
  },
  updateLegal(user: CurrentUser, ticketId: string, next: LegalTicket["status"], opinion: string) {
    const approving = next === "da-duyet" || next === "tra-lai";
    if (approving ? !canApprove(user.role) : !canWrite(user.role, "legal")) return denied;
    const ticket = getSnapshot().data.legal.find((t) => t.id === ticketId);
    if (!ticket || !legalTransitions[ticket.status].includes(next)) return "Chuyển trạng thái không hợp lệ";
    if (!noteSchema.safeParse(opinion).success) return "Cần nhập ý kiến/lý do (tối đa 2.000 ký tự)";
    store.commit((d) => ({ ...d, legal: d.legal.map((t) => t.id === ticketId ? { ...t, status: next, opinion: opinion.trim(), history: [...t.history, activity(user, `${legalStatusLabels[next]}: ${opinion.trim()}`)] } : t) }));
    return null;
  },
};
