import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Exercise the filters passed to the real list, including both desks of a combined RFQ.
const source = ts.createSourceFile("rfq-quotes-view.tsx", readFileSync(new URL("../src/features/crm/live/rfq-quotes-view.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let expression;
function visit(node) {
  if (ts.isJsxAttribute(node) && node.name.getText(source) === "filters") {
    expression = node.initializer.expression.getText(source);
  }
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(expression, "RFQ list must expose filters");
const script = ts.transpileModule(`const filters = ${expression}; filters;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const filters = vm.runInNewContext(script, {
  quoteStatusOptions: [], customerKindOptions: [], deskLabels: {},
});
const match = (id, row, value) => filters.find((filter) => filter.id === id).match(row, value);
const combined = { desk: "sourcing", customerKind: "SOURCING_LOGISTICS", quoteStatus: "DA_CO_BAO_GIA", logisticsSheet: { quoteStatus: "CHUA_CO_BAO_GIA_LAI" } };
assert.equal(match("desk", combined, "sourcing"), true);
assert.equal(match("desk", combined, "logistics"), true);
assert.equal(match("quoteStatus", combined, "DA_CO_BAO_GIA"), true);
assert.equal(match("quoteStatus", combined, "CHUA_CO_BAO_GIA_LAI"), true);
assert.equal(match("quoteStatus", combined, "CHUA_CO_BAO_GIA"), false);
const sourcing = { ...combined, customerKind: "SOURCING", logisticsSheet: null };
assert.equal(match("desk", sourcing, "logistics"), false);
assert.equal(match("quoteStatus", sourcing, "CHUA_CO_BAO_GIA_LAI"), false);
assert.equal(match("customerKind", sourcing, "SOURCING"), true);
console.log("PASS: RFQ filters cover single and combined desks, including returned quotes.");
