import { camelizeKeys, snakeizeKeys } from "@/services/crm/adapters";
import type { OpsSnapshot, OpsSnapshotDto } from "@/types/ops";

/**
 * Cổng dữ liệu Vận hành, cùng cách làm với CRM: seed rỗng + localStorage của trình duyệt.
 * Dữ liệu chỉ nằm trong trình duyệt này. Khi có backend, viết repository gọi API (nhận/gửi DTO) và thay ở store.
 */
export interface OpsRepository {
  load(): Promise<OpsSnapshot>;
  save(snapshot: OpsSnapshot): Promise<void>;
  reset(): Promise<OpsSnapshot>;
}

const STORAGE_KEY = "speego_ops_demo_v4";

/** Không còn dữ liệu demo (src/mocks/ops chỉ còn làm dữ liệu cho bộ check). */
async function loadSeed(): Promise<OpsSnapshot> {
  const dto = { staff: [], suppliers: [], partners: [], requests: [], supplier_quotes: [], pos: [], orders: [], shipments: [], tracking_events: [], documents: [], history: [] };
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
