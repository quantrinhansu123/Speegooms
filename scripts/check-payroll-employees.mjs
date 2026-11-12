import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { chromium } from "playwright";

const require = createRequire(new URL("../server/package.json", import.meta.url));
const { build } = require("esbuild");
const root = path.resolve(import.meta.dirname, "..");
const bundle = await build({
  stdin: {
    contents: `import { createRoot } from "react-dom/client";
      import { SessionProvider } from "./src/features/auth/session-provider";
      import { PayrollLiveView } from "./src/features/accounting/live/payroll-live-view";
      createRoot(document.getElementById("root")).render(
        <SessionProvider user={{ role: "ke-toan" }}><PayrollLiveView /></SessionProvider>);`,
    resolveDir: root, loader: "tsx",
  },
  tsconfig: path.join(root, "tsconfig.json"),
  bundle: true, write: false, platform: "browser", jsx: "automatic",
  define: { "process.env": JSON.stringify({ NODE_ENV: "test" }) },
});
const browser = await chromium.launch({ channel: "msedge" });
try {
  const page = await browser.newPage();
  page.on("pageerror", (error) => console.error(error));
  const employees = [
    { code: "NV01", name: "Nguyễn An", department: "ke-toan", position: "Kế toán viên" },
    { code: "NV02", name: "Trần Bình", department: "hcns", position: "" },
  ];
  let mode = "ok";
  let submitted;
  await page.route("http://payroll.test/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/") return route.fulfill({ contentType: "text/html", body: '<div id="root"></div><script src="/app.js"></script>' });
    if (pathname === "/app.js") return route.fulfill({ contentType: "text/javascript", body: bundle.outputFiles[0].text });
    if (pathname.endsWith("/payroll-employees")) {
      return route.fulfill({ json: mode === "error" ? { error: { message: "Lỗi tải nhân viên" } } : { employees: mode === "empty" ? [] : employees }, status: mode === "error" ? 503 : 200 });
    }
    if (pathname.endsWith("/csrf")) return route.fulfill({ json: { token: "test" } });
    if (request.method() === "POST") {
      submitted = request.postDataJSON();
      return route.fulfill({ json: { payroll: { ...submitted, id: "1", code: "L01" } } });
    }
    return route.fulfill({ json: { payroll: [], expenses: [] } });
  });
  const open = async () => {
    await page.goto("http://payroll.test/");
    await page.getByRole("button", { name: "Nhập mới", exact: true }).click();
    await page.locator("#pr-employee:not(:disabled)").waitFor();
  };
  const save = () => page.getByRole("dialog").getByRole("button", { name: "Nhập mới", exact: true });
  await open();
  assert.equal(await save().isDisabled(), true);
  for (const employee of employees) {
    await page.selectOption("#pr-employee", employee.code);
    assert.equal(await page.inputValue("#pr-code"), employee.code);
    assert.equal(await page.inputValue("#pr-name"), employee.name);
    assert.equal(await page.inputValue("#pr-dept"), employee.department === "ke-toan" ? "Kế toán" : "HCNS");
    assert.equal(await page.inputValue("#pr-position"), employee.position);
  }
  await page.selectOption("#pr-employee", "");
  for (const id of ["pr-code", "pr-name", "pr-dept", "pr-position"]) assert.equal(await page.inputValue(`#${id}`), "");
  assert.equal(await save().isDisabled(), true);
  await page.selectOption("#pr-employee", "NV02");
  await page.fill("#pr-base", "10000000");
  await save().press("Enter");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(submitted.employeeCode, "NV02");
  assert.equal(submitted.fullName, "Trần Bình");
  assert.equal(submitted.department, "hcns");
  assert.equal(submitted.position, undefined);
  assert.equal(submitted.baseSalary, 10000000);
  mode = "empty";
  await open();
  assert.equal(await page.locator("#pr-employee").textContent(), "Chưa có nhân viên");
  assert.equal(await save().isDisabled(), true);
  mode = "error";
  await open();
  await page.getByRole("alert").filter({ hasText: "Lỗi tải nhân viên" }).waitFor();
  assert.equal(await save().isDisabled(), true);
  console.log("PASS: employee selection, switching, clearing, submit, empty list and load failure");
} finally {
  await browser.close();
}
