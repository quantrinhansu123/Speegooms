import type { AttentionReason, Order, Task } from "@/types/dashboard";
import type { StatusTone } from "@/types/status";

export const attentionLabels: Record<AttentionReason, { label: string; tone: StatusTone }> = {
  "qua-han-giao": { label: "Quá hạn giao hàng", tone: "danger" },
  "cong-no-qua-han": { label: "Công nợ quá hạn", tone: "danger" },
  "cho-coc-lau": { label: "Chờ cọc quá 2 ngày", tone: "warning" },
  "thieu-chung-tu": { label: "Thiếu chứng từ", tone: "warning" },
  "khieu-nai": { label: "Có khiếu nại", tone: "warning" },
};

export const orderStatusLabels: Record<Order["status"], string> = {
  "cho-coc": "Chờ cọc",
  "dang-thuc-hien": "Đang thực hiện",
  "hoan-tat": "Hoàn tất",
  "da-huy": "Đã hủy",
};

export const priorityLabels: Record<Task["priority"], string> = {
  cao: "Ưu tiên cao",
  "trung-binh": "Ưu tiên vừa",
  thap: "Ưu tiên thấp",
};

export const routeLabels = { vn: "Việt Nam", global: "Global" } as const;
