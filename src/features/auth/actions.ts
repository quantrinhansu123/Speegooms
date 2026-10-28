"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { mockUsers, SESSION_COOKIE } from "@/lib/session";
import { DEMO_PASSWORD, loginSchema, type LoginInput } from "./schema";

/** DEMO ONLY: đối chiếu với dữ liệu mock, không phải xác thực production. */
export async function loginAction(input: LoginInput): Promise<{ error: string } | undefined> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { error: "Thông tin đăng nhập không hợp lệ" };

  const user = mockUsers.find((u) => u.email === parsed.data.email.trim().toLowerCase());
  if (!user || parsed.data.password !== DEMO_PASSWORD) {
    return { error: "Email hoặc mật khẩu không đúng" };
  }

  (await cookies()).set(SESSION_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // ghi nhớ: giữ phiên 30 ngày, mặc định 8 giờ
    maxAge: parsed.data.remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8,
    secure: process.env.NODE_ENV === "production",
  });
  redirect("/dashboard");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
