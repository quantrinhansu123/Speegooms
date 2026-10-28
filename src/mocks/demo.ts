import type { DemoChartPoint, DemoRow, DemoStat } from "@/types/demo";

export const demoStats: DemoStat[] = [
  { id: "s1", label: "Chỉ số mẫu A", value: "1.284", delta: 12.5, deltaLabel: "so với kỳ trước" },
  { id: "s2", label: "Chỉ số mẫu B", value: "86%", delta: 3.2, deltaLabel: "so với kỳ trước" },
  { id: "s3", label: "Chỉ số mẫu C", value: "42", delta: -8.1, deltaLabel: "so với kỳ trước" },
  { id: "s4", label: "Chỉ số mẫu D", value: "9,4 tr", delta: 0.6, deltaLabel: "so với kỳ trước" },
];

export const demoRows: DemoRow[] = [
  { id: "r1", name: "Hạng mục mẫu 01", owner: "Nguyễn Văn An", status: { label: "Hoàn tất", tone: "success" }, amount: 12500000 },
  { id: "r2", name: "Hạng mục mẫu 02", owner: "Trần Thị Bình", status: { label: "Đang xử lý", tone: "info" }, amount: 8200000 },
  { id: "r3", name: "Hạng mục mẫu 03", owner: "Lê Minh Châu", status: { label: "Chờ duyệt", tone: "warning" }, amount: 4750000 },
  { id: "r4", name: "Hạng mục mẫu 04", owner: "Phạm Quốc Dũng", status: { label: "Có sự cố", tone: "danger" }, amount: 15300000 },
  { id: "r5", name: "Hạng mục mẫu 05", owner: "Hoàng Thu Hà", status: { label: "Nháp", tone: "neutral" }, amount: 980000 },
];

export const demoChart: DemoChartPoint[] = [
  { label: "T1", current: 40, previous: 32 },
  { label: "T2", current: 52, previous: 41 },
  { label: "T3", current: 47, previous: 44 },
  { label: "T4", current: 65, previous: 50 },
  { label: "T5", current: 71, previous: 58 },
  { label: "T6", current: 84, previous: 62 },
];
