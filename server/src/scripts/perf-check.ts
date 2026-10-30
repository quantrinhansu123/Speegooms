import type { AddressInfo } from "node:net";
import { config } from "dotenv";
import { createApp } from "../app";
import { loadEnv } from "../config/env";
import { createContainer } from "../container";
import { SLOW_REQUEST_MS } from "../middlewares/request-context";

config({ path: new URL("../../.env", import.meta.url) });

const RUNS = 3;
const users = ["salevn@speego.vn", "sourcing@speego.vn", "logistics@speego.vn", "vanhanh@speego.vn"];

const env = loadEnv();
if (!env.SEED_USER_PASSWORD) throw new Error("Thiếu SEED_USER_PASSWORD");
const password = env.SEED_USER_PASSWORD;
const origin = env.CORS_ORIGINS[0] ?? "http://localhost:3000";

const container = await createContainer(env);
const server = createApp(env, container).listen(0, "127.0.0.1");
await new Promise<void>((resolve, reject) => {
  server.once("listening", resolve);
  server.once("error", reject);
});
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

class Session {
  private cookies = new Map<string, string>();

  async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("origin", origin);
    if (this.cookies.size) headers.set("cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    const res = await fetch(`${base}${path}`, { ...init, headers });
    for (const item of res.headers.getSetCookie()) {
      const [pair = ""] = item.split(";");
      const index = pair.indexOf("=");
      if (index > 0) this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
    return res;
  }

  async login(email: string) {
    const { token } = (await (await this.fetch("/security/csrf")).json()) as { token: string };
    const res = await this.fetch("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": token },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`Đăng nhập ${email} thất bại: ${res.status}`);
  }
}

async function timed(session: Session, path: string): Promise<{ ms: number; status: number }> {
  const started = performance.now();
  const res = await session.fetch(path);
  await res.arrayBuffer();
  return { ms: performance.now() - started, status: res.status };
}

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
}

async function samplePotentialId(session: Session): Promise<string | null> {
  const res = await session.fetch("/crm/rfq-quotes?lane=vn");
  if (!res.ok) return null;
  const body = (await res.json()) as { quotes: { potentialId: string }[] };
  return body.quotes[0]?.potentialId ?? null;
}

const rows: { user: string; path: string; status: number; p95: number }[] = [];
try {
  for (const email of users) {
    const session = new Session();
    await session.login(email);
    const potentialId = await samplePotentialId(session);
    const paths = [
      "/notifications/unread-count",
      "/crm/quotes?lane=vn&desk=sourcing",
      "/crm/quotes?lane=vn&desk=logistics",
      "/crm/rfq-quotes?lane=vn",
      "/crm/potentials?lane=vn",
      "/crm/contracts?lane=vn&view=sale",
      ...(potentialId ? [`/crm/potentials/${potentialId}/tracking?lane=vn`] : []),
    ];
    for (const path of paths) {
      const samples: number[] = [];
      let status = 0;
      for (let run = 0; run < RUNS; run += 1) {
        const result = await timed(session, path);
        samples.push(result.ms);
        status = result.status;
      }
      rows.push({ user: email, path, status, p95: Math.round(p95(samples)) });
    }
  }
} finally {
  server.close();
  await container.close();
}

console.table(rows);
const slow = rows.filter((row) => row.p95 > SLOW_REQUEST_MS);
if (slow.length) {
  console.error(`${slow.length} endpoint vượt ${SLOW_REQUEST_MS}ms`);
  process.exitCode = 1;
} else {
  console.log(`Tất cả endpoint dưới ${SLOW_REQUEST_MS}ms (p95, ${RUNS} lần/endpoint).`);
}
