import "server-only";
import { cookies, headers } from "next/headers";
import type { CurrentUser } from "@/types/user";

const SESSION_COOKIES = ["speego_session", "__Host-speego_session"];

function first(value: string | null): string | null {
  const item = value?.split(",")[0]?.trim();
  return item || null;
}

/** SSR gọi BE đã cấu hình; trình duyệt dùng rewrite /api trên tên miền FE. */
async function apiOrigin(): Promise<string> {
  const backend = process.env.API_URL?.trim();
  if (backend) return new URL(backend).origin;
  const headerList = await headers();
  const forwarded = first(headerList.get("x-forwarded-host"));
  const host = first(headerList.get("host"));
  if (process.env.VERCEL === "1") {
    const vercelHost = forwarded ?? host;
    if (vercelHost) return `https://${vercelHost}`;
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  }
  if (host === "localhost" || host?.startsWith("localhost:") || host === "127.0.0.1" || host?.startsWith("127.0.0.1:")) {
    return `http://${host}`;
  }
  return "http://127.0.0.1:3000";
}

export async function getSession(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const header = SESSION_COOKIES.flatMap((name) => {
    const value = jar.get(name)?.value;
    return value ? [`${name}=${value}`] : [];
  }).join("; ");
  if (!header) return null;

  try {
    const res = await fetch(`${await apiOrigin()}/api/auth/me`, {
      headers: { cookie: header },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { user?: CurrentUser };
    return body.user ?? null;
  } catch {
    return null;
  }
}
