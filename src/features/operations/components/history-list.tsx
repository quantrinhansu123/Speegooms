import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { formatDate } from "@/lib/format";
import type { OpsHistory } from "@/types/ops";

/** Lịch sử thao tác: ai làm gì lúc nào, mới nhất lên đầu. */
export function HistoryList({ title, entries, staffName }: { title: string; entries: OpsHistory[]; staffName: (id: string) => string }) {
  const sorted = [...entries].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  return (
    <SectionCard title={title} description="Người thực hiện và thời điểm của từng thao tác">
      {sorted.length === 0 ? (
        <EmptyState title="Chưa có thao tác" className="py-8" />
      ) : (
        <ol className="relative space-y-4 border-l pl-5">
          {sorted.map((h) => (
            <li key={h.id} className="relative">
              <span aria-hidden className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full border-2 border-surface bg-primary" />
              <p className="text-sm">{h.text}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {staffName(h.by)} · {formatDate(h.at.slice(0, 10))} {h.at.slice(11)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
