import { ArrowText } from "@/components/shared/arrow-text";
import { cn } from "@/lib/utils";

/** Khối nội dung có tiêu đề: dùng cho biểu đồ, danh sách, bảng trên dashboard. */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  flush = false,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Thẻ chứa bảng sát mép: tiêu đề cân đối trên dưới, thân không có padding. */
  flush?: boolean;
}) {
  return (
    <section className={cn("flex flex-col rounded-xl border bg-card shadow-xs", className)}>
      <header className={cn("flex items-start justify-between gap-3 px-5", flush ? "items-center border-b py-4" : "pt-5")}>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground"><ArrowText>{title}</ArrowText></h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground"><ArrowText>{description}</ArrowText></p>}
        </div>
        {action}
      </header>
      <div className={cn("flex-1", flush ? "p-0" : "p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
