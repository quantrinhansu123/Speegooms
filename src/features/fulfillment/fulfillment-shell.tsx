"use client";

import { usePathname } from "next/navigation";
import { ErrorState } from "@/components/shared/error-state";
import { Forbidden } from "@/components/shared/forbidden";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { canAccess } from "@/config/roles";
import { useFulfillment } from "./hooks";

export function FulfillmentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { error, ready, user } = useFulfillment();

  if (!canAccess(user.role, pathname)) return <Forbidden />;
  if (error) return <ErrorState message={error} />;

  return ready ? children : <TableSkeleton rows={8} columns={5} />;
}
