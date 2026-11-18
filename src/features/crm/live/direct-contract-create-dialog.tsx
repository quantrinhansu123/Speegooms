"use client";

import { useState, type FormEvent } from "react";
import { contractShipToOptions, createDirectContractSchema, industryCategoryOptions, quoteCurrencies, type CrmLane, type IndustryCategory, type QuoteCurrency } from "@speego/shared";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/features/auth/session-provider";
import { ApiError, api } from "@/lib/api";
import { formatMoney, formatMoneyInput, parseMoneyInput } from "@/lib/format";
import { crmPath } from "./lane";
import type { ContractRecord } from "./contracts-live-view";

export function DirectContractCreateDialog({ lane, onClose, onCreated }: {
  lane: CrmLane;
  onClose: () => void;
  onCreated: (contract: ContractRecord) => void;
}) {
  const user = useSession();
  const [customerName, setCustomerName] = useState("");
  const [shipTo, setShipTo] = useState("");
  const [product, setProduct] = useState("");
  const [industry, setIndustry] = useState<IndustryCategory | "">("");
  const [quantity, setQuantity] = useState("");
  const [currency, setCurrency] = useState<QuoteCurrency>("VND");
  const [productValue, setProductValue] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [signedOn, setSignedOn] = useState("");
  const [vndRate, setVndRate] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const total = Math.round(((parseMoneyInput(productValue) ?? 0) + (parseMoneyInput(shippingCost) ?? 0)) * 100) / 100;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const parsed = createDirectContractSchema.safeParse({
      customerName, saleName: user.name, shipTo, product, industry: industry || null,
      quantity: quantity.trim() ? Number(quantity) : null,
      currency,
      productValue: productValue.trim() ? parseMoneyInput(productValue) : 0,
      shippingCost: shippingCost.trim() ? parseMoneyInput(shippingCost) : 0,
      paidAmount: paidAmount.trim() ? parseMoneyInput(paidAmount) : 0,
      signedOn,
      vndRates: currency !== "VND" && vndRate.trim() ? { [currency]: parseMoneyInput(vndRate) } : {},
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Kiểm tra thông tin hợp đồng");
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      const body = await api<{ contract: ContractRecord }>(crmPath("/api/crm/contracts", lane), {
        method: "POST", body: JSON.stringify(parsed.data),
      });
      onCreated(body.contract);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không tạo được hợp đồng");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent className="max-h-[92dvh] sm:max-w-2xl">
        <DialogHeader><DialogTitle>Tạo hợp đồng trực tiếp · {lane === "vn" ? "Việt Nam" : "Global"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid min-h-0 gap-4">
          <div className="max-h-[65dvh] overflow-y-auto pr-1">
            {error && <InlineAlert className="mb-4">{error}</InlineAlert>}
            <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
              <Field label="Khách hàng" htmlFor="direct-contract-customer" required>
                <Input id="direct-contract-customer" required maxLength={200} value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
              </Field>
              <Field label="Nhân viên Sale" htmlFor="direct-contract-sale">
                <Input id="direct-contract-sale" value={user.name} readOnly />
              </Field>
              <Field label="Tuyến vận chuyển" htmlFor="direct-contract-ship-to">
                <NativeSelect id="direct-contract-ship-to" value={shipTo} onChange={(event) => setShipTo(event.target.value)}>
                  <option value="">Chưa chọn</option>
                  {contractShipToOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Ngành hàng" htmlFor="direct-contract-industry">
                <NativeSelect id="direct-contract-industry" value={industry} onChange={(event) => setIndustry(event.target.value as IndustryCategory | "")}>
                  <option value="">Chưa chọn</option>
                  {industryCategoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Sản phẩm" htmlFor="direct-contract-product" className="sm:col-span-2">
                <Textarea id="direct-contract-product" maxLength={15_000} value={product} onChange={(event) => setProduct(event.target.value)} />
              </Field>
              <Field label="Số lượng" htmlFor="direct-contract-quantity">
                <Input id="direct-contract-quantity" type="number" min={0} max={1_000_000_000} step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              </Field>
              <Field label="Loại tiền" htmlFor="direct-contract-currency">
                <NativeSelect id="direct-contract-currency" value={currency} onChange={(event) => { setCurrency(event.target.value as QuoteCurrency); setVndRate(""); }}>
                  {quoteCurrencies.map((value) => <option key={value} value={value}>{value}</option>)}
                </NativeSelect>
              </Field>
              <Field label={`Giá trị sản phẩm (${currency})`} htmlFor="direct-contract-product-value">
                <Input id="direct-contract-product-value" inputMode="decimal" placeholder="0" value={productValue} onChange={(event) => setProductValue(formatMoneyInput(event.target.value))} />
              </Field>
              <Field label={`Chi phí vận chuyển (${currency})`} htmlFor="direct-contract-shipping-cost">
                <Input id="direct-contract-shipping-cost" inputMode="decimal" placeholder="0" value={shippingCost} onChange={(event) => setShippingCost(formatMoneyInput(event.target.value))} />
              </Field>
              <Field label={`Đã thanh toán (${currency})`} htmlFor="direct-contract-paid">
                <Input id="direct-contract-paid" inputMode="decimal" placeholder="0" value={paidAmount} onChange={(event) => setPaidAmount(formatMoneyInput(event.target.value))} />
              </Field>
              <Field label="Ngày ký" htmlFor="direct-contract-signed-on">
                <Input id="direct-contract-signed-on" type="date" value={signedOn} onChange={(event) => setSignedOn(event.target.value)} />
              </Field>
              {currency !== "VND" && <Field label={`1 ${currency} = ? VND`} htmlFor="direct-contract-vnd-rate" hint="Có thể bổ sung tỷ giá trong phần thanh toán sau.">
                <Input id="direct-contract-vnd-rate" inputMode="decimal" value={vndRate} onChange={(event) => setVndRate(formatMoneyInput(event.target.value, 6))} />
              </Field>}
            </fieldset>
            <p className="mt-4 rounded-lg bg-muted p-3 font-semibold" aria-live="polite">Tổng giá trị: {formatMoney(total, currency)}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>Đóng</Button>
            <Button type="submit" disabled={pending}>{pending ? "Đang tạo…" : "Tạo hợp đồng"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
