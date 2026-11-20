import type { QuoteOrder } from "./crm";

/** So sánh dữ liệu dùng tính cước; mô tả tự do và giá tiền không xác định phiên bản kiện hàng. */
export function quoteShipmentMatches(left: QuoteOrder, right: QuoteOrder): boolean {
  const number = (value: number | null) => value == null ? null : Math.round(value * 1e6) / 1e6;
  const shipment = (order: QuoteOrder) => order.lines.map((line) => ({
    stt: line.stt.trim(),
    product: line.productName?.trim() ?? "",
    quantity: number(line.quantity),
    unit: line.unit.trim(),
    packages: line.packages.map((pkg) => ({
      count: pkg.count, lengthCm: number(pkg.lengthCm), widthCm: number(pkg.widthCm),
      heightCm: number(pkg.heightCm), actualKg: number(pkg.actualKg),
    })),
    // Có kiện thì cân/CBM mỗi sản phẩm chỉ là kết quả suy ra, không so sánh các số làm tròn đó.
    ...(line.packages.length ? {} : { weightKg: number(line.weightKg), cbm: number(line.cbm) }),
  }));
  return JSON.stringify(shipment(left)) === JSON.stringify(shipment(right));
}

/** Cho phép lưu nháp thiếu số đo; trước khi gửi phải hoàn tất các nhóm kiện đã khai. KH thuần Logistics: số đo không phải bên báo giá nhập, chỉ cần cước. */
export function quotePackageIssue(order: QuoteOrder, customerKind?: string | null): string | null {
  if (customerKind === "LOGISTICS") return null;
  for (const [index, line] of order.lines.entries()) {
    for (const [packageIndex, pkg] of line.packages.entries()) {
      const label = `${line.productName || `Dòng ${index + 1}`}, kiện ${packageIndex + 1}`;
      if (!(pkg.count > 0 && pkg.lengthCm > 0 && pkg.widthCm > 0 && pkg.heightCm > 0)) {
        return `${label}: nhập đủ số kiện và dài × rộng × cao lớn hơn 0 trước khi gửi báo giá.`;
      }
      // Sale đã nhập cân quy đổi cho dòng thì được dùng làm cân thực khi kiện chưa có kg/kiện.
      if (!(pkg.actualKg > 0) && !((line.weightKg ?? 0) > 0)) return `${label}: nhập trọng lượng thực tế kg/kiện lớn hơn 0 trước khi gửi báo giá (không nhập tổng kg vào ô kg/kiện).`;
    }
  }
  return null;
}

/** Báo giá Sourcing luồng gộp: Logistics cần đóng gói của từng dòng hàng để tính cước, nên dòng có hàng phải có kiện. */
export function quoteMissingPackagingIssue(order: QuoteOrder): string | null {
  const line = order.lines.find((item) => (item.productName?.trim() || item.quantity != null) && item.packages.length === 0);
  return line ? `${line.productName?.trim() || `Dòng ${line.stt}`}: nhập quy cách đóng gói (số kiện, dài × rộng × cao, kg/kiện) trước khi gửi để Logistics nhận được thông tin tính cước.` : null;
}
