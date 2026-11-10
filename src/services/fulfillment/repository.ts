import { createLocalRepository } from "@/services/repository-factory";
import type { FulfillmentSnapshot } from "@/types/fulfillment";

/** Không còn dữ liệu demo (src/mocks/fulfillment chỉ còn làm dữ liệu cho bộ check). */
export const localFulfillmentRepository = createLocalRepository<FulfillmentSnapshot>("speego_fulfillment_demo_v2", async () => ({
  warehouses: [],
  receipts: [],
  packages: [],
  outbounds: [],
  deliveries: [],
  inquiries: [],
}));
