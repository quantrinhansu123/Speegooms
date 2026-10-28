import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "Vui lòng nhập email").email("Email không đúng định dạng"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** DEMO ONLY: mật khẩu dùng chung cho mọi tài khoản mock. */
export const DEMO_PASSWORD = "speego@demo";
