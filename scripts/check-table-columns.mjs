import assert from "node:assert/strict";
import { createServer } from "node:http";
import { chromium } from "playwright";

import { bundleFixture } from "./browser-fixture.mjs";
const fixture = `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Table } from "./src/components/ui/table";
import { TableHScroll } from "./src/features/crm/live/table-h-scroll";
import { DataLanhView } from "./src/features/sales/data-lanh-view";
import { SessionProvider } from "./src/features/auth/session-provider";
import { facebookStatuses, telesaleStatuses } from "@speego/shared";
const sample = (id, name, fb, tele) => ({ id, stt: Number(id), fullName: name, company: "Mẫu kiểm thử", internId: "intern-1", internName: "Intern mẫu", facebookStatus: fb, telesaleStatus: tele, saleCareId: null, saleCareName: null, handedOverAt: null });
const customers = [sample("1", "Khách chuyển mới", facebookStatuses[3], telesaleStatuses[0]), sample("2", "Khách đã gọi", facebookStatuses[4], telesaleStatuses[8]), sample("3", "Khách chuyển dở", facebookStatuses[6], telesaleStatuses[0])];
window.patchCalls = [];
window.failPatch = false;
window.fetch = async (url, options = {}) => {
  if (url === "/api/security/csrf") return Response.json({ token: "fixture-token" });
  if (url === "/api/data-lanh") return Response.json({ rows: customers });
  if (url === "/api/data-lanh/sales") return Response.json({ sales: [{ id: "sale-1", name: "Sale mẫu" }] });
  if (String(url).endsWith("/handover") && options.method === "POST") {
    const row = customers.find(row => row.id === String(url).split("/").at(-2));
    Object.assign(row, { saleCareId: JSON.parse(options.body).saleId, saleCareName: "Sale mẫu", handedOverAt: new Date().toISOString() });
    return Response.json({ row });
  }
  if (String(url).startsWith("/api/data-lanh/") && options.method === "PATCH") {
    window.patchCalls.push(JSON.parse(options.body));
    if (window.failPatch) return Response.json({ error: { message: "Lỗi lưu mẫu" } }, { status: 500 });
    const row = customers.find(row => row.id === String(url).split("/").at(-1));
    Object.assign(row, JSON.parse(options.body));
    return Response.json({ row });
  }
  throw new Error("Unexpected fixture request: " + url);
};
function App() {
  const [empty, setEmpty] = useState(false);
  const [extra, setExtra] = useState(true);
  const [page, setPage] = useState(1);
  const headers = ["STT", "Khách hàng", "Điện thoại", "Facebook", "Telesale", ...(extra ? ["Ghi chú"] : [])];
  const content = <><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
    <tbody>{empty ? <tr><td colSpan={headers.length}>Không có kết quả</td></tr> : <tr>{headers.map((h, i) => <td key={h}>{i === 2 ? <input aria-label="Điện thoại khách" defaultValue="0901234567" /> : h + " " + page}</td>)}</tr>}</tbody></>;
  return <><button onClick={() => setEmpty(!empty)}>Đổi dữ liệu rỗng</button>
    <button onClick={() => setExtra(!extra)}>Đổi bộ cột</button><button onClick={() => setPage(page + 1)}>Trang tiếp</button>
    <section id="wide"><TableHScroll stickyIdentity><table style={{ minWidth: 1500 }}>{content}</table></TableHScroll></section>
    <section id="shared"><Table>{content}</Table></section>
    <section id="small"><Table><thead><tr><th>Mã</th><th>Tên</th></tr></thead><tbody><tr><td>1</td><td>A</td></tr></tbody></Table></section>
    <section id="data-lanh"><SessionProvider user={{ id: "admin", name: "Admin mẫu", role: "admin", email: "fixture@example.invalid", department: "", title: "" }}><DataLanhView /></SessionProvider></section>
  </>;
}
createRoot(document.getElementById("app")).render(<App />);
`;
const bundle = await bundleFixture(fixture);
const server = createServer((req, res) => {
  res.setHeader("Content-Type", req.url === "/app.js" ? "application/javascript" : "text/html; charset=utf-8");
  res.end(req.url === "/app.js" ? bundle : '<style>section{width:900px;margin:20px}th,td{padding:8px;border:1px solid #ddd}table{border-collapse:collapse}button{margin:4px}[data-slot="dropdown-menu-content"]{background:white;max-height:320px;overflow:auto;padding:8px;border:1px solid #ddd}[data-slot="dropdown-menu-checkbox-item"]{padding:5px}[data-slot="dialog-content"]{position:fixed;z-index:100;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:20px;width:400px}[data-slot="dialog-overlay"]{position:fixed;inset:0;z-index:99;background:#0002}</style><div id="app"></div><script src="/app.js"></script>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const wide = page.locator("#wide");
  const shared = page.locator("#shared");
  await wide.getByRole("button", { name: "Cột hiển thị" }).click();
  const items = page.getByRole("menuitemcheckbox");
  assert.equal(await items.count(), 6);
  assert.equal(await page.getByRole("menuitemcheckbox", { checked: true }).count(), 6);
  await page.getByRole("menuitemcheckbox", { name: "Điện thoại", exact: true }).click();
  assert.equal(await wide.getByRole("columnheader", { name: "Điện thoại", exact: true }).count(), 0);
  assert.equal(await wide.getByRole("textbox").count(), 0);
  assert.equal(await shared.getByRole("columnheader", { name: "Điện thoại", exact: true }).count(), 1);
  assert.equal(await wide.locator("th").nth(2).evaluate(el => el.getBoundingClientRect().width), 0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Trang tiếp", exact: true }).click();
  assert.equal(await wide.getByRole("columnheader", { name: "Điện thoại", exact: true }).count(), 0);
  await wide.getByRole("button", { name: "Cột hiển thị" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Điện thoại", exact: true }).click();
  assert.equal(await wide.getByRole("textbox").inputValue(), "0901234567");
  // Hiding either fixed identity column must not leave an offset in the next column.
  await page.getByRole("menuitemcheckbox", { name: "STT", exact: true }).click();
  await page.keyboard.press("Escape");
  assert.equal(await wide.locator("th").first().evaluate(el => el.getBoundingClientRect().width), 0);
  await page.getByRole("button", { name: "Đổi dữ liệu rỗng", exact: true }).click();
  assert.equal(await wide.getByRole("cell", { name: "Không có kết quả", exact: true }).count(), 1);
  await wide.getByRole("button", { name: "Cột hiển thị" }).click();
  for (const name of ["Khách hàng", "Điện thoại", "Facebook", "Telesale"]) await page.getByRole("menuitemcheckbox", { name, exact: true }).click();
  assert.equal(await page.getByRole("menuitemcheckbox", { name: "Ghi chú", exact: true }).isDisabled(), true);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#small").getByRole("button", { name: "Cột hiển thị" }).count(), 0);
  // A role/schema change must not retain a hidden column group when there are only five columns.
  await page.getByRole("button", { name: "Đổi bộ cột", exact: true }).click();
  await wide.locator("colgroup").waitFor({ state: "detached" });
  assert.equal(await wide.getByRole("columnheader").count(), 5);
  const dataLanh = page.locator("#data-lanh");
  await dataLanh.locator("#dl-channel").selectOption("facebook");
  const facebook = name => dataLanh.getByRole("combobox", { name: "Trạng thái chăm Facebook · " + name, exact: true });
  const telesale = name => dataLanh.getByRole("combobox", { name: "Trạng thái Telesale · " + name, exact: true });
  const transferValue = "6. Đã gọi --> chuyển Telesale";
  await facebook("Khách chuyển mới").selectOption(transferValue);
  const dialog = page.getByRole("dialog", { name: "Chuyển khách sang Telesale", exact: true });
  await dialog.waitFor();
  assert.equal(await dialog.getByRole("button", { name: "Chuyển sang Telesale", exact: true }).isDisabled(), true);
  await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
  assert.equal(await page.evaluate(() => window.patchCalls.length), 0);
  assert.equal(await facebook("Khách chuyển mới").inputValue(), "3. Đang chat / Trao đổi nhu cầu");
  await facebook("Khách chuyển mới").selectOption(transferValue);
  await dialog.getByRole("combobox", { name: "Kết quả gọi", exact: true }).selectOption("1. Không nghe máy (Lần 1-2)");
  await page.evaluate(() => window.failPatch = true);
  await dialog.getByRole("button", { name: "Chuyển sang Telesale", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  assert.equal(await dialog.isVisible(), true);
  await page.evaluate(() => window.failPatch = false);
  await dialog.getByRole("button", { name: "Chuyển sang Telesale", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await facebook("Khách chuyển mới").count(), 0);
  assert.equal(await dataLanh.locator("#dl-channel").inputValue(), "facebook");
  await dataLanh.locator("#dl-channel").selectOption("telesale");
  assert.equal(await telesale("Khách chuyển mới").inputValue(), "1. Không nghe máy (Lần 1-2)");
  await dataLanh.locator("#dl-channel").selectOption("facebook");
  await facebook("Khách đã gọi").selectOption(transferValue);
  await facebook("Khách đã gọi").waitFor({ state: "detached" });
  assert.equal(await dialog.count(), 0);
  await telesale("Khách chuyển dở").selectOption("4. Hẹn gọi lại (Khách đang bận/làm nail)");
  await facebook("Khách chuyển dở").waitFor({ state: "detached" });
  await dataLanh.locator("#dl-channel").selectOption("telesale");
  assert.equal(await telesale("Khách đã gọi").inputValue(), "8. Chốt đơn thành công");
  assert.equal(await telesale("Khách chuyển dở").inputValue(), "4. Hẹn gọi lại (Khách đang bận/làm nail)");
  await dataLanh.getByRole("combobox", { name: "Bàn giao Sale care · Khách chuyển mới", exact: true }).selectOption("sale-1");
  await dataLanh.getByText("Đã bàn giao Khách chuyển mới cho Sale mẫu.", { exact: false }).waitFor();
  assert.equal(await telesale("Khách chuyển mới").inputValue(), "1. Không nghe máy (Lần 1-2)");
  assert.deepEqual(errors, []);
  console.log("Table column filters: passed (both shared tables, default selection, hiding, restore, independent tables, empty rows, pagination, dynamic columns, minimum one column)");
  console.log("Data lạnh transfer UI: passed (cancel, required result, retry after failure, transfer, keep current filter, preserve existing result, recover legacy transfer)");
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
