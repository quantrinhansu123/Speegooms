import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("tsx/package.json"))("esbuild");

test("desktop toggle switches icon and full sidebar and updates content offset", async () => {
  const bundle = await build({
    stdin: { resolveDir: fileURLToPath(new URL(".", import.meta.url)), loader: "tsx", contents: `
      import React from 'react'; import {createRoot} from 'react-dom/client';
      import {AppShell} from './app-shell'; createRoot(document.getElementById('root')).render(<AppShell>Page</AppShell>);` },
    bundle: true, write: false, jsx: "automatic", alias: { react: dirname(require.resolve("react")) },
    tsconfig: fileURLToPath(new URL("../../../tsconfig.json", import.meta.url)),
    plugins: [{ name: "isolate-shell", setup(b) {
      const stubs = {
        "./sidebar": "export function Sidebar({compact}) { return <nav>{compact ? 'Icons' : 'Full menu'}</nav> }",
        "./brand-watermark": "export const BrandWatermark = () => null",
        "./breadcrumbs": "export const Breadcrumbs = () => null",
        "./user-menu": "export const UserMenu = () => null",
        "@/features/notifications/notification-menu": "export const NotificationMenu = () => null",
        "@/features/auth/session-provider": "export const useSession = () => ({})",
        "@/components/shared/route-gate": "export const RouteGate = ({children}) => children",
        "@/components/ui/sheet": "export const Sheet = () => null; export const SheetContent = () => null; export const SheetDescription = () => null; export const SheetTitle = () => null",
      };
      b.onResolve({ filter: /.*/ }, a => a.path in stubs ? { path: a.path, namespace: "stub" } : undefined);
      b.onLoad({ filter: /.*/, namespace: "stub" }, a => ({ contents: stubs[a.path], loader: "tsx" }));
    } }],
  });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const sidebar = page.locator("#desktop-sidebar");
    await sidebar.waitFor();
    assert.equal(await sidebar.textContent(), "Icons");
    await page.getByRole("button", { name: "Hiện đầy đủ danh mục bên trái" }).click();
    assert.equal(await sidebar.textContent(), "Full menu");
    assert.match(await sidebar.getAttribute("class"), /w-64/);
    assert.equal(await page.locator('[class*="lg:pl-64"]').count(), 1);
    const toggle = page.getByRole("button", { name: "Thu gọn danh mục bên trái thành icon" });
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    await toggle.click();
    assert.equal(await sidebar.textContent(), "Icons");
    assert.equal(await page.locator('[class*="lg:pl-20"]').count(), 1);
  } finally { await browser.close(); }
});
