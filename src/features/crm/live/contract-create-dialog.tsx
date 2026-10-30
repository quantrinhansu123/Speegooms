"use client";

import { useState } from "react";
import { contractShipToOptions, createContractSchema, quoteCurrencies, type CrmLane, type QuoteCurrency, type QuoteOrder } from "@speego/shared";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSession } from "@/features/auth/session-provider";
import { ApiError, api } from "@/lib/api";
import { crmPath } from "./lane";
import type { QuoteSheet } from "./types";

type QuoteSource = {
  id: string;
  code: string;
  customerName: string | null;
  address: string | null;
  goods: string | null;
  orders: QuoteOrder[];
  logisticsSheet?: QuoteSheet | null;
};

/** Mẫu đang chọn trên báo giá sourcing (hoặc mẫu đầu). */
function selectedOrder(orders: QuoteOrder[]): QuoteOrder | null {
  return orders.find((item) => item.selected) ?? orders[0] ?? null;
}

function orderProductTotal(order: QuoteOrder | null): { total: number; currency: QuoteCurrency } {
  if (!order) return { total: 0, currency: "VND" };
  return { total: order.lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0), currency: order.currency };
}

/** Tổng số lượng từ các dòng đơn hàng đã chọn. */
function orderQuantity(order: QuoteOrder | null): number | null {
  if (!order) return null;
  const values = order.lines.map((line) => line.quantity).filter((value): value is number => value != null);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

function logisticsShippingTotal(sheet: QuoteSheet | null | undefined): number {
  if (!sheet) return 0;
  const order = selectedOrder(sheet.orders);
  if (!order) return 0;
  return order.lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0);
}

function numberValue(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ContractCreateDialog({
  lane,
  quote,
  onClose,
  onCreated,
}: {
  lane: CrmLane;
  quote: QuoteSource;
  onClose: () => void;
  onCreated: () => void;
}) {
  const user = useSession();
  const order = selectedOrder(quote.orders);
  const { total: productValue, currency: orderCurrency } = orderProductTotal(order);
  const linkedQty = orderQuantity(order);
  const linkedShipping = logisticsShippingTotal(quote.logisticsSheet);
  const [currency, setCurrency] = useState<QuoteCurrency>(orderCurrency);
  const [customerName, setCustomerName] = useState(quote.customerName ?? "");
  const [saleName, setSaleName] = useState(user.name);
  const [shipTo, setShipTo] = useState("");
  const [product, setProduct] = useState(quote.goods ?? "");
  const [quantity, setQuantity] = useState(linkedQty != null ? String(linkedQty) : "");
  const [productValueText, setProductValueText] = useState(productValue ? String(productValue) : "");
  const [shippingCost, setShippingCost] = useState(linkedShipping ? String(linkedShipping) : "");
  const [paidAmount, setPaidAmount] = useState("");
  const [signedOn, setSignedOn] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const syncTotal = (productText: string, shippingText: string) => {
    const productPart = numberValue(productText) ?? 0;
    const shippingPart = numberValue(shippingText) ?? 0;
    return String(productPart + shippingPart);
  };
  const totalValue = syncTotal(productValueText, shippingCost);

  const submit = async () => {
    const parsed = createContractSchema.safeParse({
      currency,
      customerName,
      saleName,
      shipTo,
      product,
      quantity: numberValue(quantity),
      productValue: numberValue(productValueText) ?? Number.NaN,
      shippingCost: numberValue(shippingCost) ?? 0,
      totalValue: numberValue(totalValue) ?? Number.NaN,
      paidAmount: numberValue(paidAmount) ?? 0,
      signedOn,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Thông tin hợp đồng chưa đúng");
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      await api(crmPath(`/api/crm/quotes/${quote.id}/contract`, lane), {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      onCreated();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không tạo được hợp đồng");
      setPending(false);
    }
  };

  const qtyHint = order
    ? `Lấy từ thông tin đơn hàng “${order.name}”: ${order.lines.filter((line) => line.quantity != null).map((line) => `${line.quantity}${line.unit ? ` ${line.unit}` : ""}`).join(" + ") || "chưa có số lượng"}`
    : "Chưa có mẫu đơn hàng trên báo giá";

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent className="z-[80] sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Tạo hợp đồng · {quote.code}</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          {error && <InlineAlert className="sm:col-span-2">{error}</InlineAlert>}
          <InlineAlert className="sm:col-span-2">
            Số lượng, giá trị hàng và phí vận chuyển được lấy sẵn từ báo giá / thông tin đơn hàng (có thể chỉnh trước khi tạo).
          </InlineAlert>
          <Field label="Tên khách hàng" htmlFor="contract-customer" required>
            <Input id="contract-customer" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
          </Field>
          <Field label="Nhân viên bán" htmlFor="contract-sale">
            <Input id="contract-sale" value={saleName} onChange={(event) => setSaleName(event.target.value)} />
          </Field>
          <Field label="Vận chuyển đến" htmlFor="contract-ship" className="sm:col-span-2">
            <NativeSelect id="contract-ship" value={shipTo} onChange={(event) => setShipTo(event.target.value)}>
              <option value="">Chọn tuyến vận chuyển</option>
              {contractShipToOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Sản phẩm" htmlFor="contract-product" className="sm:col-span-2" hint="Lấy từ hàng hóa trên báo giá">
            <Input id="contract-product" value={product} onChange={(event) => setProduct(event.target.value)} />
          </Field>
          <Field label="Số lượng" htmlFor="contract-qty" hint={qtyHint}>
            <Input id="contract-qty" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </Field>
          <Field label="Ngày ký" htmlFor="contract-signed">
            <Input id="contract-signed" type="date" value={signedOn} onChange={(event) => setSignedOn(event.target.value)} />
          </Field>
          <Field label="Loại tiền" htmlFor="contract-currency" hint="Lấy theo mẫu báo giá đang chọn, có thể đổi">
            <NativeSelect id="contract-currency" value={currency} onChange={(event) => setCurrency(event.target.value as QuoteCurrency)}>
              {quoteCurrencies.map((code) => <option key={code} value={code}>{code}{code === "VND" ? " (nội tệ)" : ""}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Giá trị sản phẩm" htmlFor="contract-product-value" hint="Tổng tiền hàng từ mẫu đơn đang chọn">
            <Input id="contract-product-value" inputMode="decimal" value={productValueText} onChange={(event) => setProductValueText(event.target.value)} />
          </Field>
          <Field
            label="Chi phí vận chuyển"
            htmlFor="contract-shipping"
            hint={quote.logisticsSheet ? "Lấy từ báo giá logistics (mẫu đang chọn)" : "Chưa có báo giá logistics — nhập tay nếu cần"}
          >
            <Input id="contract-shipping" inputMode="decimal" value={shippingCost} onChange={(event) => setShippingCost(event.target.value)} />
          </Field>
          <Field label="Tổng giá trị" htmlFor="contract-total" hint="Tự tính = giá trị sản phẩm + chi phí vận chuyển">
            <Input id="contract-total" inputMode="decimal" value={totalValue} readOnly />
          </Field>
          <Field label="Số tiền đã thanh toán" htmlFor="contract-paid">
            <Input id="contract-paid" inputMode="decimal" value={paidAmount} onChange={(event) => setPaidAmount(event.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>Đóng</Button>
          <Button type="button" disabled={pending} onClick={submit}>{pending ? "Đang tạo…" : "Tạo hợp đồng"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
