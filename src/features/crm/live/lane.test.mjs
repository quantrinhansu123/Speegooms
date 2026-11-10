import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";

// Use the bundler already installed by tsx for this browser-only hook check.
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("tsx/package.json"))("esbuild");

test("CRM lane survives notification focus, reload and menu navigation without changing Sale locks", async () => {
  const bundle = await build({
    stdin: {
      resolveDir: fileURLToPath(new URL(".", import.meta.url)),
      loader: "tsx",
      contents: `
        import React from "react";
        import { createRoot } from "react-dom/client";
        import { SessionProvider } from "@/features/auth/session-provider";
        import { useCrmLane } from "./lane";
        import { useFocusRow } from "@/features/notifications/use-focus-row";
        import { OPEN_CONTRACT_EVENT } from "@/features/notifications/open-contract";
        const params = new URLSearchParams(location.search);
        function Probe() {
          const {lane, canPick, setLane} = useCrmLane(params.get("fixed") || undefined);
          useFocusRow([{id: "quote"}], lane, canPick, setLane);
          return <>
            <output>{lane}:{String(canPick)}</output>
            <button onClick={() => setLane("global")}>Global</button>
            <button onClick={() => setLane("vn")}>VN</button>
            <button onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CONTRACT_EVENT,
              {detail: {id: "quote", lane: "global", refType: "quote"}}))}>Notification</button>
          </>;
        }
        createRoot(document.getElementById("root")).render(
          <SessionProvider user={{id: params.get("user") || "ops", role: params.get("role") || "van-hanh"}}>
            <Probe />
          </SessionProvider>);
      `,
    },
    bundle: true,
    write: false,
    tsconfig: fileURLToPath(new URL("../../../../tsconfig.json", import.meta.url)),
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const server = createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(`<div id="root"></div><script>${bundle.outputFiles[0].text}</script>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage();
    const origin = `http://127.0.0.1:${server.address().port}`;
    const expectLane = (value) => page.waitForFunction((v) => document.querySelector("output")?.textContent === v, value);
    await page.goto(origin);
    await expectLane("vn:true");
    await page.getByText("Notification", { exact: true }).click();
    await expectLane("global:true");
    await page.reload();
    await expectLane("global:true");
    await page.goto(`${origin}/menu`);
    await expectLane("global:true");
    await page.goto(`${origin}/?id=quote&lane=vn`);
    await expectLane("vn:true");
    await page.waitForFunction(() => !location.search.includes("id="));
    await page.reload();
    await expectLane("vn:true");
    await page.getByText("Global", { exact: true }).click();
    await expectLane("global:true");
    await page.reload();
    await expectLane("global:true");
    await page.goto(`${origin}/?user=other`);
    await expectLane("vn:true");
    for (const [query, expected] of [["role=sale-vn&lane=global", "vn:false"], ["role=sale-global&lane=vn", "global:false"], ["fixed=vn&lane=global", "vn:false"]]) {
      await page.goto(`${origin}/?${query}`);
      await expectLane(expected);
      await page.getByText("Notification", { exact: true }).click();
      await expectLane(expected);
    }
    await page.evaluate(() => sessionStorage.setItem("speego:crm-lane:ops", "invalid"));
    await page.goto(`${origin}/?lane=invalid`);
    await expectLane("vn:true");
    await page.addInitScript(() => {
      Storage.prototype.getItem = Storage.prototype.setItem = () => { throw new Error("blocked"); };
    });
    await page.goto(origin);
    await expectLane("vn:true");
    await page.getByText("Global", { exact: true }).click();
    await expectLane("global:true");
    assert.equal(await page.locator("output").textContent(), "global:true");
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
