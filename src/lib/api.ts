export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function csrfToken(): Promise<string> {
  const res = await fetch("/api/security/csrf", { credentials: "include" });
  if (!res.ok) throw new ApiError(res.status, "Không lấy được mã bảo vệ");
  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new ApiError(500, "Không lấy được mã bảo vệ");
  return body.token;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (method !== "GET" && method !== "HEAD") headers.set("x-csrf-token", await csrfToken());
  const res = await fetch(path, { ...init, headers, credentials: "include" });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as { error?: { message?: string; details?: { message: string }[] } } | null;
  if (!res.ok) {
    const detail = body?.error?.details?.map((item) => item.message).filter(Boolean).join(", ");
    throw new ApiError(res.status, detail || body?.error?.message || "Không thực hiện được");
  }
  return body as T;
}

export async function logout(): Promise<void> {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    window.location.assign("/login");
  }
}
