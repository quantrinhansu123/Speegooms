import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Locator, type Page } from "playwright";

/** Ảnh lưu theo yêu cầu: screenshots/E54, screenshots/E55… */
export function outDir(request: string): string {
  const dir = path.resolve(process.cwd(), "screenshots", request);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Dùng Chrome hoặc Edge có sẵn trên máy để không phải tải Chromium của Playwright. */
export async function launchBrowser(): Promise<Browser> {
  for (const channel of ["chrome", "msedge"] as const) {
    try {
      return await chromium.launch({ channel });
    } catch {
      /* thử trình duyệt kế tiếp */
    }
  }
  return chromium.launch();
}

export const e2eBaseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";

function seedPassword(): string | undefined {
  const file = path.resolve(process.cwd(), "server", ".env");
  if (!existsSync(file)) return undefined;
  return readFileSync(file, "utf8").match(/^SEED_USER_PASSWORD=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
}

export function e2eAuth(fallbackPassword = "speego@demo"): { email: string; password: string } {
  return {
    email: process.env.E2E_EMAIL ?? "admin@speego.vn",
    password: process.env.E2E_PASSWORD ?? seedPassword() ?? fallbackPassword,
  };
}

export async function login(page: Page, auth = e2eAuth()): Promise<void> {
  await page.goto(`${e2eBaseUrl}/login`);
  await page.fill("#email", auth.email);
  await page.fill("#password", auth.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

export type Mark = { selector: string; label: string; all?: boolean };

/**
 * Bôi đỏ chỗ đã sửa: viền đỏ quanh phần tử, số thứ tự tròn đỏ ngay ngoài góc trái khung (không che nội dung),
 * và bảng chú thích đỏ chèn ngay sau `legendAfter` ghi nội dung từng chỗ sửa.
 * Trả về locator của bảng chú thích để chụp kèm.
 */
export async function highlight(page: Page, marks: Mark[], legendAfter: string, title: string): Promise<Locator> {
  await page.evaluate(({ items, after, heading }) => {
    document.querySelectorAll("[data-shot-mark]").forEach((node) => node.remove());
    const anchor = document.querySelector(after);
    if (!anchor) throw new Error(`Không tìm thấy chỗ chèn chú thích: ${after}`);
    const legend = document.createElement("div");
    legend.dataset.shotMark = "legend";
    legend.id = "shot-legend";
    Object.assign(legend.style, {
      gridColumn: "1 / -1",
      margin: "14px 0 0", padding: "10px 14px", border: "2px solid #e11d48", borderRadius: "6px",
      background: "#fff1f2", color: "#9f1239", font: "13px/1.5 Arial, sans-serif",
    });
    const legendTitle = document.createElement("div");
    legendTitle.textContent = heading;
    Object.assign(legendTitle.style, { fontWeight: "700", marginBottom: "4px" });
    legend.append(legendTitle);
    anchor.after(legend);

    items.forEach((item, index) => {
      const targets = item.all ? [...document.querySelectorAll(item.selector)] : [document.querySelector(item.selector)].filter(Boolean);
      if (targets.length === 0) throw new Error(`Không tìm thấy phần tử để bôi đỏ: ${item.selector}`);
      const rects = targets.map((node) => (node as Element).getBoundingClientRect());
      const left = Math.min(...rects.map((rect) => rect.left)) + window.scrollX;
      const top = Math.min(...rects.map((rect) => rect.top)) + window.scrollY;
      const right = Math.max(...rects.map((rect) => rect.right)) + window.scrollX;
      const bottom = Math.max(...rects.map((rect) => rect.bottom)) + window.scrollY;
      const pad = 3;
      const box = document.createElement("div");
      box.dataset.shotMark = "box";
      Object.assign(box.style, {
        position: "absolute", left: `${left - pad}px`, top: `${top - pad}px`,
        width: `${right - left + pad * 2}px`, height: `${bottom - top + pad * 2}px`,
        border: "3px solid #e11d48", borderRadius: "4px", pointerEvents: "none", zIndex: "2147483646",
      });
      const badge = document.createElement("div");
      badge.dataset.shotMark = "badge";
      badge.textContent = String(index + 1);
      Object.assign(badge.style, {
        position: "absolute", left: `${left - pad - 26}px`, top: `${top - pad}px`, width: "22px", height: "22px",
        borderRadius: "50%", background: "#e11d48", color: "#fff", font: "700 13px/22px Arial, sans-serif",
        textAlign: "center", pointerEvents: "none", zIndex: "2147483647",
      });
      document.body.append(box, badge);
      const row = document.createElement("div");
      row.innerHTML = `<span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:#e11d48;color:#fff;font-weight:700;text-align:center;line-height:20px;margin-right:8px">${index + 1}</span>`;
      row.append(document.createTextNode(item.label));
      Object.assign(row.style, { margin: "4px 0" });
      legend.append(row);
    });
  }, { items: marks, after: legendAfter, heading: title });
  return page.locator("#shot-legend");
}

/** Gắn data-* theo text nút trong root (CSS thuần, tránh :has-text trong querySelector). */
export async function tagButtonsByText(
  page: Page,
  rootSelector: string,
  textToAttr: Record<string, string>,
): Promise<void> {
  await page.evaluate(({ rootSelector: root, map }) => {
    const el = document.querySelector(root);
    if (!el) return;
    el.querySelectorAll("button").forEach((button) => {
      const text = button.textContent?.trim() ?? "";
      const attr = map[text];
      if (attr) button.setAttribute(attr, "1");
    });
  }, { rootSelector, map: textToAttr });
}

/** Neo chú thích trong portal/dialog fixed để legend không rơi ra layout ngoài. */
export async function ensureLegendAnchor(page: Page, rootSelector: string, attr = "data-shot-legend-anchor"): Promise<string> {
  await page.evaluate(({ rootSelector: root, attr: name }) => {
    const el = document.querySelector(root);
    if (!el) throw new Error(`Không tìm thấy root: ${root}`);
    if (!el.querySelector(`[${name}]`)) {
      const anchor = document.createElement("div");
      anchor.setAttribute(name, "1");
      el.append(anchor);
    }
  }, { rootSelector, attr });
  return `[${attr}]`;
}

export type ShotRegionOptions = {
  /** boundingBox là tọa độ viewport — mặc định false để khớp clip. */
  fullPage?: boolean;
  padX?: number;
  padY?: number;
  /** Giới hạn mép phải/dưới (viewport), hữu ích với dialog fixed. */
  clamp?: { width: number; height: number };
};

/** Chụp vùng bao cả phần đã bôi đỏ và bảng chú thích, chừa lề cho số thứ tự. */
export async function shotRegion(
  page: Page,
  file: string,
  from: Locator,
  to: Locator,
  opts: ShotRegionOptions = {},
): Promise<void> {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  if (!a || !b) throw new Error("Không đo được vùng chụp");
  const padX = opts.padX ?? 40;
  const padY = opts.padY ?? 16;
  const x = Math.max(Math.min(a.x, b.x) - padX, 0);
  const y = Math.max(Math.min(a.y, b.y) - padY, 0);
  let right = Math.max(a.x + a.width, b.x + b.width) + 16;
  let bottom = Math.max(a.y + a.height, b.y + b.height) + 16;
  if (opts.clamp) {
    right = Math.min(right, opts.clamp.width);
    bottom = Math.min(bottom, opts.clamp.height);
  }
  await page.screenshot({
    path: file,
    clip: { x, y, width: Math.max(right - x, 1), height: Math.max(bottom - y, 1) },
    fullPage: opts.fullPage ?? false,
  });
}
