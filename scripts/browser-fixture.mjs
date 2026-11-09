import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(new URL("../server/package.json", import.meta.url));
const { build } = require("esbuild");

export async function bundleFixture(contents) {
  const result = await build({ absWorkingDir: process.cwd(), tsconfigRaw: { compilerOptions: { jsx: "react-jsx" } }, stdin: { contents, resolveDir: process.cwd(), loader: "tsx" }, bundle: true, write: false, format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"', "process.env": "{}", process: '{"env":{},"browser":true}' },
    // Resolve through Node so the native bundler need not enumerate restricted parent directories on Windows.
    plugins: [{ name: "node-resolution", setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => {
        const localRequire = createRequire(path.isAbsolute(args.importer) ? args.importer : path.join(process.cwd(), "package.json"));
        if (args.path === "fflate") return { path: localRequire.resolve("fflate/browser"), namespace: "node-source" };
        if (args.path === "jspdf" || args.path === "exceljs") {
          const manifest = localRequire.resolve(`${args.path}/package.json`);
          return { path: path.resolve(path.dirname(manifest), localRequire(manifest).browser), namespace: "node-source" };
        }
        const specifier = args.path.startsWith("@/") ? path.join(process.cwd(), "src", args.path.slice(2)) : args.path;
        let resolved;
        for (const suffix of ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]) {
          try { resolved = localRequire.resolve(specifier + suffix); break; } catch { /* Try the next TypeScript extension. */ }
        }
        if (!resolved) throw new Error(`Cannot resolve ${args.path} from ${args.importer}`);
        return { path: resolved, namespace: "node-source" };
      });
      builder.onLoad({ filter: /.*/, namespace: "node-source" }, async args => ({ contents: await readFile(args.path, "utf8"), loader: args.path.endsWith(".tsx") ? "tsx" : args.path.endsWith(".ts") ? "ts" : args.path.endsWith(".json") ? "json" : "js", resolveDir: path.dirname(args.path) }));
    } }],
  });
  return result.outputFiles[0].text;
}
