import assert from "node:assert/strict";
import { createServer } from "node:http";
import { chromium } from "playwright";
import { bundleFixture } from "./browser-fixture.mjs";

const bundle = await bundleFixture(`
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { SessionProvider } from "./src/features/auth/session-provider";
import { useMessConvert } from "./src/features/crm/live/mess-convert";
import { PotentialView } from "./src/features/crm/live/potential-view";
const a = { id:"sale-a", name:"Sale A", role:"sale-global", email:"a@example.invalid", department:"Sale", title:"Sale" };
const b = { ...a, id:"sale-b", name:"Sale B", email:"b@example.invalid" };
const message = { id:"00000000-0000-4000-8000-000000000001", messCode:"MESS-1", customerName:"Khách mẫu", phone:"0900000000", goods:"Hàng mẫu", note:"Ghi chú mẫu", brand:"SPEEGO_US", demand:"SOURCING", order:null };
const potential = { id:"00000000-0000-4000-8000-000000000002", leadCode:"LEAD-1", fullName:"Khách mẫu", phone:"0900000000", source:"ADS", messId:message.id, messCode:"MESS-1", companyName:"", productInterest:"Hàng mẫu", saleNote:"Đã gọi", potential:"POTENTIAL", customerKind:"SOURCING", quoteWorkflow:"COMBINED", customerType:"INDIVIDUAL", brand:"SPEEGO_US", careChannel:"FACEBOOK", address:"US", requirementImages:[], handlerId:a.id, handlerName:a.name };
window.crmCalls = [];
window.fetch = async (rawUrl, options = {}) => {
  const url = new URL(rawUrl, location.origin);
  window.crmCalls.push({ path:url.pathname, method:options.method || "GET", body:options.body ? JSON.parse(options.body) : null });
  if(url.pathname === "/api/security/csrf") return Response.json({token:"test-token"});
  if(url.pathname === "/api/crm/sales") return Response.json({sales:[{id:a.id,name:a.name},{id:b.id,name:b.name}]});
  if(url.pathname.endsWith("/history")) return Response.json({history:[{id:"activity-1",actorName:a.name,action:"handover",entity:"potential",previousHandlerName:a.name,handlerName:b.name,createdAt:"2026-11-09T10:00:00Z"}]});
  if(url.pathname.endsWith("/convert")) { Object.assign(potential,{handlerId:b.id,handlerName:b.name}); return Response.json({potential, message}); }
  if(url.pathname === "/api/crm/potentials") return Response.json({potentials:[potential]});
  if(url.pathname === "/api/crm/potentials/" + potential.id && options.method === "PATCH") { Object.assign(potential,JSON.parse(options.body)); return Response.json({potential}); }
  throw new Error("Unexpected request: " + rawUrl);
};
function Converter() {
  const [error,setError] = useState(); const [notice,setNotice] = useState();
  const convert = useMessConvert({lane:"global",load:()=>{},error,setError,setNotice});
  return <><button onClick={()=>convert.openConvert(message)}>Chuyển Mess mẫu</button>{notice && <p>{notice}</p>}{convert.dialogs}</>;
}
function App() {
  const [scene,setScene] = useState("mess"); const [user,setUser] = useState(a);
  return <SessionProvider user={user}><button onClick={()=>{setUser(a);setScene("mess")}}>Form Mess</button><button onClick={()=>{setUser(b);setScene("potential")}}>Sale B nhận</button><button onClick={()=>{setUser(a);setScene("potential")}}>Sale A xem</button>
    {scene === "mess" ? <Converter/> : <PotentialView key={user.id} lane="global"/>}</SessionProvider>;
}
createRoot(document.getElementById("app")).render(<App/>);
`);
const server = createServer((req, res) => {
  res.setHeader("Content-Type", req.url === "/app.js" ? "application/javascript" : "text/html; charset=utf-8");
  res.end(req.url === "/app.js" ? bundle : `<style>body{font:14px sans-serif}button,input,select,textarea{margin:5px;padding:8px}label{display:block}svg{width:16px;height:16px}fieldset{display:grid;grid-template-columns:1fr 1fr;gap:12px}table{border-collapse:collapse}th,td{padding:6px;border:1px solid #ddd}[data-slot="dialog-content"]{position:fixed;z-index:100;inset:3% 10%;overflow:auto;background:white;padding:20px;box-shadow:0 0 0 200px #0002}[data-slot="dialog-overlay"]{position:fixed;inset:0;z-index:99}[data-slot="dropdown-menu-content"]{background:white;z-index:120;padding:8px;border:1px solid #ddd}[data-slot="dropdown-menu-item"]{padding:8px}</style><div id="app"></div><script src="/app.js"></script>`);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => { errors.push(error.message); process.stderr.write(error.message + "\n"); });
  page.setDefaultTimeout(10000);
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole("button", { name: "Chuyển Mess mẫu", exact: true }).click();
  const convert = page.getByRole("dialog", { name: "Chuyển sang khách tiềm năng", exact: true });
  const convertHandler = convert.locator("#convert-handler");
  assert.equal(await convert.locator("#convert-saleNote").evaluate((el, selector) => Boolean(el.compareDocumentPosition(document.querySelector(selector)) & Node.DOCUMENT_POSITION_FOLLOWING), "#convert-handler"), true);
  await convertHandler.selectOption("sale-b");
  await convert.locator("#convert-address").fill("US");
  await convert.locator("#convert-customerType").selectOption("INDIVIDUAL");
  await convert.locator("#convert-careChannel").selectOption("FACEBOOK");
  await convert.getByRole("button", { name: "Chuyển", exact: true }).click();
  await convert.waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => window.crmCalls.find(call => call.path.endsWith("/convert")).body.handlerId), "sale-b");
  assert.equal(await page.evaluate(() => window.crmCalls.filter(call => call.path.endsWith("/quotes") && call.method === "POST").length), 0);
  await page.getByRole("button", { name: "Sale B nhận", exact: true }).click();
  await page.getByRole("button", { name: "Thao tác LEAD-1", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sửa", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Sửa khách hàng tiềm năng", exact: true });
  assert.equal(await editor.locator("#pot-handler").isEnabled(), true);
  assert.equal(await editor.locator("#pot-handler").inputValue(), "sale-b");
  assert.equal(await editor.locator("#pot-brand").evaluate(el => Boolean(el.compareDocumentPosition(document.querySelector("#pot-handler")) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
  await editor.getByText("Lịch sử bàn giao và xử lý", { exact: true }).click();
  await editor.getByRole("listitem").getByText("Sale A", { exact: true }).waitFor();
  await editor.locator("#pot-handler").selectOption("sale-a");
  await editor.getByRole("button", { name: "Lưu", exact: true }).click();
  await editor.waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => window.crmCalls.find(call => call.method === "PATCH").body.handlerId), "sale-a");
  // Put the fixture back with B so A's read-only form can be inspected.
  await page.reload();
  await page.getByRole("button", { name: "Chuyển Mess mẫu", exact: true }).click();
  await convert.locator("#convert-handler").selectOption("sale-b");
  await convert.locator("#convert-address").fill("US");
  await convert.locator("#convert-customerType").selectOption("INDIVIDUAL");
  await convert.locator("#convert-careChannel").selectOption("FACEBOOK");
  await convert.getByRole("button", { name: "Chuyển", exact: true }).click();
  await convert.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Sale A xem", exact: true }).click();
  await page.getByRole("button", { name: "Thao tác LEAD-1", exact: true }).click();
  assert.equal(await page.getByRole("menuitem", { name: "Sửa", exact: true }).count(), 0);
  await page.getByRole("menuitem", { name: "Xem và lịch sử xử lý", exact: true }).click();
  const readOnly = page.getByRole("dialog", { name: "Chi tiết khách hàng tiềm năng", exact: true });
  assert.equal(await readOnly.locator("#pot-handler").isDisabled(), true);
  assert.equal(await readOnly.locator("#pot-name").isDisabled(), true);
  assert.equal(await readOnly.getByRole("button", { name: "Lưu", exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log("CRM handover UI: passed (both requested form positions, conversion assignment, no processing after transfer, reassignment, history and sender read-only)");
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
