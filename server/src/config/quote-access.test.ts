import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessQuoteDesk,
  canEditQuoteDesk,
  canViewQuote,
  quoteNotifyRoles,
  visibleKindsForDesk,
} from "./quote-access";

describe("quote-access", () => {
  it("keeps van-hanh full on both desks", () => {
    assert.equal(canAccessQuoteDesk("van-hanh", "sourcing"), true);
    assert.equal(canAccessQuoteDesk("van-hanh", "logistics"), true);
    assert.equal(canEditQuoteDesk("van-hanh", "sourcing"), true);
    assert.equal(canEditQuoteDesk("van-hanh", "logistics"), true);
    assert.equal(visibleKindsForDesk("van-hanh", "sourcing"), null);
  });

  it("scopes sourcing to sourcing desk only", () => {
    assert.equal(canAccessQuoteDesk("sourcing", "sourcing"), true);
    assert.equal(canAccessQuoteDesk("sourcing", "logistics"), false);
    assert.equal(canEditQuoteDesk("sourcing", "sourcing"), true);
    assert.equal(canEditQuoteDesk("sourcing", "logistics"), false);
    assert.equal(canViewQuote("sourcing", "sourcing", "SOURCING"), true);
    assert.equal(canViewQuote("sourcing", "sourcing", "SOURCING_LOGISTICS"), true);
    assert.equal(canViewQuote("sourcing", "logistics", "LOGISTICS"), false);
  });

  it("lets logistics view pure sourcing but not edit it", () => {
    assert.equal(canAccessQuoteDesk("logistics", "sourcing"), true);
    assert.equal(canEditQuoteDesk("logistics", "sourcing"), false);
    assert.equal(canViewQuote("logistics", "sourcing", "SOURCING"), true);
    assert.equal(canViewQuote("logistics", "sourcing", "SOURCING_LOGISTICS"), false);
    assert.equal(canViewQuote("logistics", "logistics", "LOGISTICS"), true);
    assert.equal(canViewQuote("logistics", "logistics", "SOURCING_LOGISTICS"), true);
  });

  it("targets notify roles by desk and kind", () => {
    assert.deepEqual(quoteNotifyRoles("sourcing", "SOURCING"), ["sourcing", "logistics", "van-hanh", "admin"]);
    assert.deepEqual(quoteNotifyRoles("sourcing", "SOURCING_LOGISTICS"), ["sourcing", "van-hanh", "admin"]);
    assert.deepEqual(quoteNotifyRoles("logistics"), ["logistics", "van-hanh", "admin"]);
  });
});
