"use client";

import { createElement, isValidElement, useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { FilterableTable } from "@/components/ui/filterable-table";
import { cn } from "@/lib/utils";

const MAX_PIN = 12;

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
  const [pinOn, setPinOn] = useState(true);
  const [pinCount, setPinCount] = useState(2);
  const pinN = pinOn ? Math.min(Math.max(pinCount, 0), MAX_PIN) : 0;

  const syncWidth = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    if (localScrollbar) {
      setScrollWidth(body.scrollWidth > body.clientWidth + 1 ? body.scrollWidth : 0);
      if (scrollbarRef.current) scrollbarRef.current.scrollLeft = body.scrollLeft;
    }
    const table = body.querySelector("table");
    if (stickyIdentity) {
      let left = 0;
      table?.querySelectorAll("thead tr:first-child th").forEach((th, i) => {
        if (i >= MAX_PIN) return;
        body.style.setProperty(`--sticky-left-${i + 1}`, `${left}px`);
        left += th.getBoundingClientRect().width;
      });
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
    table?.querySelectorAll("thead tr:first-child th").forEach((th) => observer.observe(th));
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
      {stickyIdentity && (
        <label className="flex items-center gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground print:hidden">
          <input type="checkbox" checked={pinOn} onChange={(e) => setPinOn(e.target.checked)} />
          Cố định
          <input
            type="number" min={1} max={MAX_PIN} value={pinCount} disabled={!pinOn}
            onChange={(e) => setPinCount(Number(e.target.value) || 1)}
            className="h-6 w-14 rounded border bg-background px-1 text-foreground"
          />
          cột đầu tiên
        </label>
      )}
      <div
        ref={bodyRef}
        className="overflow-x-auto [&_th]:whitespace-nowrap"
        data-sticky-identity={stickyIdentity || undefined}
        data-sticky-cols={stickyIdentity ? Array.from({ length: pinN }, (_, i) => i + 1).join(" ") : undefined}
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
