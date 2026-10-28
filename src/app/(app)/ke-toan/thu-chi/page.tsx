import type { Metadata } from "next";
import { LedgerView } from "@/features/accounting/components/ledger-view";

export const metadata: Metadata = { title: "Thu chi và đối soát" };

export default function LedgerPage() {
  return <LedgerView />;
}
