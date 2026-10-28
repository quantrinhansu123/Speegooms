import customers from "@/mocks/data/customers.json";
import leads from "@/mocks/data/leads.json";
import orders from "@/mocks/data/orders.json";
import rfqs from "@/mocks/data/rfqs.json";
import tasks from "@/mocks/data/tasks.json";
import type { DashboardData } from "@/types/dashboard";

/** Mốc "hôm nay" cố định để dữ liệu mock luôn nhất quán. */
const MOCK_TODAY = "2026-10-28";

/**
 * Hiện trả mock JSON. Khi có API, đổi thân hàm sang fetch các endpoint tương ứng
 * và giữ nguyên kiểu DashboardData.
 */
export async function getDashboardData(): Promise<DashboardData> {
  return {
    today: MOCK_TODAY,
    customers,
    leads,
    rfqs,
    orders,
    tasks,
  } as DashboardData;
}
