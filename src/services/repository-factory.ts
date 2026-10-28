import { camelizeKeys, snakeizeKeys } from "@/services/crm/adapters";

/**
 * Repository mock dùng chung: seed JSON (DTO) + localStorage của trình duyệt.
 * Mọi module (Fulfillment, Kế toán...) dùng cùng cách lưu; khi có backend, thay bằng bản gọi API (nhận/gửi DTO).
 * Dữ liệu chỉ nằm trong trình duyệt này, không đồng bộ giữa người dùng hay thiết bị.
 */
export interface Repository<T> {
  load(): Promise<T>;
  save(snapshot: T): Promise<void>;
  reset(): Promise<T>;
}

export function createLocalRepository<T>(storageKey: string, loadSeedDto: () => Promise<unknown>): Repository<T> {
  const seed = async () => camelizeKeys<T>(await loadSeedDto());
  return {
    async load() {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) return camelizeKeys<T>(JSON.parse(raw));
      } catch {
        // localStorage bị chặn hoặc dữ liệu hỏng: dùng seed
      }
      return seed();
    },
    async save(snapshot) {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(snakeizeKeys<unknown>(snapshot)));
      } catch {
        // đầy dung lượng/bị chặn: bỏ qua, dữ liệu vẫn còn trong phiên
      }
    },
    async reset() {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // bỏ qua
      }
      return seed();
    },
  };
}
