import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("tsx/package.json"))("esbuild");

test("quote send requires visible validity, confirms success, and leaves Logistics distribution to the server", async () => {
  const bundle = await build({
    stdin: {
      resolveDir: fileURLToPath(new URL(".", import.meta.url)), loader: "tsx",
      contents: `import React, {useState} from "react";
        import {createRoot} from "react-dom/client";
        import {defaultQuoteBank, updateQuoteSchema} from "@speego/shared";
        import {SessionProvider} from "@/features/auth/session-provider";
        import {QuoteEditor} from "./quote-editor";
        const input = updateQuoteSchema.parse({templateId:null, opsNote:"", quoteStatus:"CHUA_CO_BAO_GIA", contractStatus:"CHUA_TAO",
          orders:[{id:"00000000-0000-4000-8000-000000000001", name:"Order", selected:true, currency:"VND", rate:null,
            lines:[{stt:"1", productName:"Product", quantity:2, pricePerSet:10, lineTotal:20, weightKg:1, unit:"set", spec:"", note:""}]}],
          notes:{totalLabel:"", weightNote:"", validityNote:"", validityDays:null, deposit:[]}, bank:defaultQuoteBank});
        const desk = new URLSearchParams(location.search).get("desk") || "sourcing";
        const quote = {...input, id:"quote", code:"BGS-TEST", customerName:"Customer", customerKind:desk === "sourcing" ? "SOURCING" : "LOGISTICS",
          quoteWorkflow:"COMBINED", requirementImages:[], sentQuote:null, logisticsSheet:null, sourcingContext:null};
        if (new URLSearchParams(location.search).has("empty")) quote.orders = [];
        window.sent = []; window.handoffs = 0;
        function App() {
          const [error, setError] = useState();
          return <SessionProvider user={{id:"worker", role:desk}}><QuoteEditor quote={quote} desk={desk} templates={[]}
            embedded editMode="full" pending={false} error={error} onClose={()=>{}} onSave={async()=>true}
            onSend={async(data)=>{ window.sent.push(data); if(window.failSend) {setError("Không gửi được báo giá"); return null;} return "DA_CO_BAO_GIA"; }}
            onContinueLogistics={async()=>{window.handoffs++; return true;}}/></SessionProvider>;
        }
        createRoot(document.getElementById("root")).render(<App/>);`,
    },
    bundle: true, write: false,
    tsconfig: fileURLToPath(new URL("../../../../tsconfig.json", import.meta.url)),
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const server = createServer((req, res) => {
    res.setHeader("Content-Type", req.url === "/bundle.js" ? "text/javascript" : "text/html");
    res.end(req.url === "/bundle.js" ? bundle.outputFiles[0].text : `<style>
      [data-slot="alert-dialog-overlay"] {position:fixed; inset:0; z-index:50}
      [data-slot="alert-dialog-content"] {position:fixed; top:10%; left:10%; z-index:60; background:white}
      [data-slot="dialog-overlay"] {position:fixed; inset:0; z-index:50}
      [data-slot="dialog-content"] {position:fixed; top:2%; left:2%; z-index:60; background:white}
      </style><div id="root"></div><script src="/bundle.js"></script>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage();
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const desk of ["sourcing", "logistics"]) {
      await page.goto(`${origin}?desk=${desk}`);
      const send = page.getByRole("button", { name: "Gửi báo giá", exact: true });
      await send.waitFor();
      if (desk === "sourcing") {
        await page.getByRole("tab", { name: "Logistics", exact: true }).click();
        await page.getByRole("button", { name: "Sửa thông tin đơn hàng Order", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await dialog.getByRole("heading", { name: "Sửa thông tin đơn hàng", exact: true }).waitFor();
        assert.equal(await dialog.getByLabel("Tên thông tin đơn hàng").inputValue(), "Order");
        assert.equal(await dialog.getByLabel("Mặt hàng dòng 1", { exact: true }).isEnabled(), true);
        await dialog.getByRole("button", { name: "Đóng", exact: true }).first().click();
        await page.getByRole("button", { name: "Tạo thông tin đơn hàng", exact: true }).click();
        await dialog.getByRole("heading", { name: "Tạo thông tin đơn hàng", exact: true }).waitFor();
        assert.equal(await dialog.getByLabel("Tên thông tin đơn hàng").inputValue(), "");
        await dialog.getByRole("button", { name: "Đóng", exact: true }).first().click();
      } else {
        assert.equal(await page.getByRole("button", { name: "Tạo thông tin đơn hàng", exact: true }).count(), 0);
        assert.equal(await page.getByRole("button", { name: /Sửa thông tin đơn hàng/ }).count(), 0);
      }
      if (desk === "sourcing") await page.getByRole("tab", { name: "Sale", exact: true }).click();
      await send.click();
      const days = page.getByLabel("Hiệu lực báo giá (ngày)");
      await days.waitFor();
      await page.waitForFunction(() => document.activeElement?.getAttribute("aria-invalid") === "true");
      assert.equal(await days.getAttribute("aria-required"), "true");
      assert.equal(await page.getByRole("alertdialog").count(), 0);
      assert.equal(await page.evaluate(() => window.sent.length), 0);
      await page.getByRole("alert").filter({ hasText: "Nhập số ngày hiệu lực" }).waitFor();
      for (const invalid of ["0", "366"]) {
        await days.fill(invalid);
        await send.click();
        assert.equal(await page.getByRole("alertdialog").count(), 0);
      }
      await days.fill("7");
      await send.click();
      await page.getByRole("alertdialog").waitFor();
      await page.getByRole("button", { name: "Hủy", exact: true }).click();
      assert.equal(await page.evaluate(() => window.sent.length), 0);
      await page.evaluate(() => { window.failSend = true; });
      await send.click();
      await page.getByRole("button", { name: "Gửi", exact: true }).click();
      await page.getByRole("alert").filter({ hasText: "Không gửi được báo giá" }).waitFor();
      assert.equal(await page.getByText("Đã gửi báo giá và thông báo cho Sale.", { exact: true }).count(), 0);
      await page.evaluate(() => { window.failSend = false; });
      await send.click();
      await page.getByRole("button", { name: "Gửi", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "Đã gửi báo giá và thông báo cho Sale" }).waitFor();
      assert.equal(await page.getByRole("alertdialog").count(), 0, "không tự mở thêm bước bàn giao sau khi server đã xử lý");
      assert.equal(await page.evaluate(() => window.sent.at(-1).notes.validityDays), 7);
      assert.equal(await page.evaluate(() => window.handoffs), 0);
      if (desk === "sourcing") {
        await page.getByRole("button", { name: "Gửi qua Logistics", exact: true }).click();
        await page.getByRole("alertdialog").getByRole("button", { name: "Gửi qua Logistics", exact: true }).click();
        await page.waitForFunction(() => window.handoffs === 1);
      }
    }
    await page.goto(`${origin}?desk=sourcing&empty`);
    await page.getByRole("tab", { name: "Logistics", exact: true }).click();
    await page.getByRole("button", { name: "Tạo thông tin đơn hàng", exact: true }).click();
    await page.getByRole("dialog").getByRole("heading", { name: "Tạo thông tin đơn hàng", exact: true }).waitFor();
  } finally {
    await browser?.close();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
