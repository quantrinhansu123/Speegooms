import { targetCompletion } from "@speego/shared";

export type TargetReportData = {
  members: { id: string; name: string }[];
  metrics: { code: string; name: string; unit: string; direction: "at-least" | "at-most"; active: boolean }[];
  targets: Record<string, Record<string, number>>;
  results: Record<string, Record<string, { actual: number; tasks: number }>>;
};

export type TargetReportRow = {
  key: string;
  member: string;
  metric: TargetReportData["metrics"][number];
  target: number | undefined;
  actual: number;
  tasks: number;
  hasResult: boolean;
  completion: number | null;
};

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

/**
 * Dòng người × KPI đã được giao mục tiêu hoặc đã có kết quả nghiệm thu trong kỳ.
 * selected = null là tất cả; chọn từ 2 người trở lên thì thêm dòng "Tổng nhóm" cho mỗi KPI:
 * KPI tối thiểu cộng mục tiêu và kết quả, KPI tối đa (chi phí) lấy trung bình trên những người có số.
 */
export function targetReportRows(report: TargetReportData, selected: string[] | null): TargetReportRow[] {
  const members = report.members.filter((member) => selected === null || selected.includes(member.id));
  const people = members.flatMap((member) => report.metrics.flatMap((metric) => {
    const target = report.targets[member.id]?.[metric.code];
    const result = report.results[member.id]?.[metric.code];
    if (target === undefined && !result) return [];
    const actual = result?.actual ?? 0;
    return [{
      key: `${member.id}|${metric.code}`, member: member.name, metric, target, actual, tasks: result?.tasks ?? 0, hasResult: Boolean(result),
      completion: target === undefined ? null : targetCompletion(actual, target, metric.direction),
    }];
  }));
  if (members.length < 2) return people;
  const groups = report.metrics.flatMap((metric): TargetReportRow[] => {
    const mine = people.filter((row) => row.metric.code === metric.code);
    if (mine.length === 0) return [];
    const targets = mine.flatMap((row) => (row.target === undefined ? [] : [row.target]));
    const results = mine.filter((row) => row.hasResult);
    const aggregate = (values: number[]) => (metric.direction === "at-most" ? mean(values) : values.reduce((a, b) => a + b, 0));
    const target = targets.length ? aggregate(targets) : undefined;
    const actual = results.length ? aggregate(results.map((row) => row.actual)) : 0;
    return [{
      key: `group|${metric.code}`, member: "Tổng nhóm", metric, target, actual, tasks: results.reduce((sum, row) => sum + row.tasks, 0), hasResult: results.length > 0,
      completion: target === undefined ? null : targetCompletion(actual, target, metric.direction),
    }];
  });
  return [...groups, ...people];
}
