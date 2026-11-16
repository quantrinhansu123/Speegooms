import assert from "node:assert/strict";
import { createServer } from "node:http";
import { chromium } from "playwright";
import { bundleFixture } from "./browser-fixture.mjs";

const bundle = await bundleFixture(`
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { DataLanhView } from './src/features/sales/data-lanh-view';
  import { SessionProvider } from './src/features/auth/session-provider';
  createRoot(document.getElementById('app')).render(<SessionProvider user={{id:'admin',name:'Admin',role:'admin',email:'admin@example.invalid',department:'',title:''}}><DataLanhView /></SessionProvider>);
`);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const rows = Array.from({ length: 55 }, (_, i) => ({
  id: id(i + 1), stt: i + 1, fullName: `Customer ${i + 1}`, company: "Company", phone: `0900${i}`,
  internId: i < 30 ? "sale-a" : "sale-b", internName: i < 30 ? "Sale A" : "Sale B",
  facebookStatus: i < 35 ? "1. Đã gửi tin nhắn (Chờ phản hồi)" : null,
}));
const calls = [];
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (!url.pathname.startsWith("/api/")) {
    res.setHeader("Content-Type", req.url === "/app.js" ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8");
    res.end(req.url === "/app.js" ? bundle : '<div id="app"></div><script src="/app.js"></script>');
    return;
  }
  calls.push(url);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (url.pathname === "/api/data-lanh/sales") return res.end('{"sales":[]}');
  if (url.pathname !== "/api/data-lanh") return res.end("{}");
  const q = (url.searchParams.get("q") ?? "").toLowerCase();
  let matched = rows.filter(row => row.fullName.toLowerCase().includes(q));
  if (url.searchParams.get("intern")) matched = matched.filter(row => row.internId === url.searchParams.get("intern"));
  if (url.searchParams.get("channel") === "facebook") matched = matched.filter(row => row.facebookStatus);
  const pages = Math.max(1, Math.ceil(matched.length / 20));
  let page = Math.min(Number(url.searchParams.get("page") ?? 1), pages);
  const focus = matched.findIndex(row => row.id === url.searchParams.get("focusId"));
  if (focus >= 0) page = Math.floor(focus / 20) + 1;
  const body = { rows: matched.slice((page - 1) * 20, page * 20), page, pages, total: matched.length,
    pageSize: 20, scopeTotal: 55, unassigned: 0, interns: [{id:"sale-a",name:"Sale A",count:30},{id:"sale-b",name:"Sale B",count:25}],
    statusCounts: { "": matched.length, "1. Đã gửi tin nhắn (Chờ phản hồi)": matched.length },
  };
  if (q === "slow") setTimeout(() => res.end(JSON.stringify(body)), 900);
  else res.end(JSON.stringify(body));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const expectCount = (n) => page.waitForFunction(count => document.querySelectorAll("tbody tr[data-row-id]").length === count, n);
  await page.goto(origin);
  await expectCount(20);
  assert.equal(calls.find(url => url.pathname === "/api/data-lanh").searchParams.get("pageSize"), "20");
  await page.getByRole("button", { name: "Trang sau", exact: true }).click();
  await page.locator(`[data-row-id="${id(21)}"]`).waitFor();
  assert.equal(await page.locator("tbody tr[data-row-id]").count(), 20);
  await page.getByRole("button", { name: "Trang sau", exact: true }).click();
  await expectCount(15);
  assert.equal(await page.getByRole("button", { name: "Trang sau", exact: true }).isDisabled(), true);
  await page.getByLabel("Tìm kiếm", { exact: true }).fill("Customer 54");
  await expectCount(1);
  await page.locator(`[data-row-id="${id(54)}"]`).waitFor();
  assert.equal(await page.getByRole("button", { name: "Trang trước", exact: true }).isDisabled(), true);
  await page.getByLabel("Tìm kiếm", { exact: true }).fill("");
  await expectCount(20);
  await page.getByLabel("Phụ trách", { exact: true }).selectOption("sale-b");
  await page.locator(`[data-row-id="${id(31)}"]`).waitFor();
  await page.getByRole("button", { name: "Trang sau", exact: true }).click();
  await expectCount(5);
  await page.getByLabel("Phụ trách", { exact: true }).selectOption("");
  await expectCount(20);
  await page.getByLabel("Trạng thái", { exact: true }).selectOption("facebook");
  await page.getByRole("button", { name: "Tất cả (35)", exact: true }).waitFor();
  await page.getByRole("button", { name: "Trang sau", exact: true }).click();
  await expectCount(15);
  await page.goto(`${origin}/?id=${id(38)}`);
  await page.locator(`[data-row-id="${id(38)}"]`).waitFor();
  assert.match(await page.getByRole("status").last().textContent(), /21–40 \/ 55/);
  await page.getByLabel("Tìm kiếm", { exact: true }).fill("slow");
  await page.waitForRequest(request => new URL(request.url()).searchParams.get("q") === "slow");
  await page.getByLabel("Tìm kiếm", { exact: true }).fill("Customer 54");
  await expectCount(1);
  await page.waitForResponse(response => new URL(response.url()).searchParams.get("q") === "slow");
  await page.locator(`[data-row-id="${id(54)}"]`).waitFor();
  assert.equal(await page.locator("tbody tr[data-row-id]").count(), 1);
  assert.deepEqual(errors, []);
  console.log("Server pagination browser checks passed: 20 rows/page, search, filters, totals, notification focus and stale responses.");
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
