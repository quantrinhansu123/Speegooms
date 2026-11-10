# Sourcing and Logistics access

## Scope and keywords

Read when changing Sourcing, Operations, Logistics navigation or route permissions.

## Reference

- Checked 2026-11-09 against baseline `34d2fae`; current implementation is in this task's worktree.
- `git diff --check`, frontend typecheck (`pnpm typecheck`), and API typecheck (`pnpm typecheck:api`) passed.
- A temporary assert check passed for both roles' list/detail access, Operations Logistics access, Sourcing's server contract permissions, and the four Sourcing menu entries. No full build or test suite was run.
- Sidebar expansion regression checks passed with `pnpm exec tsx --test src/components/layout/sidebar-nav.test.tsx`: both roles retain the Sourcing menu on all three list and detail routes. Frontend typecheck passed for this fix, based on `ad44857`.

## Decision

- The Sourcing menu owns sourcing quotes, contracts/orders, suppliers, and purchase orders.
- Sidebar groups determine their active/open state from their child routes, since Sourcing children do not share the parent item's URL prefix.
- Sourcing and Vận hành both retain route access to contracts/orders, suppliers, and POs. Sourcing also has the `ops.write` and `price.return` actions needed by those screens.
- The Vận hành role keeps access to Logistics routes through its `/van-hanh` module prefix. The separate Logistics role keeps its existing quote-desk scope.
- Route and action permissions in `src/config` are frontend demo controls; real authorization must also be enforced by the backend.
- Quote ownership is now additionally enforced for individual Sourcing/Logistics roles by request identity and `crm.chia_don`; see [quote assignment and notifications](../crm/quote-request-notifications.md). This affects quote desks/tracking/direct writes; contract/order routes retain their separate policy.
- The CRM contracts screen also uses server permissions `contract.read`, `contract.ops`, and `contract.resend`; Sourcing is included in those permissions.

## Source paths

- Navigation: `src/config/navigation.ts`
- Sidebar expansion: `src/components/layout/sidebar-nav.tsx`; regression coverage: `src/components/layout/sidebar-nav.test.tsx`
- Role routes: `src/config/roles.ts`
- Actions: `src/config/permissions.ts`
- CRM server permissions: `server/src/config/permissions.ts`
- CRM contract view and resend target checks: `server/src/controllers/crm.controller.ts` (`contractView`, `resendTarget`)
- Contracts screen role gate: `src/features/crm/live/contracts-live-view.tsx` (`opsRoles`)
- Quote desk scope: `shared/src/quote-access.ts` (`deskPolicy`)
