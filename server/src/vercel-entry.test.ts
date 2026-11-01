import assert from "node:assert/strict";
import { Server } from "node:net";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

test("Vercel entry exports the configured API without starting a listener", { timeout: 20_000 }, async (t) => {
  const overrides = {
    NODE_ENV: "test",
    DB_PROVIDER: "memory",
    VERCEL: "1",
    VERCEL_URL: "backend-test.vercel.app",
    CORS_ORIGINS: "https://frontend-test.example",
    SESSION_SECRET: "test-session-secret-32-characters-min",
    CSRF_SECRET: "test-csrf-secret-32-characters-minimum",
    SEED_USER_PASSWORD: "speego@demo",
    CLOUDINARY_CLOUD_NAME: "",
    CLOUDINARY_API_KEY: "",
    CLOUDINARY_API_SECRET: "",
  };
  const previous = Object.fromEntries(Object.keys(overrides).map((key) => [key, process.env[key]]));
  Object.assign(process.env, overrides);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const listener = t.mock.method(Server.prototype, "listen", () => {
    throw new Error("The Vercel entry must not open an HTTP listener during import");
  });
  const { default: app } = await import("../index");
  assert.equal(typeof app, "function");
  assert.equal(listener.mock.callCount(), 0);
  listener.mock.restore();

  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const health = await fetch(`${origin}/api/health`, {
    headers: { origin: overrides.CORS_ORIGINS },
  });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok" });
  assert.equal(health.headers.get("access-control-allow-origin"), overrides.CORS_ORIGINS);
  assert.equal(health.headers.get("cache-control"), "no-store");
  assert.equal(health.headers.get("x-powered-by"), null);

  const csrf = await fetch(`${origin}/api/security/csrf`);
  assert.equal(csrf.status, 200);
  assert.equal(typeof ((await csrf.json()) as { token: string }).token, "string");
  assert.ok(csrf.headers.get("set-cookie"));
  const me = await fetch(`${origin}/api/auth/me`);
  assert.equal(me.status, 401);
});
