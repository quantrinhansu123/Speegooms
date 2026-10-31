import { AppError } from "../lib/errors";

/** One fixed upstream, shared daily cache, and no quote data sent to the provider. */
export function createExchangeRateService(fetcher: typeof fetch = fetch) {
  let cached: { rates: Record<string, number>; updatedAt: string; expires: number } | undefined;
  let pending: Promise<void> | undefined;
  return async (currency: string) => {
    if (!/^[A-Z]{3}$/.test(currency)) throw new AppError(400, "VALIDATION", "Mã tiền tệ không hợp lệ");
    if (currency === "VND") return { currency, rate: 1, updatedAt: null };
    if (!cached || cached.expires <= Date.now()) {
      pending ??= (async () => {
        try {
          const response = await fetcher("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(8000) });
          if (!response.ok) throw new Error("upstream unavailable");
          const body = await response.json() as { result: string; base_code: string; rates: Record<string, number>; time_last_update_unix: number; time_next_update_unix: number };
          if (body.result !== "success" || body.base_code !== "USD" || !Number.isFinite(body.rates?.VND) || body.rates.VND <= 0
            || !Number.isFinite(body.time_last_update_unix) || !Number.isFinite(body.time_next_update_unix)) throw new Error("invalid upstream response");
          cached = { rates: body.rates, updatedAt: new Date(body.time_last_update_unix * 1000).toISOString(),
            expires: Math.min(Date.now() + 86400000, Math.max(Date.now() + 3600000, body.time_next_update_unix * 1000)) };
        } catch {
          throw new AppError(503, "EXCHANGE_RATE_UNAVAILABLE", "Không lấy được tỷ giá. Bạn có thể nhập tỷ giá thủ công.");
        }
      })().finally(() => { pending = undefined; });
      await pending;
    }
    const base = cached!.rates[currency];
    if (!Number.isFinite(base) || base <= 0) throw new AppError(400, "CURRENCY_UNSUPPORTED", "Nguồn tỷ giá chưa hỗ trợ loại tiền này. Vui lòng nhập tay.");
    return { currency, rate: Math.round(cached!.rates.VND / base * 10000) / 10000, updatedAt: cached!.updatedAt };
  };
}

export const exchangeRate = createExchangeRateService();
