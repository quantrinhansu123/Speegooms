import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { loginRateLimit } from "./rate-limit";

test("successful logins do not exhaust the limit; failed logins remain limited", async () => {
  const app = express();
  app.post("/login", loginRateLimit, (req, res) => res.sendStatus(req.query.fail === "1" ? 401 : 200));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/login`;
  try {
    for (let index = 0; index < 12; index++) {
      const response = await fetch(url, { method: "POST" });
      await response.text();
      assert.equal(response.status, 200);
    }
    for (let index = 0; index < 10; index++) {
      const response = await fetch(`${url}?fail=1`, { method: "POST" });
      await response.text();
      assert.equal(response.status, 401);
    }
    const response = await fetch(`${url}?fail=1`, { method: "POST" });
    await response.text();
    assert.equal(response.status, 429);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
