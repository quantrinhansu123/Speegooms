import type { Metadata } from "next";
import { LeadsView } from "@/features/crm/components/leads-view";

export const metadata: Metadata = { title: "Lead" };

export const instant = false;

export default function LeadsPage() {
  return <LeadsView />;
}
