import { z } from "zod";

/** Cùng một schema cho form đăng nhập (FE) và route login (BE). */
export const loginSchema = z.object({
  email: z.string().min(1, "Vui lòng nhập email").email("Email không đúng định dạng"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu").max(128, "Mật khẩu quá dài"),
  remember: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
