import "server-only";
import { cookies } from "next/headers";
import users from "@/mocks/users.json";
import type { CurrentUser } from "@/types/user";

/**
 * DEMO ONLY: session mock. Cookie chỉ chứa id người dùng, không ký, không mã hóa.
 * Thay bằng auth thật (session ký/JWT, kiểm tra phía server) khi có backend.
 */
export const SESSION_COOKIE = "speego_demo_session";

export const mockUsers = users as CurrentUser[];

export async function getSession(): Promise<CurrentUser | null> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  return mockUsers.find((u) => u.id === id) ?? null;
}
