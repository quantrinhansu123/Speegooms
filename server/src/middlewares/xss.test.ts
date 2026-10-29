import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanText, sanitizeUnknown } from "./xss";

test("strips markup from strings", () => {
  const cleaned = cleanText("<script>alert(1)</script>Xin chào");
  assert.equal(cleaned.toLowerCase().includes("<script"), false);
  assert.equal(cleaned.includes("Xin chào"), true);
});

test("drops prototype and operator keys", () => {
  const clean = sanitizeUnknown({
    constructor: { admin: true },
    $gt: "",
    name: "<img src=x onerror=alert(1)>ok",
  }) as Record<string, unknown>;

  assert.equal(Object.hasOwn(clean, "constructor"), false);
  assert.equal(clean.$gt, undefined);
  assert.equal(String(clean.name).toLowerCase().includes("<img"), false);
  assert.equal(String(clean.name).includes("ok"), true);
});

test("rejects a payload that is too deep", () => {
  let value: unknown = "leaf";
  for (let i = 0; i < 12; i += 1) value = { child: value };
  assert.throws(() => sanitizeUnknown(value), /sâu|PAYLOAD_REJECTED|quá/);
});
