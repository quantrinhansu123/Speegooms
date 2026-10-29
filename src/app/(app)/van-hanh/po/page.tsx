import type { Metadata } from "next";
import { PosView } from "@/features/operations/components/pos-view";

export const metadata: Metadata = { title: "Đơn mua xưởng" };

export const instant = false;

export default function PoPage() {
  return <PosView />;
}
