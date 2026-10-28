import { ArrowText } from "@/components/shared/arrow-text";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import { TableSkeleton } from "./loading-skeleton";
import type { CsvValue } from "@/lib/csv";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right";
  className?: string;
  sortValue?: (row: T) => string | number;
  exportValue?: (row: T) => CsvValue;
}

/**
 * Khung bảng dữ liệu: toolbar + bảng + trạng thái loading/rỗng + footer.
 * Chưa có sort/filter/phân trang, thêm khi module nghiệp vụ cần.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  loading = false,
  toolbar,
  footer,
  empty,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  loading?: boolean;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  empty?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card shadow-xs", className)}>
      {toolbar && <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">{toolbar}</div>}
      {loading ? (
        <TableSkeleton columns={columns.length} />
      ) : rows.length === 0 ? (
        (empty ?? <EmptyState title="Chưa có dữ liệu" />)
      ) : (
        <Table>
          <TableHeader className="bg-muted/60">
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    "h-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                    col.align === "right" && "text-right",
                    col.className,
                  )}
                >
                  <ArrowText>{col.header}</ArrowText>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={getRowId(row)}>
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={cn("py-3", col.align === "right" && "tabular text-right", col.className)}
                  >
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {footer && <div className="border-t px-4 py-3 text-sm text-muted-foreground">{footer}</div>}
    </div>
  );
}
