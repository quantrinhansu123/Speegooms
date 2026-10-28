import type { Metadata } from "next";
import { DashboardView } from "@/features/dashboard/dashboard-view";
import { getDashboardData } from "@/services/dashboard.service";

export const metadata: Metadata = { title: "Tổng quan" };

export default async function DashboardPage() {
  const data = await getDashboardData();
  return <DashboardView data={data} />;
}
