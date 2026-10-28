import type { Metadata } from "next";
import { DocumentsView } from "@/features/operations/components/documents-view";

export const metadata: Metadata = { title: "Chứng từ" };

export const instant = false;

export default function DocumentsPage() {
  return <DocumentsView />;
}
