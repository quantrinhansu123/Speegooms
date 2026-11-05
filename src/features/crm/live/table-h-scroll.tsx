"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type UIEvent } from "react";
import { cn } from "@/lib/utils";

/** Bảng rộng: thanh kéo ngang ở trên đầu, đồng bộ với vùng bảng bên dưới. */
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
  const topRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const syncing = useRef<"top" | "body" | null>(null);
  const [ready, setReady] = useState(false);

  const syncWidth = useCallback(() => {
    const body = bodyRef.current;
    const spacer = spacerRef.current;
    if (!body || !spacer) return;
    const table = body.querySelector("table");
    const width = Math.max(table?.scrollWidth ?? 0, body.scrollWidth);
    spacer.style.width = `${width}px`;
    setReady(width > body.clientWidth + 1);
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

  const onTopScroll = (event: UIEvent<HTMLDivElement>) => {
    if (syncing.current === "body") return;
    syncing.current = "top";
    if (bodyRef.current) bodyRef.current.scrollLeft = event.currentTarget.scrollLeft;
    syncing.current = null;
  };

  const onBodyScroll = (event: UIEvent<HTMLDivElement>) => {
    if (syncing.current === "top") return;
    syncing.current = "body";
    if (topRef.current) topRef.current.scrollLeft = event.currentTarget.scrollLeft;
    syncing.current = null;
  };

  return (
    <div className={cn("rounded-xl border bg-card", className)}>
      <div
        ref={topRef}
        className={cn("overflow-x-auto", ready ? "border-b" : "hidden")}
        onScroll={onTopScroll}
        aria-hidden={!ready}
      >
        <div ref={spacerRef} className="h-3" />
      </div>
      <div
        ref={bodyRef}
        className="overflow-x-auto [&_th]:whitespace-nowrap"
        data-sticky-identity={stickyIdentity || undefined}
        onScroll={onBodyScroll}
      >
        {children}
      </div>
    </div>
  );
}
