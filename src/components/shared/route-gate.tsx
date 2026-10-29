"use client";

import { usePathname } from "next/navigation";
import { useSession } from "@/features/auth/session-provider";
import { canAccess } from "@/config/roles";
import { Forbidden } from "./forbidden";

/** Chặn điều hướng FE đồng nhất; không thay thế authorization của API. */
export function RouteGate({ children }: { children: React.ReactNode }) {
  const user = useSession();
  const pathname = usePathname() ?? "";
  return canAccess(user.role, pathname) ? children : <Forbidden />;
}
