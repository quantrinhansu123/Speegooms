import { ArrowText } from "@/components/shared/arrow-text";
import { Check, Circle, Lock } from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import { cn } from "@/lib/utils";
import { orderStages, type OrderStage } from "@/services/ops/rules";

/** Timeline tiến độ 8 bước (bước tạm, chưa phải 8 mốc chính thức của tài liệu). */
export function OrderTimeline({ stage }: { stage: OrderStage }) {
  const current = orderStages.findIndex((s) => s.key === stage);
  return (
    <SectionCard title="Tiến độ thực hiện" description="Giai đoạn suy ra từ cọc, bàn giao, PO và lô hàng">
      <ol className="space-y-0">
        {orderStages.map((s, i) => {
          const state = stage === "da-giao" || i < current ? "done" : i === current ? "current" : "locked";
          return (
            <li key={s.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border", state === "done" && "border-success bg-success-soft text-success", state === "current" && "border-primary bg-primary text-primary-foreground", state === "locked" && "bg-muted text-muted-foreground")}>
                  {state === "done" ? <Check aria-hidden className="size-3.5" /> : state === "current" ? <Circle aria-hidden className="size-2.5 fill-current" /> : <Lock aria-hidden className="size-3" />}
                </span>
                {i < orderStages.length - 1 && <span aria-hidden className={cn("w-px grow", state === "done" ? "bg-success/50" : "bg-border")} style={{ minHeight: "1.25rem" }} />}
              </div>
              <p className={cn("pb-4 text-sm", state === "current" ? "font-semibold" : state === "locked" ? "text-muted-foreground" : "")}>
                <ArrowText>{s.label}</ArrowText>
                <span className="sr-only">{state === "done" ? " (đã xong)" : state === "current" ? " (đang ở bước này)" : " (chưa tới)"}</span>
              </p>
            </li>
          );
        })}
      </ol>
    </SectionCard>
  );
}
