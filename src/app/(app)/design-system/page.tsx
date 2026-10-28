import type { Metadata } from "next";
import { Forbidden } from "@/components/shared/forbidden";
import { canAccess } from "@/config/roles";
import { DesignSystemDemo } from "@/features/design-system/design-system-demo";
import { getSession } from "@/lib/session";
import { getDemoData } from "@/services/demo.service";

export const metadata: Metadata = { title: "Design System" };

export default async function DesignSystemPage() {
  const user = await getSession();
  if (!user || !canAccess(user.role, "/design-system")) return <Forbidden />;
  const data = await getDemoData();
  return <DesignSystemDemo {...data} />;
}
