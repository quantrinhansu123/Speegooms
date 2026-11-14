import assert from "node:assert/strict";
import { createServer } from "node:http";
import { chromium } from "playwright";
import { bundleFixture } from "./browser-fixture.mjs";

const bundle = await bundleFixture(`
import React from "react";
import { createRoot } from "react-dom/client";
import { DataLanhRecipients } from "./src/features/settings/data-lanh-recipients";
const users = [
  { id: "a", name: "Sale A", email: "a@test", role: "sale-vn" },
  { id: "tu", name: "Tô Nhất Tú", email: "sale07@speegocorp.com", role: "sale-vn" },
  { id: "admin", name: "Admin", email: "admin@test", role: "admin" },
];
let recipients = users.slice(0, 1);
window.failNext = false;
window.fetch = async (url, options = {}) => {
  if (url === "/api/security/csrf") return Response.json({ token: "token" });
  if (url === "/api/users") return Response.json({ users });
  if (url === "/api/data-lanh/recipients") {
    if (!options.method || options.method === "GET") return Response.json({ recipients });
    if (window.failNext) {
      window.failNext = false;
      return Response.json({ error: { message: "Không lưu được, thử lại" } }, { status: 503 });
    }
    const { userId } = JSON.parse(options.body);
    recipients = options.method === "POST" ? [...recipients, users.find(u => u.id === userId)] : recipients.filter(r => r.id !== userId);
    return Response.json({ assigned: 8, interns: recipients.length });
  }
  throw new Error("Unexpected request " + url);
};
createRoot(document.getElementById("app")).render(<DataLanhRecipients />);
`);
const server = createServer((req, res) => {
  res.setHeader("Content-Type", req.url === "/app.js" ? "application/javascript" : "text/html; charset=utf-8");
  res.end(req.url === "/app.js" ? bundle : '<div id="app"></div><script src="/app.js"></script>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", err => { errors.push(err.message); console.error(err.message); });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const select = page.getByLabel("Tài khoản Sale nhận data");
  const add = page.getByRole("button", { name: "Thêm người", exact: true });
  const removeA = page.getByRole("button", { name: "Bỏ Sale A khỏi vòng" });
  await removeA.waitFor();
  assert.equal(await removeA.isDisabled(), true);
  assert.equal(await add.isDisabled(), true);
  assert.deepEqual(await select.locator("option").evaluateAll(options => options.map(o => o.value)), ["", "tu"]);
  await select.selectOption("tu");
  await page.evaluate(() => { window.failNext = true; });
  await add.click();
  await page.getByText("Không lưu được, thử lại", { exact: true }).waitFor();
  assert.equal(await add.isEnabled(), true);
  await add.click();
  const removeTu = page.getByRole("button", { name: "Bỏ Tô Nhất Tú khỏi vòng" });
  await removeTu.waitFor();
  await page.getByText(/Đã chia lại 8 khách chưa xử lý cho 2 người/).waitFor();
  assert.equal(await select.locator('option[value="tu"]').count(), 0);
  await removeTu.click();
  await page.getByText(/Đã chia lại 8 khách chưa xử lý cho 1 người/).waitFor();
  await page.waitForFunction(() => document.querySelector('option[value="tu"]'));
  assert.equal(await removeA.isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log("Data recipients browser: candidates, add, remove, last recipient protection and error/retry passed.");
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
