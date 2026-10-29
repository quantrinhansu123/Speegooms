"use client";

import { useState, type ReactNode } from "react";
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
  children,
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
  children?: ReactNode;
}) {
  const rangeError = dateRangeError(from, to);
  return (
    <form
      className="mb-4 grid gap-3 rounded-xl border bg-card p-3 md:grid-cols-2 xl:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!rangeError) onSearch();
      }}
    >
      <Field label="Tìm kiếm" htmlFor="list-q">
        <Input id="list-q" value={q} placeholder="Mã, tên, hàng hóa..." onChange={(event) => onQ(event.target.value)} />
      </Field>
      <Field label={dateLabel} htmlFor="list-from" error={rangeError}>
        <Input id="list-from" type="date" value={from} onChange={(event) => onFrom(event.target.value)} />
      </Field>
      <Field label="Đến ngày" htmlFor="list-to">
        <Input id="list-to" type="date" value={to} onChange={(event) => onTo(event.target.value)} />
      </Field>
      {children}
      <div className="flex items-end gap-2">
        <Button type="submit">Tìm</Button>
        <Button type="button" variant="outline" onClick={onReset}>Xóa lọc</Button>
      </div>
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
