import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { SessionProvider } from "@/features/auth/session-provider";
import { SidebarNav } from "./sidebar-nav";

for (const role of ["van-hanh", "sourcing"] as const) {
  test(`Sourcing stays expanded on its list and detail pages for ${role}`, () => {
    for (const page of ["don-hang", "nha-cung-cap", "po"]) {
      for (const suffix of ["", "/example"]) {
        const pathname = `/van-hanh/${page}${suffix}`;
        const html = renderToStaticMarkup(
          <PathnameContext.Provider value={pathname}>
            <SessionProvider user={{ id: "test", name: "Test", email: "test@example.com", role, department: "", title: "" }}>
              <SidebarNav />
            </SessionProvider>
          </PathnameContext.Provider>,
        );
        const sourcing = [...html.matchAll(/<button\b[^>]*aria-expanded="(true|false)"[^>]*>([\s\S]*?)<\/button>/g)]
          .find((match) => match[2].includes(">Sourcing</span>"));
        assert.equal(sourcing?.[1], "true", pathname);
        for (const sibling of ["don-hang", "nha-cung-cap", "po"]) {
          assert.ok(html.includes(`href="/van-hanh/${sibling}"`), `Missing ${sibling} on ${pathname}`);
        }
      }
    }
  });
}
