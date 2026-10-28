import type { Metadata } from "next";
import { PickPackView } from "@/features/fulfillment/components/pickpack-view";

export const metadata: Metadata = { title: "Pick / Pack" };

export default function PickPackPage() {
  return <PickPackView />;
}
