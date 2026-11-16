import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("tsx/package.json"))("esbuild");

test("editor previews unsaved goods and freight without saving while exports use sent shipments", async () => {
  const bundle = await build({
    stdin: {
      resolveDir: fileURLToPath(new URL(".", import.meta.url)), loader: "tsx",
      contents: `import React from "react";
        import {createRoot} from "react-dom/client";
        import {defaultQuoteBank, updateQuoteSchema, quoteSheetInputOf} from "@speego/shared";
        import {SessionProvider} from "@/features/auth/session-provider";
        import {QuoteEditor} from "./quote-editor";
        import {quoteOutputRunners} from "./quote-output";
        import {buildQuoteSheet} from "./quote-sheet";
        const input = updateQuoteSchema.parse({templateId:null, opsNote:"", quoteStatus:"DA_CO_BAO_GIA", contractStatus:"CHUA_TAO",
          orders:[{id:"00000000-0000-4000-8000-000000000001", name:"Shipment", selected:true, currency:"USD",
            lines:[{stt:"1", productName:"Marble", quantity:100, pricePerSet:9.87, lineTotal:987, weightKg:18.5, spec:"", note:"",
              packages:[{count:1,lengthCm:245,widthCm:127,heightCm:50,actualKg:1850}]},
            {stt:"2", productName:"Panel", quantity:100, pricePerSet:15.79, lineTotal:1579, weightKg:3, spec:"", note:"",
              packages:[{count:10,lengthCm:242,widthCm:17,heightCm:15,actualKg:30}]}]}],
          notes:{totalLabel:"", weightNote:"", validityNote:"", validityDays:7, deposit:[]}, bank:defaultQuoteBank});
        const sentQuote = {sentAt:"2026-11-12T07:41:59Z", order:structuredClone(input.orders[0]), notes:structuredClone(input.notes), bank:defaultQuoteBank};
        const logisticsSent = structuredClone(sentQuote);
        logisticsSent.notes.freight = {...logisticsSent.notes.freight,rate:2.1,total:4515};
        logisticsSent.notes.logisticsFees = [{label:"Inspection",labelEn:"Inspection",value:"100",currency:"USD",itemStt:""}];
        logisticsSent.notes.shippingNoteOther = "Customer arranges forklift. Delivery 40-45 days.";
        const quote = {...input,id:"quote",code:"BGS-REGRESSION",customerName:"Customer",customerKind:"SOURCING",quoteWorkflow:"COMBINED",
          shippingMode:"SEA",createdAt:"2026-11-12T03:59:39Z",requirementImages:[],sentQuote,
          logisticsSheet:{...input,notes:structuredClone(logisticsSent.notes),sentQuote:logisticsSent},sourcingContext:null};
        quote.logisticsSheet.notes.freight.rate = 3;
        quote.logisticsSheet.notes.logisticsFees[0].value = "200";
        quote.logisticsSheet.notes.shippingNoteOther = "CURRENT-DRAFT-NOTE";
        quote.orders[0].lines[0].quantity = 120;
        quote.orders[0].lines[1].quantity = 80;
        quote.orders[0].lines[1].packages = [{count:30,lengthCm:245,widthCm:125,heightCm:100,actualKg:0}];
        const mode = new URLSearchParams(location.search).get("mode");
        if(mode === "mismatch") quote.sentQuote.order.lines[0].quantity = 120;
        if(mode === "waiting") quote.logisticsSheet.quoteStatus = "CHUA_CO_BAO_GIA_LAI";
        if(mode === "draft") quote.sentQuote = null;
        if(mode === "logistics") Object.assign(quote,{orders:[structuredClone(logisticsSent.order)],notes:structuredClone(logisticsSent.notes),
          sentQuote:logisticsSent,logisticsSheet:null,sourcingContext:{order:structuredClone(logisticsSent.order),opsNote:null}});
        window.saves = 0;
        window.outputs = [];
        for(const action of ["print","pdf","excel"]) quoteOutputRunners[action] = async(source,lang) => {
          const model = buildQuoteSheet(quoteSheetInputOf(source,source.orders[0],lang));
          window.outputs.push({action,quantities:model.lines.map(line=>line.quantity),freight:model.freight,totals:model.feeSubtotals,issuedOn:model.meta.issuedOn});
        };
        createRoot(document.getElementById("root")).render(<SessionProvider user={{id:"admin",role:"admin"}}>
          <QuoteEditor quote={quote} desk={mode === "logistics" ? "logistics" : "sourcing"} templates={[]} embedded editMode="full" pending={false} onClose={()=>{}} onSave={async()=>{window.saves++;return true;}}/>
        </SessionProvider>);`,
    },
    bundle: true, write: false,
    tsconfig: fileURLToPath(new URL("../../../../tsconfig.json", import.meta.url)),
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const server = createServer((req, res) => {
    res.setHeader("Content-Type", req.url === "/bundle.js" ? "text/javascript" : "text/html");
    res.end(req.url === "/bundle.js" ? bundle.outputFiles[0].text : `<style>
      [data-slot="dialog-overlay"] {position:fixed; inset:0; z-index:50}
      [data-slot="dialog-content"] {position:fixed; top:2%; left:2%; z-index:60; background:white; width:96vw; max-height:96vh}
      [data-slot="dialog-content"] > .grid {min-height:0; flex:1; overflow:auto}
      </style><div id="root"></div><script src="/bundle.js"></script>`);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const origin = `http://127.0.0.1:${server.address().port}`;
    await page.goto(origin);
    await page.getByRole("button", { name: "Xem trước bản nháp", exact: true }).click();
    const preview = page.frameLocator('iframe[title="Xem trước bản nháp Shipment"]');
    await preview.getByText("BẢN NHÁP — CHƯA GỬI", { exact: true }).waitFor();
    let previewText = await preview.locator("body").innerText();
    assert.match(previewText, /17\.162,5/);
    assert.match(previewText, /51\.487,5/);
    assert.match(previewText, /51\.687,5/);
    assert.match(previewText, /CURRENT-DRAFT-NOTE/);
    assert.equal(await page.getByRole("dialog").getByRole("button", { name: "In", exact: true }).count(), 0);
    await page.getByRole("dialog").getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true }).click();
    await page.getByLabel("Số lượng dòng 1", { exact: true }).fill("130");
    await page.getByLabel("Mặt hàng dòng 1", { exact: true }).fill("UNSAVED-MARBLE");
    await page.getByRole("dialog").getByRole("button", { name: "Xem trước bản nháp", exact: true }).click();
    await preview.getByText("UNSAVED-MARBLE", { exact: true }).waitFor();
    previewText = await preview.locator("body").innerText();
    assert.match(previewText, /130/);
    assert.match(previewText, /51\.687,5/);
    await page.getByRole("dialog").getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true }).click();
    assert.equal(await page.getByLabel("Số lượng dòng 1", { exact: true }).inputValue(), "130");
    assert.equal(await page.getByLabel("Mặt hàng dòng 1", { exact: true }).inputValue(), "UNSAVED-MARBLE");
    assert.equal(await page.evaluate(() => window.saves), 0);
    await page.getByRole("dialog").getByRole("button", { name: "Đóng", exact: true }).first().click();
    for (const [index, label] of ["In", "Tải PDF", "Tải Excel"].entries()) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: label, exact: true }).click();
      await page.waitForFunction(count => window.outputs.length === count, index + 1);
      const output = await page.evaluate(() => window.outputs.at(-1));
      assert.deepEqual(output.quantities, [100, 100]);
      assert.equal(output.freight.chargeableKg, 2150);
      assert.equal(output.freight.total, 4515);
      assert.deepEqual(output.totals, [{ currency: "USD", amount: 4615 }]);
      assert.match(output.freight.notes.join(" "), /forklift/);
      assert.equal(output.issuedOn, "12/11/2026");
    }
    for (const [mode, message] of [["mismatch", "chưa khớp"], ["waiting", "chờ báo giá lại"], ["draft", "Chưa gửi báo giá"]]) {
      await page.goto(`${origin}?mode=${mode}`);
      await page.getByRole("button", { name: "In", exact: true }).click();
      await page.getByRole("alert").filter({ hasText: message }).waitFor();
      assert.equal(await page.getByRole("dialog").count(), 0);
      assert.equal(await page.evaluate(() => window.outputs.length), 0);
    }
    await page.goto(`${origin}?mode=logistics`);
    await page.getByLabel("Giá cước / kg", { exact: true }).fill("3");
    await page.getByRole("button", { name: "Xem trước bản nháp", exact: true }).click();
    await preview.getByText("BẢN NHÁP — CHƯA GỬI", { exact: true }).waitFor();
    previewText = await preview.locator("body").innerText();
    assert.match(previewText, /6\.450/);
    assert.match(previewText, /6\.550/);
    assert.equal(await page.evaluate(() => window.saves), 0);
    await page.getByRole("dialog").getByRole("button", { name: "Đóng", exact: true }).first().click();
    await page.getByRole("button", { name: "In", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "In", exact: true }).click();
    await page.waitForFunction(() => window.outputs.length === 1);
    assert.equal(await page.evaluate(() => window.outputs[0].freight.total), 4515);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

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
