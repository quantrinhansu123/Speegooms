import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  messId: string;
  rfqId?: string;
  orderId?: string;
  customerId: string;
  className?: string;
}

function Node({ label, id, href }: { label: string; id?: string; href?: string }) {
  const body = (
    <>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-xs font-medium">{id ?? "chưa có"}</span>
    </>
  );
  const base = "flex flex-col rounded-md border px-2.5 py-1";
  return id && href ? (
    <Link href={href} className={cn(base, "bg-surface transition-colors hover:border-input hover:bg-muted")}>
      {body}
    </Link>
  ) : (
    <span className={cn(base, "border-dashed text-muted-foreground")}>{body}</span>
  );
}

/** Chuỗi khóa mess_id → rfq_id → order_id và customer_id, bấm để nhảy tới bản ghi. */
export function ChainTrace({ messId, rfqId, orderId, customerId, className }: Props) {
  return (
    <nav aria-label="Chuỗi liên kết bản ghi" className={cn("flex flex-wrap items-center gap-2", className)}>
      <Node label="mess_id" id={messId} href={`/crm/leads/${messId}`} />
      <ArrowRight aria-hidden className="size-4 text-brand-orange" />
      <Node label="rfq_id" id={rfqId} href={rfqId ? `/crm/rfq/${rfqId}` : undefined} />
      <ArrowRight aria-hidden className="size-4 text-brand-orange" />
      <Node label="order_id" id={orderId} href={orderId ? `/crm/hop-dong/${orderId}` : undefined} />
      <span aria-hidden className="mx-1 h-6 w-px bg-border" />
      <Node label="customer_id" id={customerId} href={`/crm/khach-hang/${customerId}`} />
    </nav>
  );
}
