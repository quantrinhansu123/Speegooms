// Run with: node scripts/check-ledger-order-search.mjs (mock API; no real data written).
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { realpathSync } from "node:fs";
import { createServer } from "node:http";
import { dirname } from "node:path";
import { chromium } from "playwright";

const orders = [
  { code: "DH-001", customerName: "Nguyễn Đặng" },
  { code: "DH-002", customerName: "Công ty Bình An" },
];
const saved = [];
const backend = createServer(async (req, res) => {
  res.setHeader("content-type", "application/json");
  let body = {};
  if (req.url === "/api/auth/me") body = { user: { id: "test", name: "Test", email: "test@example.com", role: "ke-toan", department: "Kế toán", title: "Test" } };
  if (req.url === "/api/ke-toan/ledger-orders") body = { orders };
  if (req.url === "/api/ke-toan/ledger") body = { entries: [] };
  if (req.url === "/api/ke-toan/statements") body = { statements: [] };
  if (req.url === "/api/security/csrf") body = { token: "test" };
  if (req.method === "POST") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    saved.push(JSON.parse(raw));
  }
  res.end(JSON.stringify(body));
});
backend.listen(4317, "127.0.0.1");
await once(backend, "listening");
const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--port", "3317"], {
  env: { ...process.env, API_URL: "http://127.0.0.1:4317", TURBOPACK_ROOT: dirname(realpathSync("node_modules")) },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
app.stdout.on("data", chunk => { log += chunk; });
app.stderr.on("data", chunk => { log += chunk; });
let browser;
try {
  for (let attempt = 0; attempt < 90; attempt++) {
    if (log.includes("Ready in")) break;
    if (app.exitCode !== null) throw new Error(log);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  browser = await chromium.launch({ channel: "msedge" });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.context().addCookies([{ name: "speego_session", value: "test", url: "http://localhost:3317" }]);
  await page.goto("http://localhost:3317/ke-toan/thu-chi");
  await page.getByRole("button", { name: "Nhập mới", exact: true }).click();
  const input = page.getByRole("combobox", { name: "Đơn hàng", exact: true });
  assert.equal(await input.count(), 1);
  await page.getByRole("button", { name: "Mở danh sách đơn hàng" }).click();
  await page.getByRole("option", { name: /DH-002/ }).waitFor();
  await input.fill("nguyen dang");
  await page.getByRole("option", { name: /DH-001/ }).waitFor();
  assert.equal(await page.getByRole("option").count(), 1);
  await input.press("ArrowDown");
  await input.press("Enter");
  assert.match(await input.inputValue(), /DH-001/);
  assert.equal(await page.locator("#ledger-counterparty").inputValue(), orders[0].customerName);
  await input.fill("no-such-order");
  await page.getByText("Không có đơn hàng phù hợp.", { exact: true }).waitFor();
  await input.press("Escape");
  assert.match(await input.inputValue(), /DH-001/);
  await page.getByRole("button", { name: "Bỏ chọn đơn hàng" }).click();
  assert.equal(await input.inputValue(), "");
  await input.fill("dh-002");
  await page.getByRole("option", { name: /DH-002/ }).click();
  await page.locator("#ledger-amount").fill("100000");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].orderCode, "DH-002");
  assert.equal(saved[0].counterparty, orders[0].customerName);
  console.log("PASS: combined search/dropdown, accent-insensitive search, keyboard selection, Escape, clear and saved order code on mobile.");
} catch (error) {
  console.error(log);
  throw error;
} finally {
  await browser?.close();
  app.kill();
  backend.close();
}
