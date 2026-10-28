import type { Metadata } from "next";
import { LeadsView } from "@/features/crm/components/leads-view";

export const metadata: Metadata = { title: "Lead" };

export default function LeadsPage() {
  return <LeadsView />;
}
