import type { Metadata } from "next";
import { CoaView } from "@/features/coa/coa-view";

export const metadata: Metadata = { title: "COA – Hệ thống & chỉ số" };

export const instant = false;

export default function Page() {
  return <CoaView />;
}
