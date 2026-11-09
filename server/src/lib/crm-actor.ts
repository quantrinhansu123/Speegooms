import { AsyncLocalStorage } from "node:async_hooks";
import type { PublicUser } from "@speego/shared";

/** Request identity for database authorization and immutable CRM activity records. */
export const crmActor = new AsyncLocalStorage<PublicUser>();
