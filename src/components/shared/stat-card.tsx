import { ArrowText } from "@/components/shared/arrow-text";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  /** Giá trị đã format sẵn (định dạng thuộc về tầng dữ liệu). */
  value: string;
  icon?: LucideIcon;
  /** Thay đổi so với kỳ trước, đơn vị %. */
  delta?: number;
  deltaLabel?: string;
  /** Dòng mô tả khi không có delta (ví dụ chỉ số tại thời điểm hiện tại). */
  caption?: string;
  /** Có href thì cả thẻ bấm được. Chỉ truyền khi trang đích tồn tại. */
  href?: string;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, delta, deltaLabel, caption, href, className }: StatCardProps) {
  const up = (delta ?? 0) >= 0;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground"><ArrowText>{label}</ArrowText></p>
        {Icon && (
          <span className="flex size-8 items-center justify-center rounded-md bg-accent text-primary">
            <Icon aria-hidden className="size-4" />
          </span>
        )}
      </div>
      <p className="tabular mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        {delta !== undefined ? (
          <p className="flex items-center gap-1.5">
            <span className={cn("inline-flex items-center font-medium", up ? "text-success" : "text-danger")}>
              <Arrow aria-hidden className="size-3.5" />
              <span className="sr-only">{up ? "Tăng" : "Giảm"}</span>
              {Math.abs(delta)}%
            </span>
            {deltaLabel && <span className="text-muted-foreground">{deltaLabel}</span>}
          </p>
        ) : (
          <p className="text-muted-foreground">{caption && <ArrowText>{caption}</ArrowText>}</p>
        )}
        {href && <ChevronRight aria-hidden className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />}
      </div>
    </>
  );

  const base = "block rounded-xl border bg-card p-5 shadow-xs";
  return href ? (
    <Link
      href={href}
      className={cn(base, "group transition-[box-shadow,border-color] hover:border-input hover:shadow-md", className)}
    >
      {body}
    </Link>
  ) : (
    <div className={cn(base, className)}>{body}</div>
  );
}
