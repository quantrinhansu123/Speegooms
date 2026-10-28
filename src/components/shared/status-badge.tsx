import { AlertTriangle, CheckCircle2, Circle, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatusTone } from "@/types/status";

const tones: Record<StatusTone, { className: string; icon: typeof Info }> = {
  success: { className: "bg-success-soft text-success", icon: CheckCircle2 },
  warning: { className: "bg-warning-soft text-warning", icon: AlertTriangle },
  danger: { className: "bg-danger-soft text-danger", icon: XCircle },
  info: { className: "bg-info-soft text-info", icon: Info },
  neutral: { className: "bg-neutral-soft text-neutral", icon: Circle },
};

/** Trạng thái luôn kèm icon + chữ, không chỉ dựa vào màu. */
export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  const { className: toneClass, icon: Icon } = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClass,
        className,
      )}
    >
      <Icon aria-hidden className="size-3" />
      {children}
    </span>
  );
}
