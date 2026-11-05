import type { SentQuote } from "./crm";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Việt Nam không dùng giờ mùa hè nên cố định UTC+7. */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
export const QUOTE_VALIDITY_WARN_DAYS = 7;

export interface QuoteValidity {
  days: number;
  /** Ngày gửi báo giá, dạng yyyy-mm-dd theo giờ Việt Nam. */
  sentOn: string;
  /** Ngày cuối cùng báo giá còn hiệu lực, dạng yyyy-mm-dd theo giờ Việt Nam. */
  expiresOn: string;
  /** Số ngày còn lại tính cả hôm nay; 0 nghĩa là hôm nay là ngày cuối. Âm khi đã hết hạn. */
  remainingDays: number;
  expired: boolean;
}

/** Số ngày (theo lịch Việt Nam) kể từ mốc 1970-01-01. */
function vnDayIndex(date: Date): number {
  return Math.floor((date.getTime() + VN_OFFSET_MS) / DAY_MS);
}

function dayIso(index: number): string {
  return new Date(index * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Hạn báo giá: ngày gửi gần nhất + số ngày hiệu lực. Gửi lại ghi đè sentAt nên tự đếm lại.
 * Trả null khi chưa gửi hoặc báo giá cũ chưa có số ngày.
 */
export function quoteValidity(sent: Pick<SentQuote, "sentAt" | "notes"> | null | undefined, now: Date = new Date()): QuoteValidity | null {
  const days = sent?.notes.validityDays;
  if (!sent || typeof days !== "number" || !Number.isInteger(days) || days < 1) return null;
  const sentAt = new Date(sent.sentAt);
  if (Number.isNaN(sentAt.getTime())) return null;
  const sentIndex = vnDayIndex(sentAt);
  const expiresIndex = sentIndex + days;
  const remainingDays = expiresIndex - vnDayIndex(now);
  return { days, sentOn: dayIso(sentIndex), expiresOn: dayIso(expiresIndex), remainingDays, expired: remainingDays < 0 };
}

/** yyyy-mm-dd → dd/mm/yyyy. */
export function formatQuoteDay(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}
