import type { Role } from "@speego/shared";

export const permissions = {
  "user.role.assign": ["admin"],
  "message.read": ["admin", "ban-gd", "marketing", "sale-vn", "sale-global"],
  "message.write": ["admin", "marketing", "sale-vn", "sale-global"],
  "message.convert": ["admin", "sale-vn", "sale-global"],
  "potential.read": ["admin", "ban-gd", "sale-vn", "sale-global"],
  "potential.write": ["admin", "sale-vn", "sale-global"],
  "quote.read": ["admin", "ban-gd", "van-hanh"],
  "quote.rfq": ["admin", "ban-gd", "sale-vn", "sale-global"],
  "quote.request": ["admin", "sale-vn", "sale-global"],
  "quote.logistics": ["admin", "van-hanh"],
  "quote.ops": ["admin", "van-hanh"],
  "quote.return": ["admin", "sale-vn", "sale-global"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof permissions;

export function can(role: Role, action: Permission): boolean {
  return (permissions[action] as readonly Role[]).includes(role);
}
