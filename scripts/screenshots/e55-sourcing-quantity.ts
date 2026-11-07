/**
 * E55 — Chuyển mess sang khách tiềm năng: đơn Tìm hàng (Sourcing) không còn ô Số lượng,
 * đơn Vận chuyển (Logistics) vẫn có và vẫn bắt buộc.
 *
 * Chụp trên form "Tạo khách tiềm năng" (cùng bộ ô với hộp thoại Chuyển ở Mess). Chỉ mở form và chọn Nhu cầu,
 * không bấm Tạo nên không ghi dữ liệu.
 *
 * Cần app đang chạy (pnpm dev:stack) và một tài khoản Sale/Admin:
 *   E2E_EMAIL=... E2E_PASSWORD=... pnpm screenshots:e55
 * Tuỳ chọn E2E_BASE_URL (mặc định http://localhost:3000). Ảnh ở screenshots/E55.
 */
import path from "node:path";
import type { Page } from "playwright";
import { highlight, launchBrowser, outDir, shotRegion } from "./highlight";

const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

async function login(page: Page) {
  if (!email || !password) throw new Error("Thiếu E2E_EMAIL hoặc E2E_PASSWORD (tài khoản Sale/Admin để mở form khách tiềm năng)");
  await page.goto(`${baseUrl}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

/** Mở form Tạo khách tiềm năng và chọn Nhu cầu. */
async function openLeadForm(page: Page, demand: "SOURCING" | "SHIPPING") {
  await page.goto(`${baseUrl}/sale-viet-nam/tiem-nang`);
  await page.getByRole("button", { name: "Tạo khách tiềm năng" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await page.selectOption("#mess-demand", demand);
  if (demand === "SHIPPING") await page.selectOption("#lead-mode", "AIR");
  // Chỉ trong trình duyệt chụp ảnh: bỏ giới hạn chiều cao và thanh cuộn của hộp thoại để cả form hiện hết,
  // khung đỏ (tính theo vị trí trên màn hình) mới khớp đúng ô.
  await page.addStyleTag({
    content: `[role="dialog"], [role="dialog"] * { max-height: none !important; overflow: visible !important; }
      [role="dialog"] { top: 16px !important; left: 0 !important; right: 0 !important; margin: 0 auto !important;
        translate: none !important; transform: none !important; height: auto !important; }`,
  });
  await page.waitForTimeout(300);
  return dialog;
}

/** Khối ô từ Nguồn tới Địa chỉ trong form. */
const fieldBlock = (id: string) => `div:has(> #${id})`;

async function main() {
  const dir = outDir("E55");
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 900, height: 2600 }, deviceScaleFactor: 2 });
  await login(page);
  const shots: string[] = [];

  // 1. Đơn Tìm hàng: không còn ô Số lượng giữa Kênh chăm sóc và Địa chỉ.
  await openLeadForm(page, "SOURCING");
  if (await page.locator("#lead-quantity").count()) throw new Error("Đơn Tìm hàng vẫn còn ô Số lượng");
  let legend = await highlight(page, [
    { selector: `${fieldBlock("mess-demand")}`, label: "Nhu cầu: Tìm hàng (khách Sourcing)" },
    { selector: `${fieldBlock("lead-brand")}, ${fieldBlock("lead-care")}, ${fieldBlock("lead-address")}`, label: "Không còn ô Số lượng (trước đây nằm giữa Kênh chăm sóc và Địa chỉ)", all: true },
  ], fieldBlock("lead-address"), "E55 — Đơn Tìm hàng (Sourcing): tắt ô Số lượng khi chuyển sang khách tiềm năng");
  let file = path.join(dir, "01-tim-hang-khong-co-so-luong.png");
  await shotRegion(page, file, page.locator(fieldBlock("mess-demand")), legend);
  shots.push(file);

  // 2. Đơn Vận chuyển: vẫn có ô Số lượng (bắt buộc).
  await openLeadForm(page, "SHIPPING");
  if (!(await page.locator("#lead-quantity").count())) throw new Error("Đơn Vận chuyển mất ô Số lượng");
  legend = await highlight(page, [
    { selector: `${fieldBlock("mess-demand")}`, label: "Nhu cầu: Vận chuyển (khách Logistics)" },
    { selector: fieldBlock("lead-quantity"), label: "Vẫn có ô Số lượng và vẫn bắt buộc" },
  ], fieldBlock("lead-address"), "E55 — Đơn Vận chuyển (Logistics): giữ nguyên ô Số lượng");
  file = path.join(dir, "02-van-chuyen-van-co-so-luong.png");
  await shotRegion(page, file, page.locator(fieldBlock("mess-demand")), legend);
  shots.push(file);

  await browser.close();
  console.log(["E55 xong:", ...shots].join("\n  "));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
