import { cn } from "@/lib/utils";
import { cloneElement, isValidElement } from "react";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-danger">
            *
          </span>
        )}
      </label>
      {isValidElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean; "aria-required"?: boolean }>(children) && children.props.id === htmlFor
        ? cloneElement(children, {
          "aria-describedby": [children.props["aria-describedby"], error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : ""].filter(Boolean).join(" ") || undefined,
          "aria-invalid": error ? true : children.props["aria-invalid"],
          "aria-required": required || children.props["aria-required"],
        }) : children}
      {hint && !error && <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Select gốc của trình duyệt: truy cập tốt, đồng bộ kiểu với Input. */
export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cn(
        "h-10 w-full rounded-lg border border-input bg-surface px-3 text-sm outline-none focus-visible:border-ring/70 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
        className,
      )}
    />
  );
}

export function InlineAlert({
  tone = "danger",
  children,
  className,
}: {
  tone?: "danger" | "warning" | "info" | "success";
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    danger: "bg-danger-soft text-danger",
    warning: "bg-warning-soft text-warning",
    info: "bg-info-soft text-info",
    success: "bg-success-soft text-success",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-lg px-3 py-2.5 text-sm", tones[tone], className)}>
      {children}
    </div>
  );
}
