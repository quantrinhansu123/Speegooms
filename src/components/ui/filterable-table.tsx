"use client";

import { Children, isValidElement, useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { Columns3 } from "lucide-react";
import { buttonVariants } from "./button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "./dropdown-menu";

/** Column visibility belongs to this table only; fields remain mounted to preserve edits. */
export function FilterableTable({ children, style, ref, ...props }: ComponentProps<"table">) {
  const tableRef = useRef<HTMLTableElement>(null);
  const id = useId();
  const [toolbar, setToolbar] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const scope = table.closest("main") ?? document.body;
    const findToolbar = () => {
      let container = table.parentElement;
      while (container && container !== document.body) {
        const slots = Array.from(container.querySelectorAll<HTMLElement>("[data-table-column-toolbar]"));
        const preceding = slots.filter((slot) => slot.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING);
        if (preceding.length) {
          setToolbar(preceding.at(-1)!);
          return;
        }
        if (container === scope) break;
        container = container.parentElement;
      }
      setToolbar(null);
    };
    findToolbar();
    // Toolbars can mount after the table during navigation or async rendering.
    const observer = new MutationObserver(findToolbar);
    if (scope) observer.observe(scope, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  const [columns, setColumns] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const readColumns = () => {
      const header = table.tHead;
      const cells = Array.from(header?.rows[0]?.cells ?? []);
      // shortcut: single-row headers only; add span mapping when a grouped data table needs filtering.
      const labels = header?.rows.length === 1 && cells.every((cell) => cell.colSpan === 1 && cell.rowSpan === 1)
        ? cells.map((cell, index) => cell.textContent?.trim() || `Cột ${index + 1}`)
        : [];
      setColumns((current) => JSON.stringify(current) === JSON.stringify(labels) ? current : labels);
    };
    const frame = requestAnimationFrame(readColumns);
    const observer = new MutationObserver(readColumns);
    if (table.tHead) observer.observe(table.tHead, { childList: true, subtree: true, characterData: true });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [children]);

  const keys = columns.map((label, index) => `${index}:${label}`);
  const hiddenIndexes = keys.flatMap((key, index) => hidden.includes(key) ? [index] : []);
  const enabled = columns.length >= 6;
  const hasHidden = enabled && hiddenIndexes.length > 0;
  const selector = `table[data-column-filter="${id}"]`;
  const content = Children.toArray(children);
  const isCaption = (child: (typeof content)[number]) => isValidElement(child) && child.type === "caption";

  const columnMenu = enabled ? (
          <DropdownMenu>
            <DropdownMenuTrigger type="button" aria-label="Cột hiển thị" title="Cột hiển thị" className={buttonVariants({ variant: "outline", size: "icon" })}>
              <Columns3 aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 w-64">
              {columns.map((label, index) => (
                <DropdownMenuCheckboxItem key={keys[index]} checked={!hidden.includes(keys[index])} closeOnClick={false}
                  disabled={!hidden.includes(keys[index]) && hiddenIndexes.length === columns.length - 1}
                  onCheckedChange={(checked) => setHidden((current) => checked ? current.filter((key) => key !== keys[index]) : [...current, keys[index]])}>
                  {label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
  ) : null;

  return (
    <>
      {columnMenu && (toolbar ? createPortal(columnMenu, toolbar) : <div className="sticky left-0 flex w-full justify-end p-2 print:hidden">{columnMenu}</div>)}
      {hasHidden && <style>{hiddenIndexes.map((index) => `${selector} > :is(thead,tbody,tfoot) > tr > :nth-child(${index + 1}):not([colspan]):not([rowspan]) { visibility: hidden !important; }`).join("\n")}</style>}
      <table {...props} data-column-filter={id} style={hasHidden ? { ...style, minWidth: 0, width: "100%" } : style}
        ref={(node) => { tableRef.current = node; if (typeof ref === "function") return ref(node); if (ref) ref.current = node; }}>
        {content.filter(isCaption)}
        {enabled && <colgroup>{keys.map((key) => <col key={key} style={hidden.includes(key) ? { visibility: "collapse" } : undefined} />)}</colgroup>}
        {content.filter((child) => !isCaption(child))}
      </table>
    </>
  );
}
