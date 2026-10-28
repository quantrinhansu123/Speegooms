import type { Department } from "@/types/role";

/**
 * DEMO ONLY: bảng lương mô phỏng. Hồ sơ nhân sự chưa có trường lương nên mức lương cơ bản
 * suy ra từ chức danh theo quy tắc dưới đây; không phải dữ liệu lương thật.
 */
export const PAYROLL_MONTH = "10/2026";
/** Tỷ lệ khấu trừ bảo hiểm mô phỏng trên lương cơ bản (chưa tính thuế TNCN). */
export const INSURANCE_RATE = 0.105;

const salaryByPosition: [RegExp, number][] = [
  [/Trưởng phòng/i, 35_000_000],
  [/Trưởng nhóm/i, 28_000_000],
  [/Chuyên viên|Executive|Kế toán/i, 18_000_000],
];
const DEFAULT_SALARY = 15_000_000;
const ALLOWANCE = 1_500_000;

export function simulatedPay(position: string) {
  const base = salaryByPosition.find(([rx]) => rx.test(position))?.[1] ?? DEFAULT_SALARY;
  const insurance = Math.round(base * INSURANCE_RATE);
  return { base, allowance: ALLOWANCE, insurance, net: base + ALLOWANCE - insurance };
}

export type ExpenseStatus = "da-chi" | "cho-duyet";
export interface InternalExpense {
  id: string;
  date: string;
  department: Department;
  category: string;
  description: string;
  amount: number;
  status: ExpenseStatus;
}

export const expenseStatusMeta: Record<ExpenseStatus, { label: string; tone: "success" | "warning" }> = {
  "da-chi": { label: "Đã chi", tone: "success" },
  "cho-duyet": { label: "Chờ duyệt", tone: "warning" },
};

/** DEMO ONLY: chi phí nội bộ tháng 10/2026, độc lập với đề nghị thanh toán nhà cung cấp. */
export const internalExpenses: InternalExpense[] = [
  { id: "CP-1001", date: "2026-10-02", department: "marketing", category: "Phần mềm", description: "Gia hạn công cụ thiết kế và lên lịch bài đăng", amount: 4_800_000, status: "da-chi" },
  { id: "CP-1002", date: "2026-10-05", department: "marketing", category: "Sự kiện", description: "Phí gian hàng triển lãm thương mại điện tử", amount: 12_500_000, status: "da-chi" },
  { id: "CP-1003", date: "2026-10-08", department: "sale-vn", category: "Tiếp khách", description: "Tiếp khách ký hợp đồng quý 4", amount: 3_200_000, status: "da-chi" },
  { id: "CP-1004", date: "2026-10-12", department: "sale-global", category: "Đi lại", description: "Vé và lưu trú gặp đối tác tại Los Angeles", amount: 38_000_000, status: "cho-duyet" },
  { id: "CP-1005", date: "2026-10-14", department: "van-hanh", category: "Văn phòng phẩm", description: "In nhãn, băng keo và tem kiểm hàng", amount: 2_150_000, status: "da-chi" },
  { id: "CP-1006", date: "2026-10-16", department: "van-hanh", category: "Đi lại", description: "Kiểm hàng tại xưởng Đông Quan", amount: 6_400_000, status: "da-chi" },
  { id: "CP-1007", date: "2026-10-19", department: "ke-toan", category: "Phần mềm", description: "Phí phần mềm kế toán và chữ ký số", amount: 5_600_000, status: "da-chi" },
  { id: "CP-1008", date: "2026-10-21", department: "hcns", category: "Văn phòng phẩm", description: "Văn phòng phẩm và nước uống tháng 10", amount: 3_900_000, status: "da-chi" },
  { id: "CP-1009", date: "2026-10-22", department: "hcns", category: "Tuyển dụng", description: "Đăng tin tuyển dụng vị trí Sales Executive", amount: 4_500_000, status: "cho-duyet" },
  { id: "CP-1010", date: "2026-10-24", department: "phap-che", category: "Dịch vụ", description: "Phí công chứng và dịch thuật hợp đồng", amount: 7_300_000, status: "da-chi" },
  { id: "CP-1011", date: "2026-10-26", department: "sale-vn", category: "Marketing", description: "In catalog giới thiệu dịch vụ", amount: 5_200_000, status: "cho-duyet" },
];
