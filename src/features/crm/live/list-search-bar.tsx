"use client";

import { useId, useState, type ReactNode } from "react";
import { FilterPanel } from "@/components/shared/filter-panel";
import { Field, NativeSelect } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type DateSearch = {
  q: string;
  from: string;
  to: string;
};

export function searchParams(search: DateSearch, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  if (search.q.trim()) params.set("q", search.q.trim());
  if (search.from) params.set("from", search.from);
  if (search.to) params.set("to", search.to);
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }
  const text = params.toString();
  return text ? `&${text}` : "";
}

export function dateRangeError(from: string, to: string): string | undefined {
  if (from && to && from > to) return "Ngày bắt đầu không được sau ngày kết thúc";
  return undefined;
}

export function useAppliedSearch<T extends DateSearch>(initial: T) {
  const [draft, setDraft] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const set = <K extends keyof T>(key: K, value: T[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const active = Object.values(applied).some((value) => String(value).trim() !== "");
  return {
    draft,
    applied,
    set,
    active,
    activeCount: Object.entries(applied).filter(([key, value]) => key !== "q" && key !== "customerKind" && String(value).trim() !== "").length,
    select: <K extends keyof T>(key: K, value: T[K]) => {
      setDraft((current) => ({ ...current, [key]: value }));
      setApplied((current) => ({ ...current, [key]: value }));
    },
    search: () => setApplied(draft),
    reset: () => {
      setDraft(initial);
      setApplied(initial);
    },
  };
}

export function ListSearchBar({
  q,
  from,
  to,
  onQ,
  onFrom,
  onTo,
  onSearch,
  onReset,
  dateLabel,
  searchPlaceholder = "Mã, tên, hàng hóa...",
  children,
  tabs,
  activeCount = 0,
}: {
  q: string;
  from: string;
  to: string;
  onQ: (value: string) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onSearch: () => void;
  onReset: () => void;
  dateLabel: string;
  searchPlaceholder?: string;
  children?: ReactNode;
  tabs?: ReactNode;
  activeCount?: number;
}) {
  const rangeError = dateRangeError(from, to);
  const id = useId();
  return (
    <form
      className="mb-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!rangeError) onSearch();
      }}
    >
      {tabs && <div className="mb-3">{tabs}</div>}
      <FilterPanel count={activeCount} toolbar={<>
        <label className="sr-only" htmlFor={id + "-q"}>Tìm kiếm</label>
        <Input className="min-w-40 flex-1 sm:max-w-md" id={id + "-q"} value={q} placeholder={searchPlaceholder} onChange={(event) => onQ(event.target.value)} />
        <Button type="submit">Tìm</Button>
        <Button type="button" variant="ghost" onClick={onReset}>Xóa lọc</Button>
      </>}>
        <Field label={dateLabel} htmlFor={id + "-from"}>
          <Input id={id + "-from"} type="date" value={from} onChange={(event) => onFrom(event.target.value)} />
        </Field>
        <Field label="Đến ngày" htmlFor={id + "-to"}>
          <Input id={id + "-to"} type="date" value={to} onChange={(event) => onTo(event.target.value)} />
        </Field>
        {children}
        <Button type="submit">Áp dụng</Button>
      </FilterPanel>
      {rangeError && <p role="alert" className="text-sm text-destructive">{rangeError}</p>}
    </form>
  );
}

export function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <Field label={label} htmlFor={id}>
      <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Tất cả</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </NativeSelect>
    </Field>
  );
}

export function CustomerKindTabs({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div role="group" aria-label="Loại khách" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1">
    {[["", "Tất cả"], ["SOURCING", "Sourcing"], ["LOGISTICS", "Logistic"]].map(([key, label]) =>
      <Button key={key} type="button" variant={value === key ? "secondary" : "ghost"} aria-pressed={value === key} className={value === key ? "bg-card shadow-sm" : ""} onClick={() => onChange(key)}>{label}</Button>
    )}
  </div>;
}
