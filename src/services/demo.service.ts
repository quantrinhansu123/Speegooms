import { demoChart, demoRows, demoStats } from "@/mocks/demo";

/**
 * Tầng dữ liệu: hiện trả mock, sau này đổi thân hàm sang fetch API
 * mà không phải sửa component. Giữ chữ ký async.
 */
export async function getDemoData() {
  return { stats: demoStats, rows: demoRows, chart: demoChart };
}
