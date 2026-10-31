import assert from "node:assert/strict";
import { test } from "node:test";
import { createExchangeRateService } from "./exchange-rate.service";

test("daily rates convert to VND, share requests and cache results", async () => {
  let calls = 0;
  const rate = createExchangeRateService((async () => {
    calls++;
    return Response.json({ result: "success", base_code: "USD", rates: { USD: 1, VND: 25000, EUR: 0.8 },
      time_last_update_unix: Date.now() / 1000, time_next_update_unix: Date.now() / 1000 + 86400 });
  }) as typeof fetch);
  const [usd, eur] = await Promise.all([rate("USD"), rate("EUR")]);
  assert.equal(usd.rate, 25000);
  assert.equal(eur.rate, 31250);
  await rate("USD");
  assert.equal(calls, 1);
  assert.equal((await rate("VND")).rate, 1);
  await assert.rejects(rate("../USD"), /Mã tiền tệ/);
  await assert.rejects(rate("ZZZ"), /nhập tay/);
});

test("upstream failure can be retried without changing a saved quote", async () => {
  let calls = 0;
  const rate = createExchangeRateService((async () => { calls++; throw new Error("offline"); }) as typeof fetch);
  await assert.rejects(rate("USD"), /thủ công/);
  await assert.rejects(rate("USD"), /thủ công/);
  assert.equal(calls, 2);
});
