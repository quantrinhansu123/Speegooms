/** Tính toán dòng hàng báo giá: kiện → CBM / cân quy đổi / thành tiền. Thuần, không phụ thuộc UI. */

import type { QuoteLang } from "@speego/shared";

export type PricingBasis = "unit" | "kg" | "m2" | "cbm" | "lump";

export interface PackageSpec {
  count: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  actualKg: number;
}

/** Khách cũ chưa có phương thức được tính theo hệ số đường biển đang dùng. */
export const VOLUMETRIC_DIVISOR = { AIR: 5000, SEA: 6000 } as const;

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function packageMetrics(packages: PackageSpec[], mode: "AIR" | "SEA" | null = null) {
  let cbm = 0, volumetricKg = 0, actualKg = 0, chargeableKg = 0, count = 0;
  for (const p of packages) {
    const pieces = p.count > 0 ? p.count : 0;
    const vol = p.lengthCm * p.widthCm * p.heightCm;
    const volKg = (vol / VOLUMETRIC_DIVISOR[mode ?? "SEA"]) * pieces;
    const actKg = p.actualKg * pieces;
    cbm += (vol / 1e6) * pieces;
    volumetricKg += volKg;
    actualKg += actKg;
    // Mỗi kiện (hoặc nhóm kiện giống nhau) tự so cân thực với cân thể tích, rồi mới cộng dồn.
    chargeableKg += Math.max(actKg, volKg);
    count += pieces;
  }
  return { count, cbm: round(cbm, 3), volumetricKg: round(volumetricKg, 1), actualKg: round(actualKg, 1), chargeableKg: round(chargeableKg, 1) };
}

/** Thành tiền theo cách tính giá của dòng; kg/m2/CBM là định mức mỗi đơn vị hàng. */
export function lineAmount(l: { basis: PricingBasis; quantity: number | null; price: number | null; weightKg: number | null; cbm: number | null; areaM2?: number | null }) {
  if (l.price == null) return null;
  if (l.basis === "lump") return round(l.price, 3);
  if (l.quantity == null) return null;
  if (l.basis === "unit") return round(l.quantity * l.price, 3);
  const metric = l.basis === "kg" ? l.weightKg : l.basis === "m2" ? l.areaM2 : l.cbm;
  return metric == null ? null : round(l.quantity * metric * l.price, 3);
}

export const pricingBasisLabels: Record<PricingBasis, string> = { unit: "theo đơn vị", kg: "theo kg", m2: "theo m2", cbm: "theo CBM", lump: "trọn gói" };

const packageText = {
  vi: {
    pack: (i: number, p: PackageSpec) => `Kiện ${i}: ${p.lengthCm}*${p.widthCm}*${p.heightCm} cm${p.count > 1 ? ` x ${p.count}` : ""}, thực tế ${p.actualKg} kg`,
    total: (count: number, cbm: number, kg: number) => `Tổng ${count} kiện = ${cbm} cbm, cân tính cước ${kg} kg`,
  },
  en: {
    pack: (i: number, p: PackageSpec) => `Package ${i}: ${p.lengthCm}*${p.widthCm}*${p.heightCm} cm${p.count > 1 ? ` x ${p.count}` : ""}, actual ${p.actualKg} kg`,
    total: (count: number, cbm: number, kg: number) => `Total ${count} package${count === 1 ? "" : "s"} = ${cbm} cbm, chargeable weight ${kg} kg`,
  },
} as const;

/** Mô tả đóng gói để in vào cột Note, giống cách sheet đang ghi tay. */
export function packagesText(packages: PackageSpec[], lang: QuoteLang = "vi", mode: "AIR" | "SEA" | null = null) {
  const m = packageMetrics(packages, mode);
  const text = packageText[lang];
  const rows = packages.map((p, i) => text.pack(i + 1, p));
  if (rows.length) rows.push(text.total(m.count, m.cbm, m.chargeableKg));
  return rows.join("\n");
}
