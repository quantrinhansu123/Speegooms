import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("tsx/package.json"))("esbuild");

test("admin sees and searches both Logistics lanes, and edits each quote on its own lane", async () => {
  const stubs = {
    "quote-editor.tsx": `export function QuoteEditor({quote, onSave, onSend, onClose}) { return <div role="region" aria-label="Editor">
      <button onClick={() => onSave({}, {close: false})}>Save probe</button>
      <button onClick={() => onSend({})}>Send probe</button>
      <button onClick={onClose}>Close probe</button></div>; }`,
    "quote-output.ts": "export const quoteOutputRunners = {};",
    "quote-language-dialog.tsx": "export const QuoteLanguageDialog = () => null; export const quoteOutputText = {};",
    "assignment-dialog.tsx": "export const AssignmentDialog = () => null;",
  };
  const bundle = await build({
    stdin: {
      resolveDir: fileURLToPath(new URL(".", import.meta.url)), loader: "tsx",
      contents: `import React from "react"; import {createRoot} from "react-dom/client";
        import {SessionProvider} from "@/features/auth/session-provider";
        import {QuoteDeskView} from "./quotes-view";
        const params = new URLSearchParams(location.search);
        createRoot(document.getElementById("root")).render(<SessionProvider user={{id:"test",role:params.get("role") || "admin"}}>
          <QuoteDeskView desk={params.get("desk") || "logistics"}/></SessionProvider>);`,
    },
    plugins: [{ name: "isolate-quote-desk", setup(builder) {
      builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "test" }));
      builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: "export default function Link(props) { return <a {...props}/>; }", loader: "tsx", resolveDir: fileURLToPath(new URL(".", import.meta.url)) }));
      builder.onLoad({ filter: /[\\/](quote-editor\.tsx|quote-output\.ts|quote-language-dialog\.tsx|assignment-dialog\.tsx)$/ }, (args) => ({
        contents: stubs[args.path.split(/[\\/]/).at(-1)], loader: "tsx",
      }));
    } }],
    bundle: true, write: false,
    tsconfig: fileURLToPath(new URL("../../../../tsconfig.json", import.meta.url)),
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const quotes = Object.fromEntries(["vn", "global"].map((lane) => [lane, {
    lane,
    id: `quote-${lane}`, code: `BGL-${lane}`, potentialId: `lead-${lane}`, leadCode: `LD-${lane}`,
    customerName: lane === "global" ? "Chin Tran" : "Chin Tran 2", customerKind: "LOGISTICS",
    quoteWorkflow: "COMBINED", quoteStatus: "CHUA_CO_BAO_GIA", contractStatus: "CHUA_TAO",
    orders: [], notes: { totalLabel: "", shippingLabel: "", weightNote: "", validityNote: "", opsExtra: "", freight: { basis: "shipment", rate: null, total: null, totalManual: false }, logisticsFees: [], deposit: [] },
    createdAt: lane === "global" ? "2026-11-09T12:00:00Z" : "2026-11-10T12:00:00Z",
    requestedAt: lane === "global" ? "2026-11-12T17:30:00Z" : "2026-11-12T12:00:00Z",
  }]));
  const requests = [];
  const heldResponses = [];
  let failGlobal = false;
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/api/")) {
      res.setHeader("Content-Type", "text/html");
      res.end(`<div id="root"></div><script>${bundle.outputFiles[0].text}</script>`);
      return;
    }
    requests.push({ method: req.method, url });
    res.setHeader("Content-Type", "application/json");
    const lane = url.searchParams.get("lane");
    if (url.pathname === "/api/crm/quotes") {
      if (failGlobal && (lane === "global" || url.searchParams.get("allLanes") === "1")) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: { message: "Global unavailable" } }));
      } else {
        const q = (url.searchParams.get("q") || "").toLowerCase();
        if (q === "missing") { heldResponses.push(res); return; }
        const rows = (url.searchParams.get("allLanes") === "1" ? Object.values(quotes) : [quotes[lane]])
          .filter(quote => quote.customerName.toLowerCase().includes(q))
          .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));
        res.end(JSON.stringify({ quotes: rows, pagination: { page: 1, pages: 1, total: rows.length, pageSize: 20, summary: {} } }));
      }
    } else if (url.pathname.includes("/assignees")) {
      res.end(JSON.stringify({ assignees: { [`quote-${lane}`]: { id: lane, name: `Owner ${lane}` } } }));
    } else if (url.pathname === "/api/crm/quote-templates") res.end('{"templates":[]}');
    else if (url.pathname === "/api/security/csrf") res.end('{"token":"test"}');
    else if (url.pathname.endsWith("/send")) res.end(JSON.stringify({ quote: quotes[lane] }));
    else res.end("{}");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({ timezoneId: "UTC" });
    await page.clock.install();
    page.on("pageerror", error => console.error(error.message));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const expectRows = (count) => page.waitForFunction((n) => document.querySelectorAll("tbody tr[data-row-id]").length === n, count);
    await page.goto(origin);
    await expectRows(2);
    assert.equal(await page.getByLabel("Tất cả tuyến").isChecked(), true);
    assert.deepEqual(await page.locator("tbody tr td:first-child").allTextContents(), ["BGL-global", "BGL-vn"]);
    await page.getByRole("columnheader", { name: "Ngày yêu cầu báo giá" }).waitFor();
    assert.equal(await page.locator('tr[data-row-id="quote-global"] td').nth(-2).textContent(), "13/11/2026");
    assert.equal(await page.locator('tr[data-row-id="quote-vn"] td').nth(-2).textContent(), "12/11/2026");
    assert.equal(await page.getByRole("link", { name: "BGL-global" }).getAttribute("href"), "/theo-doi-bao-gia/global/lead-global");
    await page.getByText("Owner global", { exact: true }).waitFor();
    await page.getByText("Owner vn", { exact: true }).waitFor();

    // Background refreshes must keep the existing row DOM mounted, even if
    // the response is slow or fails. Polling, notifications and tab returns
    // all use the same list loader.
    let receiveRefresh;
    await page.route("**/api/crm/quotes?**", (route) => receiveRefresh(route));
    await page.evaluate(() => { window.refreshRow = document.querySelector("tbody tr[data-row-id]"); });
    const holdRefresh = async (trigger) => {
      const next = new Promise((resolve) => { receiveRefresh = resolve; });
      await trigger();
      const route = await next;
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.locator("tbody tr[data-row-id]").count(), 2);
      assert.equal(await page.evaluate(() => window.refreshRow.isConnected), true);
      assert.equal(await page.getByText("Đang tải…", { exact: true }).count(), 0);
      return route;
    };
    const refreshedQuotes = Object.values(quotes).map((quote) => ({ ...quote, customerName: "Updated customer" }));
    const refreshBody = { quotes: refreshedQuotes, pagination: { page: 1, pages: 1, total: 2, pageSize: 20, summary: {} } };
    const poll = await holdRefresh(() => page.clock.fastForward(30_000));
    await poll.fulfill({ json: refreshBody });
    await page.getByText("Updated customer", { exact: true }).first().waitFor();
    assert.equal(await page.evaluate(() => window.refreshRow.isConnected), true);

    const notification = await holdRefresh(() => page.evaluate(() => window.dispatchEvent(new Event("speego:notifications-changed"))));
    await notification.fulfill({ status: 500, json: { error: { message: "Refresh unavailable" } } });
    await page.getByText("Refresh unavailable", { exact: true }).waitFor();
    assert.equal(await page.locator("tbody tr[data-row-id]").count(), 2);

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.clock.fastForward(11_000);
    const tabReturn = await holdRefresh(() => page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    }));
    await tabReturn.fulfill({ json: refreshBody });
    await page.getByText("Refresh unavailable", { exact: true }).waitFor({ state: "detached" });
    assert.equal(await page.locator("tbody tr[data-row-id]").count(), 2);
    await page.unroute("**/api/crm/quotes?**");
    await page.evaluate(() => { delete document.visibilityState; });

    await page.getByLabel("Tìm kiếm", { exact: true }).fill("Chin Tran");
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("q=Chin+Tran") && response.url().includes("allLanes=1")),
      page.getByRole("button", { name: "Tìm", exact: true }).click(),
    ]);
    assert.ok(requests.some(({ url }) => url.searchParams.get("lane") === "vn" && url.searchParams.get("q") === "Chin Tran"));
    await expectRows(2);
    for (const lane of ["global", "vn"]) {
      await page.getByRole("button", { name: `Thao tác BGL-${lane}`, exact: true }).click();
      await page.getByRole("menuitem", { name: "Báo giá", exact: true }).click();
      await Promise.all([
        page.waitForResponse((response) => response.request().method() === "PATCH" && response.url().endsWith(`desk=logistics&lane=${lane}`)),
        page.getByRole("button", { name: "Save probe" }).click(),
      ]);
      await Promise.all([
        page.waitForResponse((response) => response.url().includes(`/quote-${lane}/send?desk=logistics&lane=${lane}`)),
        page.getByRole("button", { name: "Send probe" }).click(),
      ]);
      await page.getByRole("button", { name: "Close probe" }).click();
    }

    await page.getByLabel("Tất cả tuyến").uncheck();
    await expectRows(1);
    await page.getByRole("button", { name: "Global", exact: true }).click();
    await page.getByRole("link", { name: "BGL-global", exact: true }).waitFor();
    await page.getByLabel("Tất cả tuyến").check();
    await expectRows(2);
    await page.reload();
    await expectRows(2);
    await page.getByLabel("Tìm kiếm", { exact: true }).fill("missing");
    await Promise.all([
      page.waitForRequest((request) => request.url().includes("q=missing") && request.url().includes("allLanes=1")),
      page.getByRole("button", { name: "Tìm", exact: true }).click(),
    ]);
    await page.getByText("Đang tải…", { exact: true }).waitFor();
    assert.equal(await page.locator("tbody tr[data-row-id]").count(), 0);
    await page.getByLabel("Tìm kiếm", { exact: true }).fill("Chin Tran");
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("q=Chin+Tran") && response.url().includes("allLanes=1")),
      page.getByRole("button", { name: "Tìm", exact: true }).click(),
    ]);
    await expectRows(2);
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("q=missing") && response.url().includes("allLanes=1")),
      Promise.resolve().then(() => heldResponses.forEach((res) => res.end('{"quotes":[]}'))),
    ]);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator("tbody tr[data-row-id]").count(), 2);
    for (const query of ["role=logistics", "role=van-hanh", "desk=sourcing"]) {
      requests.length = 0;
      await page.goto(`${origin}/?${query}`);
      await expectRows(1);
      await page.getByRole("link", { name: "BGL-global", exact: true }).waitFor();
      assert.equal(await page.getByLabel("Tất cả tuyến").count(), 0);
      assert.equal(requests.filter(({ url }) => url.pathname === "/api/crm/quotes").at(-1).url.searchParams.get("lane"), "global");
    }
    failGlobal = true;
    await page.goto(origin);
    await page.getByText("Global unavailable", { exact: true }).waitFor();
    assert.equal(await page.locator("tbody tr[data-row-id]").count(), 0);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
