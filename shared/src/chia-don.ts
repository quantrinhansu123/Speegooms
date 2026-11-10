import { z } from "zod";

/** Chia đơn báo giá xoay vòng cho Vận hành theo bàn. */
export const assignmentDeskSchema = z.enum(["sourcing", "logistics"]);
export type AssignmentDesk = z.infer<typeof assignmentDeskSchema>;

export const setAssignmentOffSchema = z.object({ off: z.boolean() });

export interface AssignmentMember {
  id: string;
  name: string;
  /** Đang off: không được chia đơn. */
  off: boolean;
  /** leave = có đơn nghỉ phép đã duyệt hôm nay; manual = bật off tay. */
  offReason: "leave" | "manual" | null;
}
