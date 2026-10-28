import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  pages,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p role="status" aria-atomic="true" className="tabular text-sm text-muted-foreground">
        {from}–{to} / {total} bản ghi
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-lg" aria-label="Trang trước" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft />
        </Button>
        <span className="tabular min-w-20 text-center text-sm">
          Trang {page} / {pages}
        </span>
        <Button variant="outline" size="icon-lg" aria-label="Trang sau" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
