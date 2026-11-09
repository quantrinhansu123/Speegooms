import type { Metadata } from "next";
import { DataLanhView } from "@/features/sales/data-lanh-view";

export const metadata: Metadata = { title: "Data khách hàng" };

export const instant = false;

export default function Page() {
  return <DataLanhView />;
}
