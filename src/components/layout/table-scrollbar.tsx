"use client";

import { useEffect, useRef, useState } from "react";

/** One viewport scrollbar follows the visible overflowing table on every page. */
export function TableScrollbar() {
  const barRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const [geometry, setGeometry] = useState({ left: 0, width: 0, content: 0 });

  useEffect(() => {
    let frame = 0;
    const managed = new Set<HTMLElement>();
    const update = () => {
      frame = 0;
      const main = document.getElementById("main");
      if (!main) return;
      const viewport = main.getBoundingClientRect();
      let selected: HTMLElement | null = null;
      let best = 0;
      for (const table of document.querySelectorAll("table")) {
        let parent = table.parentElement;
        while (parent && parent !== main && parent !== document.body) {
          if (/auto|scroll/.test(getComputedStyle(parent).overflowX)) break;
          parent = parent.parentElement;
        }
        if (!parent || parent === main || parent === document.body) continue;
        if (parent.hasAttribute("data-table-local-scroll")) continue;
        parent.classList.add("table-scroll-managed");
        managed.add(parent);
        const rect = parent.getBoundingClientRect();
        const visible = Math.min(rect.bottom, viewport.bottom) - Math.max(rect.top, viewport.top);
        if (rect.width && visible > best && parent.scrollWidth > parent.clientWidth + 1) {
          selected = parent;
          best = visible;
        }
      }
      targetRef.current = selected;
      const rect = selected?.getBoundingClientRect();
      const left = Math.max(rect?.left ?? 0, viewport.left, 0);
      const width = rect ? Math.max(0, Math.min(rect.right, viewport.right, window.innerWidth) - left) : 0;
      const next = { left, width, content: selected ? selected.scrollWidth * width / selected.clientWidth : 0 };
      setGeometry((current) => current.left === next.left && current.width === next.width && current.content === next.content ? current : next);
      if (barRef.current && selected) barRef.current.scrollLeft = selected.scrollLeft * width / selected.clientWidth;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    const resize = new ResizeObserver(schedule);
    const main = document.getElementById("main");
    if (main) resize.observe(main);
    document.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    // Table widths can change without a window resize (column visibility, edits).
    const interval = window.setInterval(schedule, 500);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      clearInterval(interval);
      document.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      managed.forEach((element) => element.classList.remove("table-scroll-managed"));
    };
  }, []);

  return <div ref={barRef} data-table-viewport-scrollbar role="region" aria-label="Cuộn ngang bảng" tabIndex={0}
    className="fixed bottom-0 z-40 overflow-x-scroll overflow-y-hidden border-t bg-background print:hidden"
    style={{ left: geometry.left, width: geometry.width, display: geometry.width ? undefined : "none" }}
    onScroll={(event) => {
      const target = targetRef.current;
      if (target && geometry.width) target.scrollLeft = event.currentTarget.scrollLeft * target.clientWidth / geometry.width;
    }}>
    <div style={{ width: geometry.content, height: 14 }} />
  </div>;
}
