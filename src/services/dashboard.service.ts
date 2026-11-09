import type { DashboardData } from "@/types/dashboard";

/** Mốc "hôm nay" cố định. */
const MOCK_TODAY = "2026-10-28";

/**
 * Không còn dữ liệu demo (src/mocks/data chỉ còn làm dữ liệu cho bộ check). Khi có API, đổi thân hàm sang fetch
 * các endpoint tương ứng và giữ nguyên kiểu DashboardData.
 */
export async function getDashboardData(): Promise<DashboardData> {
  return { today: MOCK_TODAY, customers: [], leads: [], rfqs: [], orders: [], tasks: [] } as DashboardData;
}
