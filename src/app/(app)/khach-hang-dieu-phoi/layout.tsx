import { RouteGate } from "@/components/shared/route-gate";

export default function CoordinationLayout({ children }: { children: React.ReactNode }) {
  return <RouteGate>{children}</RouteGate>;
}
