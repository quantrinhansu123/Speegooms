import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const serverRoot = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

// Bundle our TypeScript and shared workspace into ESM JavaScript. Keep installed
// runtime packages external so Node loads their supported package entrypoints.
await build({
  absWorkingDir: serverRoot,
  entryPoints: ["src/vercel-app.ts"],
  outfile: "dist/vercel-app.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
  sourcesContent: false,
  external: Object.keys(manifest.dependencies).filter((name) => name !== "@speego/shared"),
  logLevel: "info",
});
