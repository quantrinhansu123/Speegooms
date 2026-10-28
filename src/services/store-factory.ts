import type { Repository } from "@/services/repository-factory";

/**
 * Store (external store) dùng chung cho các module mới: giữ snapshot, lưu qua Repository,
 * phát sự kiện cho useSyncExternalStore. Các module đọc chéo nhau qua getState() của store tương ứng,
 * nên trạng thái giả lập (cọc, PO, lô hàng, giao nhận, thu chi) luôn đồng bộ.
 */
export interface StoreState<T> {
  status: "loading" | "ready" | "error";
  error?: string;
  data: T;
}

export function createStore<T>(repo: Repository<T>, empty: T) {
  const LOADING: StoreState<T> = { status: "loading", data: empty };
  let state: StoreState<T> = LOADING;
  let started = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  return {
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getSnapshot: () => state,
    getServerSnapshot: () => LOADING,
    start() {
      if (started) return;
      started = true;
      repo.load().then((data) => {
        state = { status: "ready", data };
        emit();
      }).catch(() => {
        state = { ...state, status: "error", error: "Không thể tải dữ liệu demo. Vui lòng thử lại." };
        emit();
      });
    },
    commit(update: (d: T) => T) {
      state = { status: "ready", data: update(state.data) };
      emit();
      void repo.save(state.data);
    },
    async reset() {
      state = LOADING;
      emit();
      try { state = { status: "ready", data: await repo.reset() }; }
      catch { state = { ...state, status: "error", error: "Không thể đặt lại dữ liệu demo. Vui lòng thử lại." }; }
      emit();
    },
  };
}
