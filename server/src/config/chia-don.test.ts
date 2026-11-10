import assert from "node:assert/strict";
import { test } from "node:test";
import { pickNextAssignee } from "./chia-don";

const order = ["a", "b"];

test("chia xoay vòng a -> b -> a", () => {
  const all = new Set(order);
  assert.equal(pickNextAssignee(order, all, null), "a");
  assert.equal(pickNextAssignee(order, all, "a"), "b");
  assert.equal(pickNextAssignee(order, all, "b"), "a");
});

test("người đang off bị bỏ qua, quay lại khi hết off", () => {
  assert.equal(pickNextAssignee(order, new Set(["a"]), "a"), "a");
  assert.equal(pickNextAssignee(order, new Set(["b"]), null), "b");
  assert.equal(pickNextAssignee(["a", "b", "c"], new Set(["a", "c"]), "a"), "c");
});

test("tất cả đang off hoặc danh sách rỗng thì không chia", () => {
  assert.equal(pickNextAssignee(order, new Set(), "a"), null);
  assert.equal(pickNextAssignee([], new Set(), null), null);
});

test("người chia gần nhất đã rời danh sách thì bắt đầu từ đầu", () => {
  assert.equal(pickNextAssignee(order, new Set(order), "zzz"), "a");
});
