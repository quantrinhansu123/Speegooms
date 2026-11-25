import assert from "node:assert/strict";
import { test } from "node:test";
import { AssignmentController } from "../controllers/chia-don.controller";

const quoteId = "11111111-1111-1111-1111-111111111111";
function setup(role: string, userId: string, current = "a") {
  const calls: unknown[][] = [];
  const notified: unknown[][] = [];
  const repo = {
    assignees: async () => ({ [quoteId]: { id: current, name: "Cur" } }),
    transfer: async (...args: unknown[]) => { calls.push(args); return args[3] === "b" ? { id: "b", name: "B" } : null; },
    quoteCode: async () => "BG-1",
  };
  const notifications = { notifyQuoteTransferred: async (...args: unknown[]) => { notified.push(args); } };
  const c = new AssignmentController(repo as never, notifications as never);
  const run = async (userIdBody: string) => {
    let body: unknown;
    const req = { user: { id: userId, role, name: "X" }, params: { desk: "sourcing", quoteId }, body: { lane: "vn", userId: userIdBody } };
    const res = { status: () => ({ json: (b: unknown) => { body = b; } }) };
    await c.transfer(req as never, res as never);
    return body;
  };
  return { run, calls, notified };
}

test("van-hanh can transfer any quote and the new assignee is notified with the code", async () => {
  const t = setup("van-hanh", "z");
  assert.deepEqual(await t.run("b"), { assignee: { id: "b", name: "B" } });
  assert.equal(t.calls.length, 1);
  assert.equal(t.notified[0][5], "BG-1");
});

test("current assignee can transfer own quote", async () => {
  const t = setup("sourcing", "a");
  await t.run("b");
  assert.equal(t.calls.length, 1);
});

test("another staff member cannot transfer someone else's quote", async () => {
  const t = setup("sourcing", "x");
  await assert.rejects(t.run("b"), { status: 403 });
  assert.equal(t.calls.length, 0);
});

test("target outside the desk list is rejected and nobody is notified", async () => {
  const t = setup("van-hanh", "z");
  await assert.rejects(t.run("nobody"), { status: 422 });
  assert.equal(t.notified.length, 0);
});
