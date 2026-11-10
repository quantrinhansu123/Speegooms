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
    id: `quote-${lane}`, code: `BGL-${lane}`, potentialId: `lead-${lane}`, leadCode: `LD-${lane}`,
    customerName: lane === "global" ? "Chin Tran" : "Chin Tran 2", customerKind: "LOGISTICS",
    quoteWorkflow: "COMBINED", quoteStatus: "CHUA_CO_BAO_GIA", contractStatus: "CHUA_TAO",
    createdAt: lane === "global" ? "2026-11-10T12:00:00Z" : "2026-11-09T12:00:00Z",
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
      if (failGlobal && lane === "global") {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: { message: "Global unavailable" } }));
      } else {
        const quote = quotes[lane];
        const q = (url.searchParams.get("q") || "").toLowerCase();
        if (q === "missing") { heldResponses.push(res); return; }
        res.end(JSON.stringify({ quotes: quote.customerName.toLowerCase().includes(q) ? [quote] : [] }));
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
    const page = await browser.newPage();
    const origin = `http://127.0.0.1:${server.address().port}`;
    const expectRows = (count) => page.waitForFunction((n) => document.querySelectorAll("tbody tr[data-row-id]").length === n, count);
    await page.goto(origin);
    await expectRows(2);
    assert.equal(await page.getByLabel("Tất cả tuyến").isChecked(), true);
    assert.deepEqual(await page.locator("tbody tr td:first-child").allTextContents(), ["BGL-global", "BGL-vn"]);
    assert.equal(await page.getByRole("link", { name: "BGL-global" }).getAttribute("href"), "/theo-doi-bao-gia/global/lead-global");
    await page.getByText("Owner global", { exact: true }).waitFor();
    await page.getByText("Owner vn", { exact: true }).waitFor();

    await page.getByLabel("Tìm kiếm", { exact: true }).fill("Chin Tran");
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("lane=global&q=Chin+Tran")),
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
      page.waitForRequest((request) => request.url().includes("lane=global&q=missing")),
      page.getByRole("button", { name: "Tìm", exact: true }).click(),
    ]);
    await page.getByLabel("Tìm kiếm", { exact: true }).fill("Chin Tran");
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("lane=global&q=Chin+Tran")),
      page.getByRole("button", { name: "Tìm", exact: true }).click(),
    ]);
    await expectRows(2);
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("lane=global&q=missing")),
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
