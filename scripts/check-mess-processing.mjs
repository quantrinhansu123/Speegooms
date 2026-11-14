import assert from "node:assert/strict";
import { createServer } from "node:http";
import { chromium } from "playwright";
import { bundleFixture } from "./browser-fixture.mjs";

const bundle = await bundleFixture(`
import React from "react";
import { createRoot } from "react-dom/client";
import { MessView } from "./src/features/crm/live/mess-view";
import { SessionProvider } from "./src/features/auth/session-provider";
const rows = Array.from({length: 205}, (_, i) => ({id: String(i), messCode: "MESS-" + i, customerName: "Khách " + i, saleName: i === 0 ? "Sale An" : "Sale Bình", processingStatus: i === 0 ? "L4" : "L0", status: i === 0 ? "CONVERTED" : "NEW", receivedAt: "2026-11-14", market: "US", handlerId: null}));
window.failPatch = false;
window.fetch = async (url, options = {}) => {
  if (String(url).includes("csrf")) return Response.json({token: "test-token"});
  if (String(url).includes("/processing-status")) {
    if (window.failPatch) return Response.json({error: {message: "Lỗi lưu mẫu"}}, {status: 500});
    const row = rows.find(row => row.id === String(url).split("/").at(-2));
    Object.assign(row, JSON.parse(options.body));
    return Response.json({message: row});
  }
  if (String(url).includes("/api/crm/messages")) {
    const q = new URL(String(url), location.origin).searchParams.get("q");
    return Response.json({messages: q ? rows.filter(row => row.customerName === q) : rows});
  }
  return Response.json({sales: [], notifications: []});
};
createRoot(document.getElementById("app")).render(<SessionProvider user={{id: "admin", name: "Admin", role: "admin"}}><MessView lane="global" /></SessionProvider>);
`);
const server = createServer((req, res) => {
  res.setHeader("Content-Type", req.url === "/app.js" ? "application/javascript" : "text/html; charset=utf-8");
  res.end(req.url === "/app.js" ? bundle : '<div id="app"></div><script src="/app.js"></script>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const group = page.getByRole("group", {name: "Lọc trạng thái xử lý"});
  await group.getByRole("button", {name: "Tất cả (205)", exact: true}).waitFor();
  const headers = await page.getByRole("columnheader").allTextContents();
  assert.equal(headers[5], "Trạng thái xử lý");
  assert.equal(headers[6], "Phân loại");
  assert.ok(headers.includes("Trạng thái chuyển"));
  assert.ok(headers.includes("Nhân viên sale"));
  const saleFilter = page.getByLabel("Nhân viên sale", {exact: true});
  await saleFilter.selectOption("Sale An");
  await page.getByRole("button", {name: "Tìm", exact: true}).click();
  await group.getByRole("button", {name: "Tất cả (1)", exact: true}).waitFor();
  assert.equal(await page.locator("tbody tr").count(), 1);
  assert.equal(await group.getByRole("button", {name: "L0 đã nhận mess (0)", exact: true}).count(), 1);
  await page.getByRole("button", {name: "Xóa lọc", exact: true}).click();
  await group.getByRole("button", {name: "Tất cả (205)", exact: true}).waitFor();
  assert.equal(await saleFilter.inputValue(), "");
  assert.equal(await page.getByLabel("Trạng thái mess", {exact: true}).count(), 1);
  await group.getByRole("button", {name: "L4 đã báo giá (1)", exact: true}).click();
  assert.equal(await page.locator("tbody tr").count(), 1);
  const select = page.getByLabel("Trạng thái xử lý · MESS-0", {exact: true});
  assert.equal(await select.locator("option").count(), 9);
  await select.selectOption("L8");
  await group.getByRole("button", {name: "L8 đã được chăm sóc sau bán (1)", exact: true}).waitFor();
  await group.getByRole("button", {name: "L8 đã được chăm sóc sau bán (1)", exact: true}).click();
  assert.equal(await select.inputValue(), "L8");
  await page.evaluate(() => { window.failPatch = true; });
  await select.selectOption("L6");
  await page.getByText("Lỗi lưu mẫu", {exact: true}).waitFor();
  assert.equal(await select.inputValue(), "L8");
  await page.reload();
  await group.getByRole("button", {name: "L4 đã báo giá (1)", exact: true}).waitFor();
  await page.getByLabel("Tìm kiếm", {exact: true}).fill("Khách 0");
  await page.getByRole("button", {name: "Tìm", exact: true}).click();
  await group.getByRole("button", {name: "Tất cả (1)", exact: true}).waitFor();
  await group.getByRole("button", {name: "L0 đã nhận mess (0)", exact: true}).click();
  await page.getByText("Không có kết quả.", {exact: true}).waitFor();
  assert.equal(await group.getByRole("button", {name: "L4 đã báo giá (1)", exact: true}).count(), 1);
  await page.getByRole("button", {name: "Xóa lọc", exact: true}).click();
  await group.getByRole("button", {name: "Tất cả (205)", exact: true}).waitFor();
  assert.equal(await group.getByRole("button", {name: "Tất cả (205)", exact: true}).getAttribute("aria-pressed"), "true");
  assert.deepEqual(errors, []);
  console.log("Mess browser checks passed: labels, column order, 205-row counts, filtering, converted-row updates, error handling.");
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
