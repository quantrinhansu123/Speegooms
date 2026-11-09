import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { SessionProvider } from "@/features/auth/session-provider";
import { SidebarNav } from "./sidebar-nav";
import { canAccess, navigationForRole, roleConfig } from "@/config/roles";
import type { Role } from "@/types/role";

test("Only admin sees system and executive menus or opens their restricted pages", () => {
  for (const role of Object.keys(roleConfig) as Role[]) {
    const groups = navigationForRole(role).map((group) => group.label);
    for (const label of ["Hệ thống", "Điều hành"]) assert.equal(groups.includes(label), role === "admin", `${role}: ${label}`);
    for (const path of ["/cai-dat", "/reports", "/demo-guide", "/coa", "/khach-hang-dieu-phoi"]) {
      for (const suffix of ["", "/example"]) assert.equal(canAccess(role, path + suffix), role === "admin", `${role}: ${path + suffix}`);
    }
    assert.equal(canAccess(role, "/dashboard"), true, role);
  }
});

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

test("Horizontal navigation keeps the same role-filtered entries and marks active Sourcing", () => {
  for (const role of Object.keys(roleConfig) as Role[]) {
    const html = renderToStaticMarkup(
      <PathnameContext.Provider value="/van-hanh/po/example">
        <SessionProvider user={{ id: "test", name: "Test", email: "test@example.com", role, department: "", title: "" }}>
          <SidebarNav horizontal />
        </SessionProvider>
      </PathnameContext.Provider>,
    );
    const entries = [...html.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g)];
    const expected = navigationForRole(role).flatMap((group) => group.items);
    assert.equal(entries.length, expected.length, role);
    expected.forEach((item, index) => {
      const [, element, attributes, content] = entries[index];
      assert.ok(content.includes(item.title.replaceAll("&", "&amp;")), `${role}: ${item.title}`);
      assert.equal(element, item.children ? "button" : "a");
      if (item.children) assert.ok(attributes.includes('aria-haspopup="menu"'));
      else assert.ok(attributes.includes(`href="${item.href}"`));
      if (item.title === "Sourcing" && item.children?.some((child) => child.href === "/van-hanh/po")) {
        assert.ok(attributes.includes("bg-sidebar-accent"), role);
      }
    });
  }
});
