import type { Department } from "./role";

export type Route = "vn" | "global";

export interface Customer {
  id: string;
  name: string;
  route: Route;
  country: string;
}

/** department = phòng đang phụ trách bản ghi tại thời điểm hiện tại. */
export interface Lead {
  id: string;
  createdAt: string;
  source: "ads" | "google" | "organic" | "affiliate";
  route: Route;
  customerId: string;
  department: Department;
}

export interface Rfq {
  id: string;
  leadId: string;
  createdAt: string;
  route: Route;
  customerId: string;
  cargo: string;
  status: "dang-xu-ly" | "da-bao-gia" | "da-chot" | "da-huy";
  department: Department;
}

export type AttentionReason =
  | "qua-han-giao"
  | "cho-coc-lau"
  | "cong-no-qua-han"
  | "khieu-nai"
  | "thieu-chung-tu";

export interface Order {
  id: string;
  rfqId: string;
  customerId: string;
  createdAt: string;
  dueDate: string;
  route: Route;
  department: Department;
  status: "cho-coc" | "dang-thuc-hien" | "hoan-tat" | "da-huy";
  contractValue: number;
  paidAmount: number;
  attention?: AttentionReason;
}

export interface Task {
  id: string;
  title: string;
  department: Department;
  assignee: string;
  dueDate: string;
  priority: "cao" | "trung-binh" | "thap";
  done: boolean;
  orderId?: string;
}

export interface DashboardData {
  /** Ngày tham chiếu "hôm nay" của dữ liệu mock (ISO yyyy-mm-dd). */
  today: string;
  customers: Customer[];
  leads: Lead[];
  rfqs: Rfq[];
  orders: Order[];
  tasks: Task[];
}
