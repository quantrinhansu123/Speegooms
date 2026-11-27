import assert from "node:assert/strict";
import test from "node:test";
import { opsContractSchema } from "@speego/shared";
const base = { opsStatus: "", tracking: "", note1: "", note2: "", chinaWarehouseOn: "", containerOn: "", arrivalOn: "" };
test("deliveryOn optional", () => {
  assert.equal(opsContractSchema.safeParse({ ...base, deliveryOn: "" }).success, true);
  assert.equal(opsContractSchema.safeParse({ ...base, deliveryOn: "2026-12-01" }).success, true);
  assert.equal(opsContractSchema.safeParse({ ...base, deliveryOn: "abc" }).success, false);
  assert.equal(opsContractSchema.safeParse({ ...base, arrivalOn: "2026-12-05", deliveryOn: "2026-12-01" }).success, false);
});
