"use client";

import { canViewSalesReport, manageableTargetDepartments } from "@speego/shared";
import { useSession } from "@/features/auth/session-provider";
import { TargetsView } from "./targets-view";

export function TargetsPage() {
  const user = useSession();
  return <TargetsView departments={manageableTargetDepartments(user.role)} showReportLink={canViewSalesReport(user.role)} />;
}
