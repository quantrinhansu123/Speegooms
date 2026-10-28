import { FulfillmentShell } from "@/features/fulfillment/fulfillment-shell";

export default function FulfillmentLayout({ children }: { children: React.ReactNode }) {
  return <FulfillmentShell>{children}</FulfillmentShell>;
}
