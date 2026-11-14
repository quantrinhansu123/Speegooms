import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("tsx/package.json"))("esbuild");

test("filters start hidden; tabs apply independently; reset and date validation work", async () => {
  const bundle = await build({
    stdin: {
      resolveDir: fileURLToPath(new URL(".", import.meta.url)), loader: "tsx",
      contents: `import React from "react"; import {createRoot} from "react-dom/client";
        import {ListSearchBar, CustomerKindTabs, useAppliedSearch} from "./list-search-bar";
        function App() {
          const f = useAppliedSearch({q:"", from:"", to:"", customerKind:""});
          return <><ListSearchBar q={f.draft.q} from={f.draft.from} to={f.draft.to}
            onQ={v=>f.set("q",v)} onFrom={v=>f.set("from",v)} onTo={v=>f.set("to",v)}
            onSearch={f.search} onReset={f.reset} dateLabel="Từ ngày" activeCount={f.activeCount}
            tabs={<CustomerKindTabs value={f.applied.customerKind} onChange={v=>f.select("customerKind",v)}/>}/>
            <output>{JSON.stringify(f.applied)}</output></>;
        } createRoot(document.getElementById("root")).render(<App/>);`,
    },
    bundle: true, write: false, jsx: "automatic",
    alias: { react: dirname(require.resolve("react")) },
    tsconfig: fileURLToPath(new URL("../../../../tsconfig.json", import.meta.url)),
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (error) => { console.error(error.message); });
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const toggle = page.getByRole("button", { name: "Bộ lọc", exact: true });
    await toggle.waitFor();
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    assert.equal(await page.getByLabel("Từ ngày", { exact: true }).isVisible(), false);
    assert.deepEqual(await page.getByRole("group", { name: "Loại khách" }).getByRole("button").allTextContents(), ["Tất cả", "Sourcing", "Logistic"]);
    await toggle.click();
    await page.getByLabel("Từ ngày", { exact: true }).fill("2026-11-10");
    await page.getByRole("button", { name: "Sourcing", exact: true }).click();
    const applied = async () => JSON.parse(await page.locator("output").textContent());
    assert.deepEqual(await applied(), { q: "", from: "", to: "", customerKind: "SOURCING" });
    await page.getByRole("button", { name: "Áp dụng", exact: true }).click();
    assert.equal((await applied()).from, "2026-11-10");
    await toggle.click();
    assert.equal(await page.getByLabel("Từ ngày", { exact: true }).isVisible(), false);
    assert.equal((await applied()).from, "2026-11-10");
    await page.getByRole("button", { name: "Logistic", exact: true }).click();
    assert.equal((await applied()).customerKind, "LOGISTICS");
    await toggle.click();
    await page.getByLabel("Đến ngày", { exact: true }).fill("2026-11-01");
    await page.getByRole("button", { name: "Áp dụng", exact: true }).click();
    assert.equal((await applied()).to, "");
    assert.equal(await page.getByRole("alert").isVisible(), true);
    await page.getByRole("button", { name: "Xóa lọc", exact: true }).click();
    assert.deepEqual(await applied(), { q: "", from: "", to: "", customerKind: "" });
  } finally { await browser.close(); }
});
