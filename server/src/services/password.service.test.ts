import assert from "node:assert/strict";
import { test } from "node:test";
import { ScryptPasswordHasher } from "./password.service";

test("scrypt hash verifies the same password and rejects another", async () => {
  const hasher = new ScryptPasswordHasher();
  const encoded = await hasher.hash("speego@demo");
  assert.equal(await hasher.verify("speego@demo", encoded), true);
  assert.equal(await hasher.verify("wrong-password", encoded), false);
});

test("rejects a hash that tries to raise the scrypt cost", async () => {
  const hasher = new ScryptPasswordHasher();
  const started = Date.now();
  const ok = await hasher.verify("speego@demo", "scrypt$1048576$8$1$aaaaaaaaaaaaaaaaaaaaaa$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
  assert.equal(ok, false);
  assert.ok(Date.now() - started < 200);
});
