const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
export const formatVnd = (value: number) => vnd.format(value);
const foreign = new Map<string, Intl.NumberFormat>();
/** Mọi loại tiền dùng dấu chấm phân cách hàng nghìn (locale vi-VN). */
export const formatMoney = (value: number, currency: string) => {
  if (currency === "VND") return vnd.format(value);
  let f = foreign.get(currency);
  if (!f) {
    foreign.set(
      currency,
      (f = new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      })),
    );
  }
  return f.format(value);
};
export const formatNumber =(value: number) => num.format(value);

/** Số tiền có dấu chấm phân cách hàng nghìn kiểu Việt (1.000.000 hoặc 1.000.000,5). */
export function formatMoneyGrouped(value: number, maxFractionDigits = 2): string {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

/**
 * Đọc số tiền từ ô nhập: chấp nhận `1.000.000`, `1.000.000,5`, `1000000`,
 * và kiểu en `1,000,000.5` khi dán từ nguồn khác.
 */
export function parseMoneyInput(value: string): number | null {
  const trimmed = value.trim().replace(/\s/g, "");
  if (!trimmed) return null;
  let normalized: string;
  if (trimmed.includes(",")) {
    const lastComma = trimmed.lastIndexOf(",");
    const lastDot = trimmed.lastIndexOf(".");
    if (lastDot > lastComma) {
      // en-US: 1,000,000.5
      normalized = trimmed.replace(/,/g, "");
    } else {
      // vi-VN: 1.000.000,5
      normalized = trimmed.replace(/\./g, "").replace(",", ".");
    }
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(trimmed)) {
    normalized = trimmed.replace(/\./g, "");
  } else {
    normalized = trimmed;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Chuẩn hóa chuỗi đang gõ về dạng chỉ còn chữ số + tối đa một dấu phẩy thập phân. */
function moneyDigitsAndComma(body: string): string {
  if (/^\d{1,3}(,\d{3})+(\.\d*)?$/.test(body)) return body.replace(/,/g, "").replace(".", ",");
  if (/^\d{1,3}(\.\d{3})+(,\d*)?$/.test(body)) return body.replace(/\./g, "");
  if (/^\d+\.\d{0,2}$/.test(body)) return body.replace(".", ",");
  return body.replace(/\./g, "");
}

/** Format lại chuỗi đang gõ trong ô tiền (giữ dấu phẩy thập phân đang dở). */
export function formatMoneyInput(raw: string): string {
  const compact = raw.replace(/\s/g, "");
  if (!compact) return "";
  const negative = compact.startsWith("-");
  const cleaned = moneyDigitsAndComma(negative ? compact.slice(1) : compact).replace(/[^\d,]/g, "");
  const trailingComma = cleaned.endsWith(",");
  const [intRaw = "", ...fracParts] = cleaned.split(",");
  const frac = fracParts.join("").slice(0, 2);
  const intDigits = intRaw.replace(/^0+(?=\d)/, "");
  if (!intDigits && frac === "" && !trailingComma) return negative ? "-" : "";
  const intFormatted = (intDigits || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const result = fracParts.length > 0 || trailingComma ? `${intFormatted},${frac}` : intFormatted;
  return negative ? `-${result}` : result;
}

/** 1.250.000.000 → "1,25 tỷ", 85.000.000 → "85 tr" */
export function formatVndCompact(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value / 1e9)} tỷ`;
  if (abs >= 1e6) return `${num.format(Math.round(value / 1e5) / 10)} tr`;
  return formatVnd(value);
}

/** "2026-10-28" → "28/10/2026" */
export const formatDate = (iso: string) => iso.split("-").reverse().join("/");
/** "2026-10-28" → "28/10" */
export const formatDayMonth = (iso: string) => iso.slice(5).split("-").reverse().join("/");
