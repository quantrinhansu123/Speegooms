import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { NextRequest } from "next/server.js";

const filename = fileURLToPath(new URL("../src/proxy.ts", import.meta.url));
const loaded = new Module(filename);
loaded.paths = Module._nodeModulePaths(fileURLToPath(new URL("../src", import.meta.url)));
loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const { proxy } = loaded.exports;

for (const cookie of ["", "speego_session=expired", "__Host-speego_session=expired"]) {
  const response = proxy(new NextRequest("http://localhost:3000/login", {
    headers: { cookie },
  }));
  assert.equal(response.headers.get("location"), null, "Login must remain reachable with stale cookies");
  assert.equal(response.headers.get("x-middleware-next"), "1");
}
const protectedResponse = proxy(new NextRequest("http://localhost:3000/dashboard"));
assert.equal(protectedResponse.headers.get("location"), "http://localhost:3000/login");
assert.equal(protectedResponse.status, 307);
console.log("Auth routing checks passed");
