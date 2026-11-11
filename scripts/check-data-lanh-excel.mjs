import assert from "node:assert/strict";
import { createServer } from "node:http";
import { chromium } from "playwright";
import { bundleFixture } from "./browser-fixture.mjs";

const bundle = await bundleFixture(`
import React from "react";
import { createRoot } from "react-dom/client";
import { DataLanhView } from "./src/features/sales/data-lanh-view";
import { SessionProvider } from "./src/features/auth/session-provider";
const role = new URLSearchParams(location.search).get("role") || "sale-vn";
const customers = [];
window.calls = [];
window.failImport = false;
window.failExport = false;
window.fetch = async (url, options = {}) => {
  window.calls.push({ url, method: options.method || "GET", body: typeof options.body === "string" ? options.body : null });
  if (url === "/api/security/csrf") return Response.json({ token: "fixture-token" });
  if (url === "/api/data-lanh/sales") return Response.json({ sales: [] });
  if (url === "/api/data-lanh" && options.method === "POST") {
    const input = JSON.parse(options.body);
    if (!input.fullName && !input.phone) return Response.json({ error: { message: "Nhập tên khách hoặc số điện thoại" } }, { status: 422 });
    const row = { ...input, id: "new-id", stt: 1, internId: "sale-1", internName: "Sale test" };
    customers.push(row);
    return Response.json({ row });
  }
  if (url === "/api/data-lanh") return Response.json({ rows: customers });
  if (String(url).startsWith("/api/data-lanh/export")) {
    return window.failExport ? new Response("failed", { status: 500 }) : new Response("Excel fixture", { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } });
  }
  if (url === "/api/data-lanh/import") return window.failImport
    ? Response.json({ error: { message: "Import bị gián đoạn sau khi thêm 1 khách" } }, { status: 503 })
    : Response.json({ created: 2, updated: 0, skipped: 1, errorCount: 1, errors: [{ sheet: "data", row: 4, message: "Tên quá dài" }] });
  throw new Error("Unexpected request " + url);
};
createRoot(document.getElementById("app")).render(<SessionProvider user={{ id: "sale-1", name: "Sale test", role, email: "test@example.invalid", department: "", title: "" }}><DataLanhView /></SessionProvider>);
`);
const server = createServer((req, res) => {
  res.setHeader("Content-Type", req.url?.startsWith("/app.js") ? "application/javascript" : "text/html; charset=utf-8");
  res.end(req.url?.startsWith("/app.js") ? bundle : `<style>button{margin:4px} [data-slot="dialog-content"]{position:fixed;z-index:100;inset:10%;background:white;padding:20px;overflow:auto} [data-slot="dialog-overlay"]{position:fixed;inset:0;background:#0003}</style><div id="app"></div><script src="/app.js"></script>`);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.goto(origin);
  await page.getByRole("button", { name: "Tạo khách hàng", exact: true }).click();
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await page.getByText("Nhập tên khách hoặc số điện thoại", { exact: true }).waitFor();
  await page.getByLabel("Họ và tên khách", { exact: true }).fill("New customer");
  await page.getByLabel("Số điện thoại", { exact: true }).fill("0900123456");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await page.getByText(/Bạn là người phụ trách khách này/).waitFor();
  assert.equal(await page.getByRole("cell", { name: "New customer", exact: true }).count(), 1);
  for (const name of ["Tải Excel", "Tải mẫu"]) {
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name, exact: true }).click()]);
    assert.ok(download.suggestedFilename().endsWith(".xlsx"));
  }
  await page.locator('input[type="file"]').setInputFiles({ name: "customers.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from("fixture") });
  await page.getByText(/Đã thêm 2, cập nhật 0, bỏ qua 1/).waitFor();
  await page.getByText(/Dòng 4: Tên quá dài/).waitFor();
  await page.evaluate(() => { window.failImport = true; window.failExport = true; });
  const loads = await page.evaluate(() => window.calls.filter(call => call.url === "/api/data-lanh" && call.method === "GET").length);
  await page.locator('input[type="file"]').setInputFiles({ name: "retry.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from("fixture") });
  await page.getByText(/Import bị gián đoạn/).waitFor();
  await page.waitForFunction(count => window.calls.filter(call => call.url === "/api/data-lanh" && call.method === "GET").length > count, loads);
  await page.getByRole("button", { name: "Tải Excel", exact: true }).click();
  await page.getByText("Không tải được Excel. Vui lòng thử lại.").waitFor();
  for (const role of ["ban-gd", "sale-intern", "admin", "sale-global"]) {
    await page.goto(`${origin}/?role=${role}`);
    await page.getByRole("button", { name: "Tải Excel", exact: true }).waitFor();
    const create = role === "admin" || role === "sale-global";
    assert.equal(await page.getByRole("button", { name: "Tạo khách hàng", exact: true }).count(), Number(create));
    assert.equal(await page.getByRole("button", { name: "Import Excel", exact: true }).count(), Number(create));
  }
  assert.deepEqual(errors, []);
  console.log("Data lạnh browser: create, validation, template/export downloads, import summary/retry, error handling and role visibility passed.");
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
