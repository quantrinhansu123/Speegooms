/**
 * E54 — Bản in báo giá, phần Chi phí vận chuyển:
 *  1. Không in dòng phí theo mặt hàng chưa điền giá (cước tính theo kg).
 *  2. Dòng Tổng chi phí logistics nằm trong bảng cước: nhãn trải tới cột Cân nặng tính phí,
 *     số tiền đúng cột Tổng chi phí, chỉ ô số tiền tô vàng.
 *  3. Lưu ý chọn nhiều, in dưới dòng Tổng chi phí logistics (tick ô nào in ô đó, kèm dòng Khác).
 *
 * Dựng bản in bằng chính hàm quoteSheetHtml của app với dữ liệu mẫu, không cần đăng nhập hay database.
 * Chạy: pnpm screenshots:e54  → ảnh ở screenshots/E54
 */
import path from "node:path";
import { defaultQuoteBank, emptyQuoteFreight, type QuoteLine, type QuoteSheetInput } from "@speego/shared";
import { quotePrintCss, quoteSheetHtml } from "../../src/features/crm/live/quote-print";
import { highlight, launchBrowser, outDir, shotRegion } from "./highlight";

const line = (stt: string, productName: string, spec: string, quantity: number, pkg: QuoteLine["packages"][number]): QuoteLine => ({
  stt, productName, spec, quantity, image: "", images: [], pricePerSet: null, lineTotal: null, lineTotalManual: false,
  weightKg: null, note: "", specEn: "", noteEn: "", unit: "cái", basis: "unit", cbm: null, areaM2: null,
  packages: [pkg], attrs: [], prices: [],
});

function sample(lang: "vi" | "en"): QuoteSheetInput {
  return {
    lang,
    code: "BGL-20261107-0001",
    issuedOn: "07/11/2026",
    shippingMode: "AIR",
    customer: { customerName: "Khách hàng mẫu", companyName: "Công ty mẫu", address: "Hà Nội", phone: "0900000000", email: "khach@example.com" },
    currency: "USD",
    bank: defaultQuoteBank,
    lines: [
      line("1", "Set sơn mắt mèo", "Hộp 12 lọ", 50, { count: 1, lengthCm: 40, widthCm: 30, heightCm: 20, actualKg: 18.5 }),
      line("3", "Cân nặng kích thước", "42x32,5x12,5cm", 10, { count: 1, lengthCm: 42, widthCm: 32.5, heightCm: 12.5, actualKg: 3 }),
    ],
    notes: {
      totalLabel: "", shippingLabel: "", weightNote: "", validityNote: "", validityDays: 7, weightNoteEn: "", validityNoteEn: "",
      deposit: [], depositEn: [], opsExtra: "",
      freight: { ...emptyQuoteFreight, basis: "kg", rate: 5, currency: "USD" },
      // Hai dòng theo mặt hàng chưa điền giá: trước đây vẫn in ra, nay bỏ.
      logisticsFees: [
        { label: "Mặt hàng 3 - Cân nặng kích thước: 42x32,5x12,5cm= 3kg", labelEn: "", value: "", currency: "", itemStt: "3" },
        { label: "Mặt hàng 1 - Set sơn mắt mèo", labelEn: "", value: "", currency: "", itemStt: "1" },
        { label: "Phụ phí địa chỉ", labelEn: "Address surcharge", value: "22", currency: "", itemStt: "" },
      ],
      shippingNotes: ["measure", "estimate", "domesticCn", "prepay"],
      shippingNoteOther: lang === "en" ? "Fragile goods need a wooden crate." : "Hàng dễ vỡ cần đóng thùng gỗ.",
    },
  };
}

async function main() {
  const dir = outDir("E54");
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
  const marks = [
    { selector: "table.freight-table tr.fee-row", label: "Bỏ dòng mặt hàng chưa điền giá, chỉ còn phụ phí đã có số tiền (tên phụ phí căn trái)", all: true },
    { selector: "table.freight-table tr.sum-row", label: "Tổng chi phí logistics: nhãn căn trái tới cột Cân nặng tính phí, số tiền đúng cột Tổng chi phí, chỉ ô số tiền tô vàng", all: true },
    { selector: ".freight-note", label: "Lưu ý chọn nhiều, in dưới dòng Tổng chi phí logistics" },
  ];
  const shots: string[] = [];
  for (const lang of ["vi", "en"] as const) {
    const html = quoteSheetHtml(sample(lang));
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${quotePrintCss} body{margin:0;padding:24px 24px 24px 48px;background:#fff}</style></head><body>${html}</body></html>`);
    await page.waitForLoadState("networkidle");
    const legend = await highlight(page, marks, "section.freight", `E54 — Chỗ đã sửa trên bản in báo giá (${lang === "vi" ? "tiếng Việt" : "tiếng Anh"})`);
    const file = path.join(dir, lang === "vi" ? "01-chi-phi-van-chuyen-vi.png" : "02-chi-phi-van-chuyen-en.png");
    await shotRegion(page, file, page.locator("section.freight"), legend);
    shots.push(file);
    if (lang === "vi") {
      const full = path.join(dir, "03-toan-bo-ban-in-vi.png");
      await page.screenshot({ path: full, fullPage: true });
      shots.push(full);
    }
  }
  await browser.close();
  console.log(["E54 xong:", ...shots].join("\n  "));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
