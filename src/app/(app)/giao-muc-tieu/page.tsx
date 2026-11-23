import type { Metadata } from "next";
import { TargetsPage } from "@/features/targets/targets-page";

export const metadata: Metadata = { title: "Giao mục tiêu" };

export default function Page() {
  return <TargetsPage />;
}
