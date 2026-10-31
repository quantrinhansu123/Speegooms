import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessQuoteDesk,
  canEditQuoteDesk,
  canViewCustomerKind,
  canViewQuote,
  quoteNotifyRoles,
  visibleKindsForDesk,
  type Role,
} from "@speego/shared";

const sorted = (roles: readonly Role[]) => [...roles].sort();

describe("quote-access", () => {
  it("keeps van-hanh full on both desks", () => {
    assert.equal(canAccessQuoteDesk("van-hanh", "sourcing"), true);
    assert.equal(canAccessQuoteDesk("van-hanh", "logistics"), true);
    assert.equal(canEditQuoteDesk("van-hanh", "sourcing"), true);
    assert.equal(canEditQuoteDesk("van-hanh", "logistics"), true);
    assert.equal(visibleKindsForDesk("van-hanh", "sourcing"), null);
  });

  it("lets ban-gd read both desks without editing", () => {
    assert.equal(canAccessQuoteDesk("ban-gd", "logistics"), true);
    assert.equal(canEditQuoteDesk("ban-gd", "sourcing"), false);
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

  it("scopes potential kinds: pure sourcing shared, pure logistics hidden from sourcing", () => {
    assert.equal(canViewCustomerKind("sourcing", "SOURCING"), true);
    assert.equal(canViewCustomerKind("logistics", "SOURCING"), true);
    assert.equal(canViewCustomerKind("van-hanh", "SOURCING"), true);
    assert.equal(canViewCustomerKind("sourcing", "LOGISTICS"), false);
    assert.equal(canViewCustomerKind("logistics", "LOGISTICS"), true);
    assert.equal(canViewCustomerKind("sourcing", "SOURCING_LOGISTICS"), true);
    assert.equal(canViewCustomerKind("logistics", "SOURCING_LOGISTICS"), true);
  });

  it("denies roles without a desk policy", () => {
    assert.equal(canAccessQuoteDesk("sale-vn", "sourcing"), false);
    assert.equal(canEditQuoteDesk("ke-toan", "logistics"), false);
  });

  it("targets notify roles by desk and kind", () => {
    assert.deepEqual(sorted(quoteNotifyRoles("sourcing", "SOURCING")), sorted(["sourcing", "logistics", "van-hanh", "admin"]));
    assert.deepEqual(sorted(quoteNotifyRoles("sourcing", "SOURCING_LOGISTICS")), sorted(["sourcing", "van-hanh", "admin"]));
    assert.deepEqual(sorted(quoteNotifyRoles("logistics")), sorted(["logistics", "van-hanh", "admin"]));
  });
});
