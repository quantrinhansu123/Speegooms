import { camelizeKeys, snakeizeKeys } from "@/services/crm/adapters";
import type { OpsSnapshot, OpsSnapshotDto } from "@/types/ops";

/**
 * Cổng dữ liệu Vận hành, cùng cách làm với CRM: seed JSON (src/mocks/ops) + localStorage của trình duyệt.
 * Dữ liệu chỉ nằm trong trình duyệt này. Khi có backend, viết repository gọi API (nhận/gửi DTO) và thay ở store.
 */
export interface OpsRepository {
  load(): Promise<OpsSnapshot>;
  save(snapshot: OpsSnapshot): Promise<void>;
  reset(): Promise<OpsSnapshot>;
}

const STORAGE_KEY = "speego_ops_demo_v3";

async function loadSeed(): Promise<OpsSnapshot> {
  const [staff, suppliers, partners, requests, quotes, pos, orders, shipments, events, documents, history] = await Promise.all([
    import("@/mocks/ops/staff.json"),
    import("@/mocks/ops/suppliers.json"),
    import("@/mocks/ops/partners.json"),
    import("@/mocks/ops/requests.json"),
    import("@/mocks/ops/supplier-quotes.json"),
    import("@/mocks/ops/pos.json"),
    import("@/mocks/ops/orders.json"),
    import("@/mocks/ops/shipments.json"),
    import("@/mocks/ops/tracking-events.json"),
    import("@/mocks/ops/documents.json"),
    import("@/mocks/ops/history.json"),
  ]);
  const dto = {
    staff: staff.default,
    suppliers: suppliers.default,
    partners: partners.default,
    requests: requests.default,
    supplier_quotes: quotes.default,
    pos: pos.default,
    orders: orders.default,
    shipments: shipments.default,
    tracking_events: events.default,
    documents: documents.default,
    history: history.default,
  };
  return camelizeKeys<OpsSnapshot>(dto);
}

export const localOpsRepository: OpsRepository = {
  async load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) return camelizeKeys<OpsSnapshot>(JSON.parse(raw) as OpsSnapshotDto);
    } catch {
      // localStorage bị chặn hoặc dữ liệu hỏng: dùng seed
    }
    return loadSeed();
  },
  async save(snapshot) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snakeizeKeys<OpsSnapshotDto>(snapshot)));
    } catch {
      // đầy dung lượng/bị chặn: bỏ qua
    }
  },
  async reset() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // bỏ qua
    }
    return loadSeed();
  },
};
