export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type ErrorBody = {
  error?: { code?: string; message?: string; details?: { message: string }[] };
} | null;

let cachedCsrf: string | null = null;
let csrfInFlight: Promise<string> | null = null;

function clearCsrf(): void {
  cachedCsrf = null;
}

async function fetchCsrfToken(): Promise<string> {
  const res = await fetch("/api/security/csrf", { credentials: "include" });
  if (!res.ok) throw new ApiError(res.status, "Không lấy được mã bảo vệ");
  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new ApiError(500, "Không lấy được mã bảo vệ");
  cachedCsrf = body.token;
  return body.token;
}

/** Một token dùng chung — tránh race khi nhiều request song song đều issue CSRF mới. */
async function csrfToken(force = false): Promise<string> {
  if (!force && cachedCsrf) return cachedCsrf;
  if (!force && csrfInFlight) return csrfInFlight;
  const request = fetchCsrfToken().finally(() => {
    if (csrfInFlight === request) csrfInFlight = null;
  });
  csrfInFlight = request;
  return request;
}

function errorMessage(body: ErrorBody): string {
  const detail = body?.error?.details?.map((item) => item.message).filter(Boolean).join(", ");
  return detail || body?.error?.message || "Không thực hiện được";
}

async function parseBody(res: Response): Promise<ErrorBody | unknown> {
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const needsCsrf = method !== "GET" && method !== "HEAD";

  const send = async (forceCsrf: boolean) => {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    if (needsCsrf) headers.set("x-csrf-token", await csrfToken(forceCsrf));
    return fetch(path, { ...init, headers, credentials: "include" });
  };

  let res = await send(false);
  let body = (await parseBody(res)) as ErrorBody;

  if (!res.ok && needsCsrf && res.status === 403 && body?.error?.code === "CSRF_INVALID") {
    clearCsrf();
    res = await send(true);
    body = (await parseBody(res)) as ErrorBody;
  }

  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    throw new ApiError(res.status, errorMessage(body), body?.error?.code);
  }
  return body as T;
}

export async function logout(): Promise<void> {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    clearCsrf();
    window.location.assign("/login");
  }
}
