import type { Metadata } from "next";
import { CoordinationView } from "@/features/coordination/coordination-view";

export const metadata: Metadata = { title: "Khách hàng & Điều phối" };

export const instant = false;

export default function Page() {
  return <CoordinationView />;
}
