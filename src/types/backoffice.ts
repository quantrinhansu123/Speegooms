import type { LeadSource } from "./crm";
import type { Department } from "./role";

export interface Activity { id: string; at: string; by: string; text: string; orderId: string }
export type TicketStatus = "moi" | "dang-xu-ly" | "cho-khach" | "hoan-tat";
export type CompensationStatus = "chua" | "cho-duyet" | "da-duyet" | "tu-choi";
export interface Complaint {
  id: string; orderId: string; title: string; description: string;
  category: string; priority: string; assigneeId: string; dueOn: string;
  status: TicketStatus; evidence: string[]; result: string;
  compensation: { amount: number; reason: string; status: CompensationStatus };
  history: Activity[];
}
export interface Campaign {
  id: string; name: string; source: LeadSource; startOn: string; endOn: string;
  budget: number; spent: number; status: "dang-chay" | "tam-dung" | "ket-thuc";
}
export interface LeadFeedback {
  id: string; messId: string; quality: string; note: string; by: string; at: string;
}
export interface Employee {
  id: string; name: string; email: string; department: Department; position: string;
  managerId: string; joinedOn: string; status: "thu-viec" | "chinh-thuc" | "tam-nghi" | "nghi-viec";
  contractType: string; contractEnd: string; documents: string[];
}
export interface Candidate {
  id: string; name: string; email: string; department: Department; position: string;
  status: "ung-tuyen" | "phong-van" | "offer" | "onboarding" | "hoan-tat";
  startOn: string; tasks: string[];
}
export interface Attendance { id: string; employeeId: string; date: string; checkIn: string; checkOut: string }
export interface LegalTicket {
  id: string; title: string; refId: string; refType: "hop-dong" | "chung-tu";
  request: string; assigneeId: string; dueOn: string;
  status: "moi" | "dang-ra-soat" | "cho-duyet" | "da-duyet" | "tra-lai";
  opinion: string; history: Activity[];
}
export interface BackofficeSnapshot {
  campaigns: Campaign[]; feedback: LeadFeedback[]; complaints: Complaint[];
  employees: Employee[]; candidates: Candidate[]; attendance: Attendance[]; legal: LegalTicket[];
}
