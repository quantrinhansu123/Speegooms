import type { Metadata } from "next";
import { MessView } from "@/features/crm/live/mess-view";

export const metadata: Metadata = { title: "Mess" };

export const instant = false;

export default function Page() {
  return <MessView />;
}
