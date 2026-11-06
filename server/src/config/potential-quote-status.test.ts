import assert from "node:assert/strict";
import test from "node:test";
import type pg from "pg";
import { quoteOrderSchema, updatePotentialSchema, type CrmLane } from "@speego/shared";
import { PostgresCrmRepository } from "../adapters/postgres/crm.repository";

test("potential list includes the latest quote status from each desk", async () => {
  const queries: string[] = [];
  const pool = {
    query: async (sql: string) => {
      queries.push(sql);
      if (sql.includes("select distinct on (potential_id, desk)")) return { rows: [
        { potential_id: "lead-1", desk: "sourcing", status: "DA_CO_BAO_GIA" },
        { potential_id: "lead-1", desk: "logistics", status: "CHUA_CO_BAO_GIA_LAI" },
      ] };
      return { rows: [{ id: "lead-1", lead_code: "TN-1", potential: "POTENTIAL", status: "NEW", created_at: "2026-11-05T00:00:00Z" }] };
    },
  } as unknown as pg.Pool;
  const repository = new PostgresCrmRepository(pool);
  const rows = await repository.listPotentials("vn", { q: "", from: "", to: "", source: "", potential: "", customerKind: "", customerType: "" });
  assert.equal(queries.length, 2);
  assert.equal(rows[0]?.sourcingQuoteStatus, "DA_CO_BAO_GIA");
  assert.equal(rows[0]?.logisticsQuoteStatus, "CHUA_CO_BAO_GIA_LAI");
});

const packageSpec = { count: 2, lengthCm: 40, widthCm: 30, heightCm: 20, actualKg: 12.5 };
const order = quoteOrderSchema.parse({
  id: "00000000-0000-4000-8000-000000000001", name: "Sale order", selected: true, currency: "VND", rate: null,
  lines: [{ stt: "1", quantity: 5, pricePerSet: null, lineTotal: null, weightKg: 999, spec: "", note: "", packages: [packageSpec] }],
});

async function potentialWith(patch: Record<string, unknown>, lane: CrmLane = "vn") {
  const pool = {
    query: async (sql: string) => {
      if (sql.includes("select distinct on (potential_id, desk)")) return { rows: [] };
      const suffix = lane === "vn" ? "viet_nam" : "global";
      assert.ok(sql.includes(`left join crm.bao_gia_logistics_${suffix}`));
      assert.ok(sql.includes(`left join crm.bao_gia_sourcing_${suffix}`));
      return { rows: [{ id: "lead-1", created_at: "2026-11-05T00:00:00Z", package_dimensions: null, weight_kg: null, ...patch }] };
    },
  } as unknown as pg.Pool;
  const rows = await new PostgresCrmRepository(pool).listPotentials(lane, { q: "", from: "", to: "", source: "", potential: "", customerKind: "", customerType: "" });
  return rows[0]!;
}

test("potential uses saved order dimensions and actual package weight in both lanes", async () => {
  for (const lane of ["vn", "global"] as const) {
    const selected = { ...order, lines: [
      order.lines[0],
      { ...order.lines[0], packages: [{ ...packageSpec, count: 3, actualKg: 4 }] },
    ] };
    const alternative = { ...order, selected: false, lines: [{ ...order.lines[0], packages: [{ ...packageSpec, actualKg: 100 }] }] };
    const row = await potentialWith({ order_lines: [alternative, selected] }, lane);
    assert.equal(row.packageDimensions, "40 × 30 × 20 cm");
    assert.equal(row.weightKg, "37 kg");
    assert.equal("order_lines" in row, false);
  }
});

test("potential uses the mess draft until an order is saved, but skips the draft for FCL", async () => {
  const row = await potentialWith({ order_info: order, order_lines: [] });
  assert.equal(row.packageDimensions, "40 × 30 × 20 cm");
  assert.equal(row.weightKg, "25 kg");
  const fcl = await potentialWith({ order_info: order, logistics_class: "FCL" });
  assert.equal(fcl.packageDimensions, null);
  assert.equal(fcl.weightKg, null);
});

test("saved order takes precedence over the mess draft without overwriting manual profile details", async () => {
  const saved = { ...order, lines: [{ ...order.lines[0], packages: [{ ...packageSpec, lengthCm: 60, actualKg: 5 }] }] };
  const row = await potentialWith({ order_info: order, order_lines: [saved] });
  assert.equal(row.packageDimensions, "60 × 30 × 20 cm");
  assert.equal(row.weightKg, "10 kg");
  const manual = await potentialWith({ order_lines: [saved], package_dimensions: "Khoảng 1 m", weight_kg: "20 kg/kiện" });
  assert.equal(manual.packageDimensions, "Khoảng 1 m");
  assert.equal(manual.weightKg, "20 kg/kiện");
});

test("empty or incomplete packaging does not invent dimensions or use chargeable weight", async () => {
  for (const packages of [[], [{ ...packageSpec, heightCm: 0, actualKg: 0 }]]) {
    const row = await potentialWith({ order_lines: [{ ...order, lines: [{ ...order.lines[0], packages }] }] });
    assert.equal(row.packageDimensions, null);
    assert.equal(row.weightKg, null);
  }
  const invalid = await potentialWith({ order_info: { broken: true }, order_lines: null });
  assert.equal(invalid.packageDimensions, null);
  assert.equal(invalid.weightKg, null);
});

test("profile accepts empty company/email and distinguishes unchanged metrics from explicit clearing", async () => {
  const input = updatePotentialSchema.parse({ fullName: "Sale customer", companyName: "", email: "", phone: "0900000000", productInterest: "", quantityNote: "", address: "", saleNote: "", potential: "POTENTIAL" });
  const parameters: unknown[][] = [];
  const pool = { query: async (_sql: string, values: unknown[]) => {
    parameters.push(values);
    return { rows: [] };
  } } as unknown as pg.Pool;
  const repository = new PostgresCrmRepository(pool);
  await repository.updatePotential("vn", "lead-1", input);
  await repository.updatePotential("vn", "lead-1", { ...input, packageDimensions: "", weightKg: "" });
  assert.equal(parameters[0]?.[16], null);
  assert.equal(parameters[0]?.[23], null);
  assert.equal(parameters[1]?.[16], "");
  assert.equal(parameters[1]?.[23], "");
});
