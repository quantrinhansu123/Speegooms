"use client";

import { useState, type ComponentProps } from "react";
import { NativeSelect } from "@/components/shared/form-fields";
import { Input } from "@/components/ui/input";
import { joinPhoneNumber, phoneCountries, splitPhoneNumber } from "./phone-number";

type PhoneInputProps = Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (value: string) => void;
};

export function PhoneInput({ value, onChange, ...props }: PhoneInputProps) {
  const parsed = splitPhoneNumber(value);
  const [emptyCode, setEmptyCode] = useState(parsed.code);
  const code = value ? parsed.code : emptyCode;
  return (
    <div className="flex min-w-0 gap-2">
      <NativeSelect
        id={props.id ? `${props.id}-country` : undefined}
        aria-label="Mã quốc gia điện thoại"
        aria-describedby={props["aria-describedby"]}
        aria-invalid={props["aria-invalid"]}
        className="w-40 shrink-0"
        disabled={props.disabled || props.readOnly}
        value={code}
        onChange={(event) => {
          setEmptyCode(event.target.value);
          onChange(joinPhoneNumber(event.target.value, parsed.number));
        }}
      >
        {phoneCountries.map((country) => <option key={country.code} value={country.code}>{country.label}</option>)}
        <option value="">Mã khác (nhập cả mã)</option>
      </NativeSelect>
      <Input
        {...props}
        type="tel"
        autoComplete="tel-national"
        maxLength={30}
        placeholder="0346612345"
        value={parsed.number}
        onChange={(event) => {
          const number = event.target.value;
          const pasted = /^\s*\(?\+/.test(number) ? splitPhoneNumber(number) : null;
          setEmptyCode(pasted?.code ?? code);
          onChange(joinPhoneNumber(code, number));
        }}
      />
    </div>
  );
}
