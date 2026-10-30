"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { formatMoneyGrouped, formatMoneyInput, parseMoneyInput } from "@/lib/format";

type MoneyInputProps = Omit<ComponentProps<typeof Input>, "value" | "onChange" | "inputMode" | "type"> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
  /** Nếu có, gắn kèm input ẩn chứa số thuần để submit form (FormData). */
  name?: string;
};

/** Ô nhập tiền: dấu chấm phân cách hàng nghìn, phẩy thập phân (kiểu Việt). */
export function MoneyInput({ value, onValueChange, onFocus, onBlur, name, ...props }: MoneyInputProps) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(() => (value == null ? "" : formatMoneyGrouped(value)));

  useEffect(() => {
    if (!focused) setText(value == null ? "" : formatMoneyGrouped(value));
  }, [value, focused]);

  return (
    <>
      {name != null && <input type="hidden" name={name} value={value ?? ""} />}
      <Input
        {...props}
        inputMode="decimal"
        value={focused ? text : value == null ? "" : formatMoneyGrouped(value)}
        onFocus={(event) => {
          setFocused(true);
          setText(value == null ? "" : formatMoneyGrouped(value));
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          const next = text.trim() ? parseMoneyInput(text) : null;
          onValueChange(next);
          setText(next == null ? "" : formatMoneyGrouped(next));
          onBlur?.(event);
        }}
        onChange={(event) => {
          const next = formatMoneyInput(event.target.value);
          setText(next);
          onValueChange(next.trim() ? parseMoneyInput(next) : null);
        }}
      />
    </>
  );
}

/** Ô tiền trong form không kiểm soát (mặc định + FormData). */
export function UncontrolledMoneyInput({
  name,
  defaultValue = null,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange" | "inputMode" | "type" | "defaultValue" | "name"> & {
  name: string;
  defaultValue?: number | null;
}) {
  const [value, setValue] = useState<number | null>(defaultValue);
  return <MoneyInput {...props} name={name} value={value} onValueChange={setValue} />;
}
