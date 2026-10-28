import type { StatusTone } from "./status";

/** Kiểu dữ liệu chỉ phục vụ trang demo UI, không phải nghiệp vụ. */
export interface DemoStat {
  id: string;
  label: string;
  value: string;
  delta: number;
  deltaLabel: string;
}

export interface DemoRow {
  id: string;
  name: string;
  owner: string;
  status: { label: string; tone: StatusTone };
  amount: number;
}

export interface DemoChartPoint {
  label: string;
  current: number;
  previous: number;
}
