"use client";

import { useRouter } from "next/navigation";
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
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  loading?: boolean;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  empty?: React.ReactNode;
  className?: string;
  /**
   * Bấm vào dòng. Mặc định đi theo link nội bộ đầu tiên trong dòng (thường là link tới trang chi tiết);
   * truyền onRowClick cho các dòng mở dialog thay vì chuyển trang.
   */
  onRowClick?: (row: T) => void;
}) {
  const router = useRouter();
  const activate = (row: T, el: HTMLTableRowElement) => {
    if (onRowClick) return onRowClick(row);
    const href = el.querySelector<HTMLAnchorElement>("a[href^='/']")?.getAttribute("href");
    if (href) router.push(href);
  };
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
              <TableRow
                key={getRowId(row)}
                className={onRowClick ? "cursor-pointer" : "has-[a[href^='/']]:cursor-pointer"}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); activate(row, e.currentTarget); } } : undefined}
                onClick={(e) => {
                  // bỏ qua click từ portal (dialog) và khi bấm vào link/nút/ô nhập bên trong dòng
                  if (!e.currentTarget.contains(e.target as Node) || (e.target as HTMLElement).closest("a,button,input,select,textarea,label,[role=button]")) return;
                  activate(row, e.currentTarget);
                }}
              >
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
