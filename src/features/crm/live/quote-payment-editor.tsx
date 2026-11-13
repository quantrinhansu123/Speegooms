"use client";

import { defaultQuoteBank, effectiveQuoteBank, quoteCurrencies, type QuoteBank, type QuoteNotes, type QuoteSheetModel } from "@speego/shared";
import { Field, NativeSelect } from "@/components/shared/form-fields";
import { MoneyInput } from "@/components/shared/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Payment = NonNullable<QuoteNotes["payment"]>;

export function QuotePaymentEditor({ payment, bank, currency, model, disabled, fieldId, onPayment, onBank, onCurrency }: {
  payment: Payment | undefined;
  bank: QuoteBank;
  currency: string;
  model: QuoteSheetModel | null;
  disabled: boolean;
  fieldId: (name: string) => string;
  onPayment: (value: Payment) => void;
  onBank: (value: QuoteBank) => void;
  onCurrency: (currency: string) => void;
}) {
  return <section className="grid gap-4 rounded-xl border p-4">
    <h3 className="font-semibold">Thanh toán</h3>
    {!payment ? <>
      <p className="text-sm text-muted-foreground">Chọn tiền báo giá, tiền thanh toán và tài khoản nhận tiền để ghi trên báo giá gửi khách.</p>
      <Button type="button" variant="outline" className="w-fit" disabled={disabled} onClick={() => onPayment({ quoteCurrency: currency, currency, exchangeRate: null })}>Thiết lập thanh toán</Button>
    </> : <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tiền tệ báo giá" htmlFor={fieldId("payment-quote-currency")} hint="Áp dụng cho đơn giá, cước và phụ phí; số giá đã nhập giữ nguyên.">
          <NativeSelect id={fieldId("payment-quote-currency")} value={payment.quoteCurrency} disabled={disabled} onChange={(event) => onCurrency(event.target.value)}>
            {quoteCurrencies.map((code) => <option key={code} value={code}>{code}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Tiền tệ thanh toán" htmlFor={fieldId("payment-currency")}>
          <NativeSelect id={fieldId("payment-currency")} value={payment.currency} disabled={disabled} onChange={(event) => onPayment({ ...payment, currency: event.target.value, exchangeRate: null })}>
            {quoteCurrencies.map((code) => <option key={code} value={code}>{code}</option>)}
          </NativeSelect>
        </Field>
        {payment.currency !== payment.quoteCurrency && <Field label={`Tỷ giá: 1 ${payment.quoteCurrency} = bao nhiêu ${payment.currency}?`} htmlFor={fieldId("payment-rate")} required>
          <MoneyInput id={fieldId("payment-rate")} fractionDigits={6} value={payment.exchangeRate} disabled={disabled} onValueChange={(exchangeRate) => onPayment({ ...payment, exchangeRate })} />
        </Field>}
        <Field label="Tài khoản nhận thanh toán" htmlFor={fieldId("payment-account")}>
          <NativeSelect id={fieldId("payment-account")} value={bank.custom ? "custom" : "default"} disabled={disabled} onChange={(event) => onBank(event.target.value === "default" ? { ...defaultQuoteBank } : { custom: true, title: "", bankName: "", accountName: "", accountNumber: "", routingNumber: "", swiftCode: "" })}>
            <option value="default">Tài khoản ACH mặc định</option>
            <option value="custom">Tài khoản Việt Nam / khác</option>
          </NativeSelect>
        </Field>
        {([ ["bankName", "Tên ngân hàng"], ["accountName", "Chủ tài khoản"], ["accountNumber", "Số tài khoản"], ["routingNumber", "Routing number (nếu có)"], ["swiftCode", "SWIFT (nếu có)"] ] as const).filter(([key]) => bank.custom || key === "accountName" || key === "accountNumber" || key === "routingNumber").map(([key, label]) => <Field key={key} label={label} htmlFor={fieldId(`payment-${key}`)} required={!!bank.custom && ["bankName", "accountName", "accountNumber"].includes(key)}>
          <Input id={fieldId(`payment-${key}`)} value={effectiveQuoteBank(bank)[key] ?? ""} disabled={disabled || !bank.custom} onChange={(event) => onBank({ ...bank, [key]: event.target.value })} />
        </Field>)}
      </div>
      {model?.payment?.error ? <p role="alert" className="text-sm text-danger">{model.payment.error}</p> : <dl className="grid gap-2 rounded-lg bg-muted/40 p-3 text-sm">
        {model?.payment?.rows.map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2"><dt>{label}</dt><dd className="font-semibold">{value}</dd></div>)}
      </dl>}
    </>}
  </section>;
}
