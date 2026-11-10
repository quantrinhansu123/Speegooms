import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request } from "express";
import type pg from "pg";
import { PostgresCrmRepository } from "../adapters/postgres/crm.repository";
import { readQuoteSearch } from "../search/parse-list-search";
import { CrmService } from "../services/crm.service";
import { crmActor } from "../lib/crm-actor";
import {
  canAccessQuoteDesk,
  canEditQuoteDesk,
  canViewCustomerKind,
  canViewQuote,
  quoteNotifyRoles,
  visibleCustomerKinds,
  visibleKindsForDesk,
  type PublicUser,
  type Role,
} from "@speego/shared";

const sorted = (roles: readonly Role[]) => [...roles].sort();

describe("quote-access", () => {
  it("loads all admin Logistics quotes on either lane while retaining filters and handoff scope", async () => {
    const statements: { sql: string; values: unknown[] }[] = [];
    const repository = new PostgresCrmRepository({
      query: async (sql: string, values: unknown[]) => {
        statements.push({ sql, values });
        return { rows: [], rowCount: 0 };
      },
    } as unknown as pg.Pool);
    const service = new CrmService(repository);
    const search = { q: "Chin Tran", from: "", to: "", quoteStatus: "", contractStatus: "", customerKind: "" };
    for (const lane of ["vn", "global"] as const) {
      statements.length = 0;
      await crmActor.run({ id: "admin", role: "admin" } as PublicUser,
        () => service.listQuotes(lane, "logistics", search, "admin"));
      assert.equal(statements.length, 2);
      for (const { sql, values } of statements) {
        assert.doesNotMatch(sql, /limit 200/i);
        assert.match(sql, /l\.xoa_luc is null/);
        assert.deepEqual(values, ["%Chin Tran%"]);
        assert.match(sql, new RegExp(lane === "vn" ? "bao_gia_.*_viet_nam" : "bao_gia_.*_global"));
      }
      assert.match(statements[1].sql, /handoffAt/);
      for (const role of ["logistics", "van-hanh", "ban-gd"] as const) {
        statements.length = 0;
        await service.listQuotes(lane, "logistics", { ...search, unlimited: true }, role);
        assert.ok(statements.every(({ sql }) => /limit 200/i.test(sql)));
      }
    }
    const parsed = readQuoteSearch({ query: { unlimited: "true" } } as unknown as Request);
    assert.equal(parsed.unlimited, undefined);
    await assert.rejects(service.listQuotes("vn", "logistics", search, "sourcing"), /Không có quyền/);
  });

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
    assert.equal(visibleCustomerKinds("sale-vn"), null);
    assert.deepEqual([...(visibleCustomerKinds("sourcing") ?? [])].sort(), ["SOURCING", "SOURCING_LOGISTICS"].sort());
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
