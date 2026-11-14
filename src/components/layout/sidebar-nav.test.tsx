import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { SessionProvider } from "@/features/auth/session-provider";
import { SidebarNav } from "./sidebar-nav";
import { canAccess, navigationForRole, roleConfig } from "@/config/roles";
import type { Role } from "@/types/role";
import { getBreadcrumbs } from "@/config/navigation";
import { isImplemented } from "@/config/modules";

test("Customer data appears under each sales team's own menu and breadcrumb", () => {
  for (const [role, bases] of [
    ["sale-global", ["/sale-global"]],
    ["sale-vn", ["/sale-viet-nam"]],
    ["sale-intern", ["/sale-viet-nam"]],
    ["admin", ["/sale-viet-nam", "/sale-global"]],
    ["ban-gd", ["/sale-viet-nam", "/sale-global"]],
  ] as const) {
    const items = navigationForRole(role).flatMap((group) => group.items);
    const links = items.flatMap((item) => item.children ?? []).filter((item) => item.title === "Data khách hàng");
    assert.deepEqual(links.map((item) => item.href), bases.map((base) => `${base}/data-lanh`), role);
    for (const base of bases) {
      const href = `${base}/data-lanh`;
      assert.equal(canAccess(role, href), true);
      assert.equal(isImplemented(href), true);
      assert.deepEqual(getBreadcrumbs(href).slice(1).map((crumb) => crumb.href), [base, href]);
    }
  }
  assert.equal(canAccess("sale-global", "/sale-viet-nam/data-lanh"), false);
  assert.equal(canAccess("sale-vn", "/sale-global/data-lanh"), false);
});

test("Only admin sees system and executive menus or opens their restricted pages", () => {
  for (const role of Object.keys(roleConfig) as Role[]) {
    const groups = navigationForRole(role).map((group) => group.label);
    for (const label of ["Hệ thống", "Điều hành"]) assert.equal(groups.includes(label), role === "admin", `${role}: ${label}`);
    for (const path of ["/cai-dat", "/reports", "/demo-guide", "/coa", "/khach-hang-dieu-phoi"]) {
      for (const suffix of ["", "/example"]) assert.equal(canAccess(role, path + suffix), role === "admin", `${role}: ${path + suffix}`);
    }
    assert.equal(canAccess(role, "/dashboard"), true, role);
    assert.equal(canAccess(role, "/tai-khoan"), true, role);
    assert.equal(isImplemented("/tai-khoan"), true);
    assert.equal(getBreadcrumbs("/tai-khoan").at(-1)?.title, "Tài khoản cá nhân");
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

test("Global lead opens every Global page and stays outside admin and VN routes", () => {
  const role = "sale-global-lead";
  for (const page of ["", "/mess", "/tiem-nang", "/rfq", "/hop-dong", "/sale-my", "/data-lanh"]) assert.equal(canAccess(role, "/sale-global" + page), true);
  assert.equal(canAccess(role, "/theo-doi-bao-gia/global/id"), true);
  for (const path of ["/theo-doi-bao-gia/vn/id", "/sale-viet-nam", "/cai-dat", "/reports", "/ke-toan", "/van-hanh"]) assert.equal(canAccess(role, path), false);
});
