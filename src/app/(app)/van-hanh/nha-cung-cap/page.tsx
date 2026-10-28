import type { Metadata } from "next";
import { SuppliersView } from "@/features/operations/components/suppliers-view";

export const metadata: Metadata = { title: "Nhà cung cấp" };

export default function SuppliersPage() {
  return <SuppliersView />;
}
