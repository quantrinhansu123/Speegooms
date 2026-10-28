import { RouteGate } from "@/components/shared/route-gate";

export default function CoaLayout({ children }: { children: React.ReactNode }) {
  return <RouteGate>{children}</RouteGate>;
}
