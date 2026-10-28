import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const variables = new Map([...css.matchAll(/--([\w-]+):\s*(#[\da-f]{6}|var\(--[\w-]+\))/gi)].map((m) => [m[1], m[2]]));
const color = (name) => { const value = variables.get(name); assert.ok(value, name); return value.startsWith("var") ? color(value.slice(6, -1)) : value; };
const luminance = (hex) => {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
assert.equal(luminance("#000000"), 0);
assert.equal(luminance("#ffffff"), 1);
const pairs = [["foreground", "background"], ["muted-foreground", "card"], ["primary-foreground", "primary"], ["success", "success-soft"], ["warning", "warning-soft"], ["danger", "danger-soft"], ["info", "info-soft"], ["neutral", "neutral-soft"], ["sidebar-foreground", "sidebar"], ["sidebar-accent-foreground", "sidebar-accent"], ["brand-orange-text", "card"]];
for (const [foreground, background] of pairs) {
  const a = luminance(color(foreground)), b = luminance(color(background));
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  assert.ok(ratio >= 4.5, `${foreground}/${background}: ${ratio.toFixed(2)} < 4.5`);
  console.log(`${foreground}/${background}: ${ratio.toFixed(2)}:1`);
}
console.log("PASS: semantic text color pairs meet 4.5:1. This is not a full WCAG certification.");
