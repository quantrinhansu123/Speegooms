const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

export const formatVnd = (value: number) => vnd.format(value);
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const foreign = new Map<string, Intl.NumberFormat>();
/** VND hiển thị kiểu Việt; mọi ngoại tệ khác (USD, AUD, EUR...) hiển thị kiểu en-US theo mã tiền. */
export const formatMoney = (value: number, currency: string) => {
  if (currency === "VND") return vnd.format(value);
  if (currency === "USD") return usd.format(value);
  let f = foreign.get(currency);
  if (!f) foreign.set(currency, (f = new Intl.NumberFormat("en-US", { style: "currency", currency })));
  return f.format(value);
};
export const formatNumber =(value: number) => num.format(value);

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
