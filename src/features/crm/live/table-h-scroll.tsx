"use client";

import { createElement, isValidElement, useCallback, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { FilterableTable } from "@/components/ui/filterable-table";
import { cn } from "@/lib/utils";

/** Wide table with synchronized sticky identity column measurements. */
export function TableHScroll({
  children,
  className,
  stickyIdentity = false,
}: {
  children: ReactNode;
  className?: string;
  /** Keep the first two columns (code and name) visible while scrolling. */
  stickyIdentity?: boolean;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);

  const syncWidth = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    const table = body.querySelector("table");
    if (stickyIdentity) {
      const codeHeader = table?.querySelector("thead th:first-child");
      body.style.setProperty("--sticky-code-width", `${codeHeader?.getBoundingClientRect().width ?? 0}px`);
    }
  }, [stickyIdentity]);

  useEffect(() => {
    syncWidth();
    const body = bodyRef.current;
    if (!body) return;
    const observer = new ResizeObserver(syncWidth);
    observer.observe(body);
    const table = body.querySelector("table");
    if (table) observer.observe(table);
    const codeHeader = table?.querySelector("thead th:first-child");
    if (codeHeader) observer.observe(codeHeader);
    window.addEventListener("resize", syncWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncWidth);
    };
  }, [syncWidth, children]);

  return (
    <div className={cn("min-w-0 max-w-full rounded-xl border bg-card", className)}>

      <div
        ref={bodyRef}
        className="overflow-x-auto [&_th]:whitespace-nowrap"
        data-sticky-identity={stickyIdentity || undefined}
      >
        {isValidElement<ComponentProps<"table">>(children) && children.type === "table" ? createElement(FilterableTable, children.props) : children}
      </div>
    </div>
  );
}
