import type { Metadata } from "next";
import { SuppliersView } from "@/features/operations/components/suppliers-view";

export const metadata: Metadata = { title: "Nguồn hàng-xưởng" };

export const instant = false;

export default function SuppliersPage() {
  return <SuppliersView />;
}
