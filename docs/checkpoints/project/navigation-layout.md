# Navigation layout

- Scope: desktop sidebar toggle, horizontal navigation, mobile menu.
- Reference: 2026-11-09, based on `4608443`; implementation on `feat/horizontal-navigation`.
- `AppShell` owns the desktop layout toggle. Horizontal mode removes the sidebar and its 256px content offset; mobile keeps the existing Sheet navigation. The choice lasts while AppShell is mounted and resets on reload.
- Both layouts use `SidebarNav` and `navigationForRole`; keep permission filtering and child-route active detection shared. Horizontal child menus use the existing DropdownMenu for keyboard navigation, Escape and outside-click dismissal. Top-level entries wrap, and the bar scrolls vertically beyond 30dvh.
- Sources: `src/components/layout/app-shell.tsx`, `header.tsx`, `sidebar-nav.tsx`, `sidebar-nav.test.tsx`.
- Verification: all three sidebar tests passed, including role-filtered horizontal entries for every role and Sourcing detail highlighting. Frontend typecheck and targeted ESLint passed. Browser interaction and visual layout have not been checked.
