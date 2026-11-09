# Sourcing and Logistics access

## Scope and keywords

Read when changing Sourcing, Operations, Logistics navigation or route permissions.

## Reference

- Checked 2026-11-09 against baseline `34d2fae`; current implementation is in this task's worktree.
- `git diff --check`, frontend typecheck (`pnpm typecheck`), and API typecheck (`pnpm typecheck:api`) passed.
- A temporary assert check passed for both roles' list/detail access, Operations Logistics access, Sourcing's server contract permissions, and the four Sourcing menu entries. No full build or test suite was run.

## Decision

- The Sourcing menu owns sourcing quotes, contracts/orders, suppliers, and purchase orders.
- Sourcing and Vận hành both retain route access to contracts/orders, suppliers, and POs. Sourcing also has the `ops.write` and `price.return` actions needed by those screens.
- The Vận hành role keeps access to Logistics routes through its `/van-hanh` module prefix. The separate Logistics role keeps its existing quote-desk scope.
- Route and action permissions in `src/config` are frontend demo controls; real authorization must also be enforced by the backend.
- The CRM contracts screen also uses server permissions `contract.read`, `contract.ops`, and `contract.resend`; Sourcing is included in those permissions.

## Source paths

- Navigation: `src/config/navigation.ts`
- Role routes: `src/config/roles.ts`
- Actions: `src/config/permissions.ts`
- CRM server permissions: `server/src/config/permissions.ts`
- CRM contract view and resend target checks: `server/src/controllers/crm.controller.ts` (`contractView`, `resendTarget`)
- Contracts screen role gate: `src/features/crm/live/contracts-live-view.tsx` (`opsRoles`)
- Quote desk scope: `shared/src/quote-access.ts` (`deskPolicy`)
