"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Chọn nhiều giá trị: ô tìm kiếm + danh sách có checkbox. */
export function MultiCombobox({ id, options, value, onChange, placeholder = "Chọn…", searchPlaceholder = "Tìm…", emptyText = "Không có kết quả." }: {
  id: string;
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  const summary = value.length === 0 ? placeholder : value.length === 1 ? value[0] : `Đã chọn ${value.length} · ${value[0]}…`;
  return (
    <Combobox.Root multiple items={options} value={value} onValueChange={(next) => onChange(next as string[])}>
      <Combobox.Trigger id={id} className={cn("flex h-9 w-full items-center justify-between gap-2 rounded-lg border bg-background px-3 text-left text-sm",
        value.length === 0 && "text-muted-foreground")}>
        <span className="truncate">{summary}</span>
        <ChevronDown className="size-4 shrink-0" aria-hidden />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="z-[70]">
          <Combobox.Popup className="w-[var(--anchor-width)] min-w-56 rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md">
            <Combobox.Input placeholder={searchPlaceholder} aria-label={searchPlaceholder} className="mb-1 h-9 w-full rounded-md border bg-background px-3 text-sm outline-none" />
            <Combobox.Empty className="px-3 py-2 text-muted-foreground">{emptyText}</Combobox.Empty>
            <Combobox.List className="max-h-60 overflow-y-auto overscroll-contain">
              {(item: string) => (
                <Combobox.Item key={item} value={item} className="flex cursor-default items-center gap-2 rounded px-2 py-2 outline-none data-highlighted:bg-muted">
                  <span className="grid size-4 shrink-0 place-items-center rounded border data-[checked]:bg-primary">
                    <Combobox.ItemIndicator><Check className="size-3" aria-hidden /></Combobox.ItemIndicator>
                  </span>
                  <span className="break-words">{item}</span>
                </Combobox.Item>
              )}
            </Combobox.List>
            {value.length > 0 && <button type="button" className="mt-1 w-full rounded px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted" onClick={() => onChange([])}>Bỏ chọn tất cả</button>}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
