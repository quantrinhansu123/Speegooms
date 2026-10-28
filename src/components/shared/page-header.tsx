import { ArrowText } from "@/components/shared/arrow-text";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
  headingLevel = 1,
}: {
  title: string;
  description?: string;
  /** Nút hành động bên phải. Mỗi trang chỉ nên có một nút chính. */
  actions?: React.ReactNode;
  className?: string;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div className={cn("mb-6 flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <Heading className={cn("font-semibold tracking-tight text-primary", headingLevel === 1 ? "text-2xl" : "text-xl")}><ArrowText>{title}</ArrowText></Heading>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground"><ArrowText>{description}</ArrowText></p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
