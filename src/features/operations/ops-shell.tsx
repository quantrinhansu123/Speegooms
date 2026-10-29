"use client";

import { usePathname } from "next/navigation";
import { ErrorState } from "@/components/shared/error-state";
import { Forbidden } from "@/components/shared/forbidden";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { canAccess } from "@/config/roles";
import { useOps } from "./hooks";

export function OpsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { error, ready, user } = useOps();

  if (!canAccess(user.role, pathname)) return <Forbidden />;
  if (error) return <ErrorState message={error} />;

  return ready ? children : <TableSkeleton rows={8} columns={5} />;
}
