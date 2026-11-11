import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3002";
const browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
async function session(email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const csrf = await (await context.request.get(`${origin}/api/security/csrf`)).json();
  const login = await context.request.post(`${origin}/api/auth/login`, { headers: { origin, "x-csrf-token": csrf.token }, data: { email, password: "speego@demo", remember: false } });
  assert.equal(login.status(), 200, await login.text());
  return context;
}
async function openQuote(page, desk, name) {
  await page.goto(`${origin}/van-hanh/${desk}-bao-gia`);
  const row = page.getByRole("row").filter({ hasText: name });
  await row.getByRole("button", { name: /Thao tác/ }).click();
  await page.getByRole("menuitem", { name: "Báo giá", exact: true }).click();
  if (desk === "logistics") await page.getByRole("tab", { name: "Logistics", exact: true }).click();
  await page.getByRole("region", { name: `Giá gốc ${desk === "sourcing" ? "Sourcing" : "Logistics"}`, exact: true }).waitFor();
}
try {
  for (const [email, allowed] of [["salevn@speego.vn", false], ["bangiamdoc@speego.vn", false], ["ketoan@speego.vn", true], ["sourcing@speego.vn", true], ["logistics@speego.vn", true], ["vanhanh@speego.vn", true]]) {
    const context = await session(email);
    try {
      const route = email.startsWith("salevn") ? "rfq-quotes?lane=vn" : `quotes?lane=vn&desk=${email.startsWith("logistics") ? "logistics" : "sourcing"}`;
      const response = await context.request.get(`${origin}/api/crm/${route}`);
      assert.equal(response.status(), 200, await response.text());
      const text = await response.text();
      assert.ok(text.includes("TEST-GIA-GOC"));
      assert.equal(text.includes('"originalPrice"'), allowed, email);
      if (email.startsWith("salevn")) {
        const source = JSON.parse(text).quotes.find(quote => quote.customerName === "TEST-GIA-GOC-SOURCING");
        assert.ok(source);
        const csrf = await (await context.request.get(`${origin}/api/security/csrf`)).json();
        const tampered = { templateId: source.templateId, opsNote: source.opsNote ?? "", quoteStatus: source.quoteStatus, contractStatus: source.contractStatus,
          orders: source.orders.map(order => ({ ...order, lines: order.lines.map(line => ({ ...line, originalPrice: 1 })) })), notes: source.notes, bank: source.bank };
        const saved = await context.request.patch(`${origin}/api/crm/quotes/${source.id}?lane=vn&desk=sourcing&orderContent=1`, { headers: { origin, "x-csrf-token": csrf.token }, data: tampered });
        assert.equal(saved.status(), 200, await saved.text());
        assert.ok(!(await saved.text()).includes('"originalPrice"'));
        const accountant = await session("ketoan@speego.vn");
        try {
          const body = await (await accountant.request.get(`${origin}/api/crm/quotes?lane=vn&desk=sourcing`)).json();
          assert.equal(body.quotes.find(quote => quote.id === source.id).orders[0].lines[0].originalPrice, 70000);
        } finally { await accountant.close(); }
      }
      if (email.startsWith("sourcing") || email.startsWith("logistics")) {
        const page = await context.newPage();
        const desk = email.startsWith("sourcing") ? "sourcing" : "logistics";
        await openQuote(page, desk, `TEST-GIA-GOC-${desk.toUpperCase()}`);
        const section = page.getByRole("region", { name: `Giá gốc ${desk === "sourcing" ? "Sourcing" : "Logistics"}`, exact: true });
        const field = section.getByRole("textbox").first();
        assert.equal(await field.isEnabled(), true);
        const original = await field.inputValue();
        if (desk === "logistics") {
          const sharedCurrency = section.getByRole("combobox", { name: "Loại tiền cước / giá gốc", exact: true });
          await sharedCurrency.selectOption("CNY");
          assert.equal(await page.locator('select[id$="freight-currency"]').inputValue(), "CNY");
          assert.equal(await field.inputValue(), original);
          await page.locator('select[id$="freight-currency"]').selectOption("VND");
          assert.equal(await sharedCurrency.inputValue(), "VND");
          await sharedCurrency.selectOption("CNY");
          await page.getByRole("button", { name: "Lưu", exact: true }).click();
          await page.getByRole("dialog").waitFor({ state: "hidden" });
          await openQuote(page, desk, "TEST-GIA-GOC-LOGISTICS");
          assert.equal(await sharedCurrency.inputValue(), "CNY");
          assert.equal(await field.inputValue(), original);
          await sharedCurrency.selectOption("USD");
          await page.getByRole("textbox", { name: "Tỷ giá quy đổi VND cho 1 USD", exact: true }).fill("25000");
        }
        await field.fill(desk === "sourcing" ? "71000" : "455");
        await field.blur();
        await page.getByRole("button", { name: "Lưu", exact: true }).click();
        await page.getByRole("dialog").waitFor({ state: "hidden" });
        await openQuote(page, desk, `TEST-GIA-GOC-${desk.toUpperCase()}`);
        const changed = await section.getByRole("textbox").first().inputValue();
        assert.notEqual(changed, original);
        await section.getByRole("textbox").first().fill(original);
        await section.getByRole("textbox").first().blur();
        await page.getByRole("button", { name: "Lưu", exact: true }).click();
        await page.getByRole("dialog").waitFor({ state: "hidden" });
        if (desk === "logistics") {
          await openQuote(page, desk, "TEST-GIA-GOC-FCL");
          assert.equal(await page.getByRole("textbox", { name: "Giá gốc · Ocean Freight", exact: true }).inputValue(), "6.000");
          const currency = page.getByRole("combobox", { name: "Loại tiền cước / giá gốc", exact: true });
          await currency.selectOption("AUD");
          assert.equal(await page.getByRole("textbox", { name: "Giá gốc · Ocean Freight", exact: true }).inputValue(), "6.000");
          await page.getByRole("button", { name: "Lưu", exact: true }).click();
          await page.getByRole("dialog").waitFor({ state: "hidden" });
          await openQuote(page, desk, "TEST-GIA-GOC-FCL");
          assert.equal(await currency.inputValue(), "AUD");
          await currency.selectOption("USD");
          await page.getByRole("button", { name: "Lưu", exact: true }).click();
          await page.getByRole("dialog").waitFor({ state: "hidden" });
        }
      } else if (email.startsWith("ketoan")) {
        const quote = JSON.parse(text).quotes[0];
        const csrf = await (await context.request.get(`${origin}/api/security/csrf`)).json();
        const forbidden = await context.request.patch(`${origin}/api/crm/quotes/${quote.id}?lane=vn&desk=sourcing`, { headers: { origin, "x-csrf-token": csrf.token }, data: { originalPrice: 1 } });
        assert.equal(forbidden.status(), 403);
        assert.equal((await forbidden.json()).error.code, "FORBIDDEN");
        const page = await context.newPage();
        await openQuote(page, "sourcing", "TEST-GIA-GOC-SOURCING");
        assert.equal(await page.getByRole("textbox", { name: /Giá gốc ·/ }).first().isDisabled(), true);
        assert.equal(await page.getByRole("button", { name: "Lưu", exact: true }).count(), 0);
        await openQuote(page, "logistics", "TEST-GIA-GOC-LOGISTICS");
        assert.equal(await page.getByRole("textbox", { name: /Giá gốc ·/ }).first().isDisabled(), true);
        assert.equal(await page.getByRole("combobox", { name: "Loại tiền cước / giá gốc", exact: true }).isDisabled(), true);
      }
      console.log(`Passed ${email}`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
