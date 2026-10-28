"use client";

import { usePathname } from "next/navigation";
import { ErrorState } from "@/components/shared/error-state";
import { Forbidden } from "@/components/shared/forbidden";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { canAccess } from "@/config/roles";
import { useBackoffice } from "./hooks";

export function ModuleShell({ children }: { children: React.ReactNode }) {
  const { error, ready, user } = useBackoffice();
  const pathname = usePathname();
  if (!canAccess(user.role, pathname)) return <Forbidden />;
  if (error) return <ErrorState message={error} />;
  return <>
    {!ready && <TableSkeleton rows={6} columns={5} />}
    <div hidden={!ready}>{children}</div>
  </>;
}
