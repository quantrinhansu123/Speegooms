/**
 * Chụp bằng chứng 3 phần vừa sửa:
 *  2. In báo giá: đầu trang (masthead) + chân trang cố định
 *  3–4. In hợp đồng / DOCX: mở dialog kể cả HĐ thiếu ma_bao_gia
 *
 * Offline (không cần login): bản in báo giá.
 * Live (cần pnpm dev + API): dialog in hợp đồng HD-20261109-0042.
 *
 *   pnpm screenshots:print-fixes
 * Ảnh: screenshots/print-fixes/
 */
import path from "node:path";
import { defaultQuoteBank, emptyQuoteFreight, type QuoteLine, type QuoteSheetInput } from "@speego/shared";
import type { Browser } from "playwright";
import { quotePrintPreviewDocument, quoteSheetHtml } from "../../src/features/crm/live/quote-print";
import {
  e2eBaseUrl,
  ensureLegendAnchor,
  highlight,
  launchBrowser,
  login,
  outDir,
  shotRegion,
  tagButtonsByText,
} from "./highlight";

const CONTRACT = "HD-20261109-0042";

const line = (stt: string, productName: string, quantity: number, price: number): QuoteLine => ({
  stt,
  productName,
  spec: "Quy cách mẫu",
  quantity,
  image: "",
  images: [],
  pricePerSet: price,
  lineTotal: quantity * price,
  lineTotalManual: false,
  weightKg: 2,
  note: "",
  specEn: "",
  noteEn: "",
  unit: "cái",
  basis: "unit",
  cbm: null,
  areaM2: null,
  packages: [],
  attrs: [],
  prices: [],
});

function sampleQuote(): QuoteSheetInput {
  return {
    lang: "vi",
    code: "BGS-PRINT-FIX",
    issuedOn: "11/11/2026",
    customer: {
      customerName: "Phan Nhật Bắc",
      companyName: "Phan Nhật Bắc",
      address: "US",
      phone: "0900000000",
      email: "demo@example.com",
    },
    currency: "USD",
    bank: defaultQuoteBank,
    lines: [
      line("1", "Vận chuyển tạp dề", 100, 1.5),
      line("2", "Logo + Decal", 20, 40),
      line("3", "Hàng mẫu thêm", 5, 12),
    ],
    notes: {
      totalLabel: "",
      shippingLabel: "",
      weightNote: "Cân ước tính",
      validityNote: "Báo giá có hiệu lực 7 ngày",
      validityDays: 7,
      weightNoteEn: "",
      validityNoteEn: "",
      deposit: ["Đặt cọc 50%"],
      depositEn: [],
      opsExtra: "",
      freight: { ...emptyQuoteFreight, basis: "kg", rate: 4, currency: "USD", total: 80, totalManual: true },
      logisticsFees: [],
      shippingNotes: ["estimate"],
    },
  };
}

async function shotQuotePrint(browser: Browser, dir: string): Promise<string[]> {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
  try {
    await page.setContent(quotePrintPreviewDocument(quoteSheetHtml(sampleQuote())), { waitUntil: "domcontentloaded" });
    await page.locator("table.frame .frame-head .masthead, thead .masthead").first().waitFor();

    const legend = await highlight(page, [
      { selector: "thead .masthead, .frame-head .masthead", label: "Đầu trang cố định: logo + thông tin công ty (lặp theo trang in)" },
      { selector: ".payment-signatures, .closing", label: "Phần cuối tờ: tổng / đặt cọc / ngân hàng / chữ ký" },
      { selector: ".frame-foot .print-foot", label: "Chân trang cố định: tên công ty (lặp theo trang in)" },
    ], "table.frame", "Print-fixes — Đầu/cuối cố định khi in báo giá");

    const annotated = path.join(dir, "01-bao-gia-dau-cuoi-co-dinh.png");
    await shotRegion(page, annotated, page.locator("table.frame"), legend);

    const full = path.join(dir, "02-bao-gia-toan-bo-ban-in.png");
    await page.screenshot({ path: full, fullPage: true });
    return [annotated, full];
  } finally {
    await page.close();
  }
}

async function shotContractDialog(browser: Browser, dir: string): Promise<string[]> {
  const viewport = { width: 1600, height: 1000 };
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  try {
    await login(page);
    await page.goto(`${e2eBaseUrl}/sale-viet-nam/hop-dong`);
    const row = page.locator("tr", { hasText: CONTRACT }).first();
    await row.waitFor({ timeout: 20_000 });
    await row.scrollIntoViewIfNeeded();
    await row.getByRole("button", { name: new RegExp(`Thao tác ${CONTRACT}`, "i") }).click();
    await page.getByRole("menuitem", { name: "In hợp đồng" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ timeout: 15_000 });
    await Promise.all([
      page.addStyleTag({
        content: `[role="dialog"] { max-height: none !important; top: 40px !important; translate: none !important; transform: none !important; }`,
      }),
      page.evaluate(() => window.scrollTo(0, 0)),
    ]);

    await dialog.evaluate((root) => root.setAttribute("data-shot-dialog", "1"));
    await tagButtonsByText(page, '[role="dialog"]', {
      "Tải DOCX": "data-shot-docx",
      "Tải file PDF": "data-shot-pdf",
    });
    const legendAfter = await ensureLegendAnchor(page, '[role="dialog"]');

    const legend = await highlight(page, [
      { selector: "[data-shot-dialog]", label: "Dialog in hợp đồng mở được dù HĐ thiếu ma_bao_gia (trước: NOT_FOUND)" },
      { selector: "[data-shot-docx]", label: "Nút Tải DOCX" },
      { selector: "[data-shot-pdf]", label: "Nút Tải file PDF" },
    ], legendAfter, `Print-fixes — In/DOCX hợp đồng ${CONTRACT}`);

    const annotated = path.join(dir, "03-hop-dong-dialog-docx.png");
    await shotRegion(page, annotated, dialog, legend, { clamp: viewport });

    const full = path.join(dir, "04-hop-dong-dialog-full.png");
    await page.screenshot({ path: full });
    return [annotated, full];
  } finally {
    await page.close();
  }
}

async function main() {
  const dir = outDir("print-fixes");
  const browser = await launchBrowser();
  const shots: string[] = [];
  const skipped: string[] = [];

  // Offline + live song song trên cùng browser.
  const [quote, contract] = await Promise.allSettled([
    shotQuotePrint(browser, dir),
    shotContractDialog(browser, dir),
  ]);

  if (quote.status === "fulfilled") shots.push(...quote.value);
  else skipped.push(`bao-gia: ${quote.reason instanceof Error ? quote.reason.message.split("\n")[0] : String(quote.reason)}`);

  if (contract.status === "fulfilled") shots.push(...contract.value);
  else skipped.push(`hop-dong: ${contract.reason instanceof Error ? contract.reason.message.split("\n")[0] : String(contract.reason)}`);

  await browser.close();
  console.log(["print-fixes xong:", ...shots.map((file) => path.relative(process.cwd(), file))].join("\n  "));
  if (skipped.length) console.log(["Bỏ qua:", ...skipped].join("\n  "));
  if (quote.status === "rejected") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
