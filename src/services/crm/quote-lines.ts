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

/** Hệ số quy đổi thể tích: kg = D×R×C(cm) / 6000. Khớp các mẫu 105×81×141→200kg, 110×95×100→175kg. */
export const VOLUMETRIC_DIVISOR = 6000;

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function packageMetrics(packages: PackageSpec[]) {
  let cbm = 0, volumetricKg = 0, actualKg = 0, count = 0;
  for (const p of packages) {
    const vol = p.lengthCm * p.widthCm * p.heightCm;
    cbm += (vol / 1e6) * p.count;
    volumetricKg += (vol / VOLUMETRIC_DIVISOR) * p.count;
    actualKg += p.actualKg * p.count;
    count += p.count;
  }
  // Cước tính theo số lớn hơn giữa cân thực và cân quy đổi
  return { count, cbm: round(cbm, 3), volumetricKg: round(volumetricKg, 1), actualKg: round(actualKg, 1), chargeableKg: round(Math.max(actualKg, volumetricKg), 1) };
}

/** Thành tiền theo cách tính giá của dòng; null nếu thiếu dữ liệu cần thiết. */
export function lineAmount(l: { basis: PricingBasis; quantity: number | null; price: number | null; weightKg: number | null; cbm: number | null; areaM2?: number | null }) {
  if (l.price == null) return null;
  const base = l.basis === "unit" ? l.quantity
    : l.basis === "kg" ? l.weightKg
    : l.basis === "m2" ? l.areaM2
    : l.basis === "cbm" ? l.cbm
    : 1;
  return base == null ? null : round(base * l.price);
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
export function packagesText(packages: PackageSpec[], lang: QuoteLang = "vi") {
  const m = packageMetrics(packages);
  const text = packageText[lang];
  const rows = packages.map((p, i) => text.pack(i + 1, p));
  if (rows.length) rows.push(text.total(m.count, m.cbm, m.chargeableKg));
  return rows.join("\n");
}
