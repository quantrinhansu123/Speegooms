import type { Role } from "./user";

export interface CrmHandler {
  handlerId?: string | null;
  handlerName?: string | null;
}

export function canHandleCrm(user: { id: string; role: Role }, record: CrmHandler): boolean {
  return !record.handlerId || record.handlerId === user.id || ["admin", "van-hanh", "sourcing", "logistics"].includes(user.role);
}

export interface CrmActivity {
  id: string;
  actorName: string;
  action: "create" | "update" | "handover" | "delete";
  entity: "message" | "potential" | "quote";
  previousHandlerName: string | null;
  handlerName: string | null;
  createdAt: string;
}
