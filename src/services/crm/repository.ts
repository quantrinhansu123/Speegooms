import type { CrmSnapshot, CrmSnapshotDto } from "@/types/crm";
import { snapshotFromDto, snapshotToDto } from "./adapters";

/**
 * Cổng dữ liệu CRM. Hiện dùng bản mock lưu localStorage của trình duyệt:
 * - Lần đầu nạp seed rỗng rồi lưu vào localStorage.
 * - Mọi thay đổi lưu lại ở đó, tải lại trang vẫn còn; "Đặt lại dữ liệu demo" nạp lại seed.
 * - Dữ liệu chỉ nằm trong trình duyệt này, không chia sẻ giữa người dùng/thiết bị.
 * Khi có backend, viết một CrmRepository gọi API (nhận/gửi DTO) và thay ở store.
 */
export interface CrmRepository {
  load(): Promise<CrmSnapshot>;
  save(snapshot: CrmSnapshot): Promise<void>;
  reset(): Promise<CrmSnapshot>;
}

const STORAGE_KEY = "speego_crm_demo_v2";

/** Không còn dữ liệu demo: dữ liệu thật lấy từ DB qua các trang "live". Các file src/mocks/crm chỉ còn làm dữ liệu cho bộ check. */
async function loadSeed(): Promise<CrmSnapshot> {
  const dto = { staff: [], customers: [], leads: [], interactions: [], rfqs: [], quotations: [], contracts: [] } as unknown as CrmSnapshotDto;
  return snapshotFromDto(dto);
}

export const localCrmRepository: CrmRepository = {
  async load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) return snapshotFromDto(JSON.parse(raw) as CrmSnapshotDto);
    } catch {
      // localStorage bị chặn hoặc dữ liệu hỏng: dùng seed
    }
    return loadSeed();
  },
  async save(snapshot) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshotToDto(snapshot)));
    } catch {
      // đầy dung lượng/bị chặn: bỏ qua, dữ liệu vẫn còn trong phiên
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
