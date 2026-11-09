import assert from "node:assert/strict";
import { facebookStatuses, telesaleStatuses } from "@speego/shared";
import { matchesDataLanhStatus } from "./data-lanh-filters";

const rows = [
  { facebookStatus: facebookStatuses[0], telesaleStatus: telesaleStatuses[1] },
  { facebookStatus: facebookStatuses[1], telesaleStatus: telesaleStatuses[0] },
  { facebookStatus: facebookStatuses[2], telesaleStatus: telesaleStatuses[1] },
  { facebookStatus: null, telesaleStatus: null },
];

assert.equal(rows.filter((row) => matchesDataLanhStatus(row, "", "")).length, 4);
assert.deepEqual(rows.filter((row) => matchesDataLanhStatus(row, "facebook", "")), rows.slice(1));
for (const status of facebookStatuses.slice(1)) {
  assert.deepEqual(rows.filter((row) => matchesDataLanhStatus(row, "facebook", status)), rows.filter((row) => row.facebookStatus === status));
}
assert.equal(matchesDataLanhStatus(rows[0], "facebook", facebookStatuses[0]), false);
assert.deepEqual(rows.filter((row) => matchesDataLanhStatus(row, "telesale", "")), [rows[0], rows[2], rows[3]]);
assert.equal(matchesDataLanhStatus(rows[1], "telesale", telesaleStatuses[0]), false);
for (const status of telesaleStatuses.slice(1)) {
  assert.deepEqual(rows.filter((row) => matchesDataLanhStatus(row, "telesale", status)), rows.filter((row) => row.telesaleStatus === status));
}
assert.equal(matchesDataLanhStatus(rows[0], "", facebookStatuses[1]), true);
const transferred = { facebookStatus: facebookStatuses[6], telesaleStatus: telesaleStatuses[4] };
assert.equal(matchesDataLanhStatus(transferred, "facebook", ""), false);
assert.equal(matchesDataLanhStatus(transferred, "facebook", facebookStatuses[6]), false);
assert.equal(matchesDataLanhStatus(transferred, "telesale", ""), true);
assert.equal(matchesDataLanhStatus(transferred, "telesale", telesaleStatuses[4]), true);
assert.equal(matchesDataLanhStatus(transferred, "", ""), true);
for (const telesaleStatus of [null, telesaleStatuses[0]]) {
  assert.equal(matchesDataLanhStatus({ facebookStatus: facebookStatuses[6], telesaleStatus }, "facebook", ""), true);
}
console.log("Data lạnh status filters: passed");
