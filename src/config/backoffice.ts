import type { LegalTicket, TicketStatus } from "@/types/backoffice";

export const complaintStatusLabels: Record<TicketStatus, string> = {
  moi: "Mới", "dang-xu-ly": "Đang xử lý", "cho-khach": "Chờ khách", "hoan-tat": "Hoàn tất",
};
export const legalStatusLabels: Record<LegalTicket["status"], string> = {
  moi: "Mới", "dang-ra-soat": "Đang rà soát", "cho-duyet": "Chờ duyệt", "da-duyet": "Đã duyệt", "tra-lai": "Trả lại",
};
