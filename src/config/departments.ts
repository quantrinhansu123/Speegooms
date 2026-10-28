import type { Department } from "@/types/role";

export const departmentLabels: Record<Department, string> = {
  marketing: "Marketing",
  "sale-vn": "Sale Việt Nam",
  "sale-global": "Sale Global",
  "van-hanh": "Vận hành",
  "ke-toan": "Kế toán",
  hcns: "HCNS",
  "phap-che": "Pháp chế",
};

export const departmentOptions = Object.entries(departmentLabels).map(([value, label]) => ({
  value: value as Department,
  label,
}));
