# Navigation layout

## Current behavior — 2026-11-14

- Supersedes the horizontal toggle described below: on `feat/crm-pancake-filters` (base `80e21f9`, source `75d4e0e`), AppShell toggles a full 256px left sidebar and an 80px icon sidebar. Content padding follows the selected width. Default is icons; reload resets the choice.
- Header exposes descriptive labels and aria-expanded/aria-controls. Both states use Sidebar/SidebarNav and existing permissions; mobile keeps the full Sheet menu. Sources: `app-shell.tsx`, `header.tsx`, `sidebar.tsx`, `sidebar-nav.tsx` under `src/components/layout`.
- Validation: TypeScript and targeted ESLint; authenticated browser checks on Mess/Contracts passed for SSR attributes and both sidebar states without hydration errors. Browser tests and TypeScript rerun passed before merge.

- Browser self-check: `node --test src/components/layout/app-shell.test.mjs` passed (icon → full → icon, content offset, accessible toggle state).
- Local hydration incident: supplied diff showed server HTML from the previous sidebar implementation (missing desktop-sidebar id and old horizontal-toggle label), while client used the new compact toggle. Restarted preview and renamed only its .next/dev cache to dev-before-restart-*; no source workaround. Authenticated Edge check on Mess and Contracts confirmed raw SSR contains new id/label, no old label, both toggle states work, and no hydration console errors.

## Previous behavior

- Scope: desktop sidebar toggle, horizontal navigation, mobile menu.
- Reference: 2026-11-09, based on `4608443`; implementation on `feat/horizontal-navigation`.
- `AppShell` owns the desktop layout toggle. Horizontal mode removes the sidebar and its 256px content offset; mobile keeps the existing Sheet navigation. The choice lasts while AppShell is mounted and resets on reload.
- Both layouts use `SidebarNav` and `navigationForRole`; keep permission filtering and child-route active detection shared. Horizontal child menus use the existing DropdownMenu for keyboard navigation, Escape and outside-click dismissal. Top-level entries wrap, and the bar scrolls vertically beyond 30dvh.
- Sources: `src/components/layout/app-shell.tsx`, `header.tsx`, `sidebar-nav.tsx`, `sidebar-nav.test.tsx`.
- Verification: all three sidebar tests passed, including role-filtered horizontal entries for every role and Sourcing detail highlighting. Frontend typecheck and targeted ESLint passed. Browser interaction and visual layout have not been checked.
