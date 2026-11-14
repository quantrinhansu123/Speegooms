import { z } from "zod";
import { publicUserSchema, roleSchema } from "./user";
import { newPasswordSchema } from "./auth";

export const updateRoleSchema = z.object({
  role: roleSchema,
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const updateUserSchema = publicUserSchema.omit({ id: true }).extend({
  name: z.string().trim().min(1, "Vui lòng nhập họ tên").max(120),
  email: z.string().trim().toLowerCase().email("Email không đúng định dạng").max(254),
  department: z.string().trim().min(1, "Vui lòng nhập phòng ban").max(120),
  title: z.string().trim().min(1, "Vui lòng nhập chức danh").max(120),
});
export const createUserSchema = updateUserSchema.extend({ password: newPasswordSchema });
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
