import type { Metadata } from "next";
import { CustomersView } from "@/features/crm/components/customers-view";

export const metadata: Metadata = { title: "Khách hàng" };

export const instant = false;

export default function CustomersPage() {
  return <CustomersView />;
}
