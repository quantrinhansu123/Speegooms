import type { Metadata } from "next";
import { RoleDashboard } from "@/features/dashboard/role-dashboard";

export const metadata: Metadata = { title: "Tổng quan" };

export default function DashboardPage() {
  return <RoleDashboard />;
}
