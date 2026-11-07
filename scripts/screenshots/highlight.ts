import { mkdirSync } from "node:fs";
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
      // Trải hết chiều ngang khi chèn vào form dạng lưới nhiều cột.
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

/** Chụp vùng bao cả phần đã bôi đỏ và bảng chú thích, chừa lề cho số thứ tự. */
export async function shotRegion(page: Page, file: string, from: Locator, to: Locator): Promise<void> {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  if (!a || !b) throw new Error("Không đo được vùng chụp");
  const x = Math.max(Math.min(a.x, b.x) - 40, 0);
  const y = Math.max(Math.min(a.y, b.y) - 16, 0);
  const right = Math.max(a.x + a.width, b.x + b.width) + 16;
  const bottom = Math.max(a.y + a.height, b.y + b.height) + 16;
  await page.screenshot({ path: file, clip: { x, y, width: right - x, height: bottom - y }, fullPage: true });
}
