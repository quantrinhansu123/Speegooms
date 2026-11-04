/** Tính toán dòng hàng báo giá: kiện → CBM / cân quy đổi / thành tiền. Thuần, không phụ thuộc UI. */

export type PricingBasis = "unit" | "kg" | "cbm" | "lump";

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

/** Thành tiền theo cách tính giá của dòng; kg/CBM là định mức mỗi đơn vị hàng. */
export function lineAmount(l: { basis: PricingBasis; quantity: number | null; price: number | null; weightKg: number | null; cbm: number | null }) {
  if (l.price == null) return null;
  if (l.basis === "lump") return round(l.price);
  if (l.quantity == null) return null;
  if (l.basis === "unit") return round(l.quantity * l.price);
  const metric = l.basis === "kg" ? l.weightKg : l.cbm;
  return metric == null ? null : round(l.quantity * metric * l.price);
}

export const pricingBasisLabels: Record<PricingBasis, string> = { unit: "theo đơn vị", kg: "theo kg", cbm: "theo CBM", lump: "trọn gói" };

/** Mô tả đóng gói để in vào cột Note, giống cách sheet đang ghi tay. */
export function packagesText(packages: PackageSpec[]) {
  const m = packageMetrics(packages);
  const rows = packages.map((p, i) => `Kiện ${i + 1}: ${p.lengthCm}*${p.widthCm}*${p.heightCm} cm${p.count > 1 ? ` x ${p.count}` : ""}, thực tế ${p.actualKg} kg`);
  if (rows.length) rows.push(`Tổng ${m.count} kiện = ${m.cbm} cbm, cân tính cước ${m.chargeableKg} kg`);
  return rows.join("\n");
}
