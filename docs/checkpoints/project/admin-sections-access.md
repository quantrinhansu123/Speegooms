# Admin-only navigation sections

## Reference and scope

- 2026-11-09, based on `b6f8562`; covers System and Executive navigation visibility.
- Source: `src/config/roles.ts` (`canAccess`, `navigationForRole`) and `src/config/navigation.ts`.

## Decision

- Only admin sees the System and Executive menu groups in either navigation layout.
- Settings, Reports, Demo Guide, COA, Coordination and their child routes require admin through the frontend route gate.
- `/dashboard` remains accessible according to existing role modules, although its Executive menu group is hidden for non-admin roles.
- This change controls frontend navigation and route rendering; it does not change server API permissions.
- 2026-11-14, commit `4d910ed`: `/tai-khoan` là trang cá nhân riêng cho mọi vai trò, truy cập từ menu người dùng để đổi mật khẩu. `/cai-dat` vẫn admin-only; quản lý tài khoản và quyền API xem [account-management.md](account-management.md).

## Verification

- `node ../../node_modules/tsx/dist/cli.mjs --test src/components/layout/sidebar-nav.test.tsx`: all four tests passed in the worktree, including every role's menu visibility and restricted list/child routes.
- `git diff --check` passed. No full build was run.
