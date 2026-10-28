import { createLocalRepository } from "@/services/repository-factory";
import type { FulfillmentSnapshot } from "@/types/fulfillment";

export const localFulfillmentRepository = createLocalRepository<FulfillmentSnapshot>("speego_fulfillment_demo_v1", async () => {
  const [warehouses, receipts, packages, outbounds, deliveries, inquiries] = await Promise.all([
    import("@/mocks/fulfillment/warehouses.json"),
    import("@/mocks/fulfillment/receipts.json"),
    import("@/mocks/fulfillment/packages.json"),
    import("@/mocks/fulfillment/outbounds.json"),
    import("@/mocks/fulfillment/deliveries.json"),
    import("@/mocks/fulfillment/inquiries.json"),
  ]);
  return {
    warehouses: warehouses.default,
    receipts: receipts.default,
    packages: packages.default,
    outbounds: outbounds.default,
    deliveries: deliveries.default,
    inquiries: inquiries.default,
  };
});
