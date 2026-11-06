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

/** Làm tròn lên bội 0,5 kg: 30,4 → 30,5; 30,6 → 31; 30 và 30,5 giữ nguyên. */
export function ceilHalf(value: number): number {
  return Math.ceil(round(value, 3) * 2) / 2;
}

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
  // Cân tính cước làm tròn lên 0,5 kg cho từng nhóm đóng gói.
  return { count, cbm: round(cbm, 3), volumetricKg: round(volumetricKg, 1), actualKg: round(actualKg, 1), chargeableKg: ceilHalf(chargeableKg) };
}

/** Tổng đóng gói của cả đơn: cộng số đã làm tròn của từng dòng nên khớp với số hiển thị ở mỗi dòng. */
export function orderPackageMetrics(lines: { packages: PackageSpec[] }[], mode: "AIR" | "SEA" | null = null) {
  const total = { count: 0, cbm: 0, volumetricKg: 0, actualKg: 0, chargeableKg: 0 };
  for (const line of lines) {
    if (line.packages.length === 0) continue;
    const m = packageMetrics(line.packages, mode);
    total.count += m.count;
    total.cbm += m.cbm;
    total.volumetricKg += m.volumetricKg;
    total.actualKg += m.actualKg;
    total.chargeableKg += m.chargeableKg;
  }
  return { count: total.count, cbm: round(total.cbm, 3), volumetricKg: round(total.volumetricKg, 1), actualKg: round(total.actualKg, 1), chargeableKg: round(total.chargeableKg, 1) };
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

/**
 * Cách tính giá được chọn mới. "theo m2" đã bỏ khỏi lựa chọn; dòng đã lưu theo m2 vẫn giữ nguyên
 * (và hiện đúng lựa chọn đó) để không đổi giá đã chốt.
 */
export function selectablePricingBases(current: PricingBasis): PricingBasis[] {
  return (Object.keys(pricingBasisLabels) as PricingBasis[]).filter((basis) => basis !== "m2" || current === "m2");
}

/** Số thập phân theo ngôn ngữ: tiếng Việt dùng dấu phẩy (30,5), tiếng Anh dùng dấu chấm (30.5). */
const numberText = {
  vi: new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }),
  en: new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }),
} as const;

const packageText = {
  vi: {
    pack: (i: number, p: PackageSpec) => `Kiện ${i}: ${p.lengthCm}*${p.widthCm}*${p.heightCm} cm${p.count > 1 ? ` x ${p.count}` : ""}, thực tế ${numberText.vi.format(p.actualKg)} kg`,
    total: (count: number, cbm: number, kg: number) => `Tổng ${count} kiện = ${numberText.vi.format(cbm)} cbm, cân tính cước ${numberText.vi.format(kg)} kg`,
  },
  en: {
    pack: (i: number, p: PackageSpec) => `Package ${i}: ${p.lengthCm}*${p.widthCm}*${p.heightCm} cm${p.count > 1 ? ` x ${p.count}` : ""}, actual ${numberText.en.format(p.actualKg)} kg`,
    total: (count: number, cbm: number, kg: number) => `Total ${count} package${count === 1 ? "" : "s"} = ${numberText.en.format(cbm)} cbm, chargeable weight ${numberText.en.format(kg)} kg`,
  },
} as const;

/** Mô tả đóng gói để in cùng cột Quy cách. */
export function packagesText(packages: PackageSpec[], lang: QuoteLang = "vi", mode: "AIR" | "SEA" | null = null) {
  const m = packageMetrics(packages, mode);
  const text = packageText[lang];
  const rows = packages.map((p, i) => text.pack(i + 1, p));
  if (rows.length) rows.push(text.total(m.count, m.cbm, m.chargeableKg));
  return rows.join("\n");
}
