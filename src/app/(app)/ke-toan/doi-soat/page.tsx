import type { Metadata } from "next";
import { DepositsView } from "@/features/accounting/components/deposits-view";

export const metadata: Metadata = { title: "Cọc cần đối soát" };

export default function DepositsPage() {
  return <DepositsView />;
}
