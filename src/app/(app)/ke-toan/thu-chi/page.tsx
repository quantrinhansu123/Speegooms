import type { Metadata } from "next";
import { LedgerLiveView } from "@/features/accounting/live/ledger-live-view";

export const metadata: Metadata = { title: "Thu chi và đối soát" };

export const instant = false;

export default function LedgerPage() {
  return <LedgerLiveView />;
}
