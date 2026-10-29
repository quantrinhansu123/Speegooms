import assert from "node:assert/strict";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { createApp } from "./app";
import { loadEnv } from "./config/env";
import { createContainer } from "./container";

function mergeCookies(current: string, setCookie: string | string[] | undefined): string {
  const map = new Map<string, string>();
  for (const part of current.split(";").map((item) => item.trim()).filter(Boolean)) {
    const index = part.indexOf("=");
    if (index > 0) map.set(part.slice(0, index), part.slice(index + 1));
  }
  const list = setCookie == null ? [] : Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const item of list) {
    const pair = item.split(";")[0] ?? "";
    const index = pair.indexOf("=");
    if (index > 0) map.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }
  return [...map.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

function send(
  port: number,
  init: { method?: string; path: string; headers?: Record<string, string>; body?: string },
) {
  return new Promise<{ status: number; headers: IncomingHttpHeaders; text: string }>((resolve, reject) => {
    const req = httpRequest(
      {
        host: "127.0.0.1",
        port,
        path: init.path,
        method: init.method ?? "GET",
        headers: init.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            text: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("error", reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

test("auth, csrf, cors and security headers", { timeout: 20_000 }, async () => {
  const env = loadEnv({
    NODE_ENV: "test",
    DB_PROVIDER: "memory",
    SESSION_SECRET: "test-session-secret-32-characters-min",
    CSRF_SECRET: "test-csrf-secret-32-characters-minimum",
    SEED_USER_PASSWORD: "speego@demo",
    CORS_ORIGINS: "http://localhost:3000",
  });
  const container = await createContainer(env);
  const app = createApp(env, container);
  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("listening", () => resolve());
      server.once("error", reject);
    });
    const port = (server.address() as AddressInfo).port;
    const health = await send(port, { path: "/api/health" });
    assert.equal(health.status, 200);
    assert.equal(health.headers["x-powered-by"], undefined);
    assert.equal(health.headers["x-content-type-options"], "nosniff");
    assert.equal(health.headers["cache-control"], "no-store");

    const evil = await send(port, {
      path: "/api/health",
      headers: { origin: "https://evil.example" },
    });
    assert.notEqual(evil.headers["access-control-allow-origin"], "https://evil.example");

    const allowed = await send(port, {
      path: "/api/health",
      headers: { origin: "http://localhost:3000" },
    });
    assert.equal(allowed.headers["access-control-allow-origin"], "http://localhost:3000");

    const denied = await send(port, {
      method: "POST",
      path: "/api/auth/login",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email: "admin@speego.vn", password: "speego@demo" }),
    });
    assert.equal(denied.status, 403);

    const csrf = await send(port, {
      path: "/api/security/csrf",
      headers: { origin: "http://localhost:3000" },
    });
    assert.equal(csrf.status, 200);
    const token = (JSON.parse(csrf.text) as { token: string }).token;
    let jar = mergeCookies("", csrf.headers["set-cookie"]);

    const login = (email: string, password: string) =>
      send(port, {
        method: "POST",
        path: "/api/auth/login",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          "x-csrf-token": token,
          cookie: jar,
        },
        body: JSON.stringify({ email, password }),
      });

    const unknown = await login("missing@speego.vn", "speego@demo");
    const wrong = await login("admin@speego.vn", "not-the-password");
    assert.equal(unknown.status, 401);
    assert.equal(wrong.status, 401);
    assert.equal(JSON.parse(unknown.text).error.message, JSON.parse(wrong.text).error.message);

    const ok = await login("admin@speego.vn", "speego@demo");
    assert.equal(ok.status, 200);
    assert.equal(ok.text.includes("passwordHash"), false);
    assert.equal(ok.text.includes("scrypt"), false);
    const user = (JSON.parse(ok.text) as { user: { email: string; role: string } }).user;
    assert.equal(user.email, "admin@speego.vn");
    assert.equal(user.role, "admin");
    jar = mergeCookies(jar, ok.headers["set-cookie"]);

    const me = await send(port, {
      path: "/api/auth/me",
      headers: { cookie: jar, origin: "http://localhost:3000" },
    });
    assert.equal(me.status, 200);

    const loggedOut = await send(port, {
      method: "POST",
      path: "/api/auth/logout",
      headers: {
        origin: "http://localhost:3000",
        "x-csrf-token": token,
        cookie: jar,
      },
    });
    assert.equal(loggedOut.status, 204);
    jar = mergeCookies(jar, loggedOut.headers["set-cookie"]);

    const after = await send(port, {
      path: "/api/auth/me",
      headers: { cookie: jar, origin: "http://localhost:3000" },
    });
    assert.equal(after.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await container.close();
  }
});
