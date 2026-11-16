"use client";

import { createElement, isValidElement, useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { FilterableTable } from "@/components/ui/filterable-table";
import { cn } from "@/lib/utils";

/** Wide table with synchronized sticky identity column measurements. */
export function TableHScroll({
  children,
  className,
  stickyIdentity = false,
  localScrollbar = false,
}: {
  children: ReactNode;
  className?: string;
  /** Keep the first two columns (code and name) visible while scrolling. */
  stickyIdentity?: boolean;
  /** Keep a horizontal scrollbar inside forms, above the table. */
  localScrollbar?: boolean;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);

  const syncWidth = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    if (localScrollbar) {
      setScrollWidth(body.scrollWidth > body.clientWidth + 1 ? body.scrollWidth : 0);
      if (scrollbarRef.current) scrollbarRef.current.scrollLeft = body.scrollLeft;
    }
    const table = body.querySelector("table");
    if (stickyIdentity) {
      const codeHeader = table?.querySelector("thead th:first-child");
      body.style.setProperty("--sticky-code-width", `${codeHeader?.getBoundingClientRect().width ?? 0}px`);
    }
  }, [stickyIdentity, localScrollbar]);

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
    <div className={cn("relative min-w-0 max-w-full rounded-xl border bg-card", className)}>
      {localScrollbar && (
        <div
          ref={scrollbarRef}
          role="region"
          aria-label="Cuộn ngang thông tin đơn hàng"
          tabIndex={0}
          hidden={!scrollWidth}
          className="sticky top-0 z-10 overflow-x-scroll overflow-y-hidden rounded-t-[inherit] border-b bg-card print:hidden"
          onScroll={(event) => {
            if (bodyRef.current) bodyRef.current.scrollLeft = event.currentTarget.scrollLeft;
          }}
        >
          <div style={{ width: scrollWidth, height: 14 }} />
        </div>
      )}
      <div
        ref={bodyRef}
        className="overflow-x-auto [&_th]:whitespace-nowrap"
        data-sticky-identity={stickyIdentity || undefined}
        data-table-local-scroll={localScrollbar || undefined}
        onScroll={localScrollbar ? (event) => {
          if (scrollbarRef.current) scrollbarRef.current.scrollLeft = event.currentTarget.scrollLeft;
        } : undefined}
      >
        {isValidElement<ComponentProps<"table">>(children) && children.type === "table" ? createElement(FilterableTable, children.props) : children}
      </div>
    </div>
  );
}
