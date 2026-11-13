"use client";

import { useState } from "react";
import {
  contractShipToOptions,
  createContractSchema,
  productAmounts,
  quoteAmount,
  shippingAmount,
  shippingInCurrency,
  sumByCurrency,
  type CrmLane,
  type QuoteCurrency,
  type QuoteNotes,
  type QuoteOrder,
  type SentQuote,
} from "@speego/shared";
import { InlineAlert } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSession } from "@/features/auth/session-provider";
import { ApiError, api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { crmPath } from "./lane";
import type { QuoteSheet } from "./types";

type QuoteSource = {
  id: string;
  code: string;
  customerName: string | null;
  companyName?: string | null;
  shipToAddress?: string | null;
  goods: string | null;
  orders: QuoteOrder[];
  notes: QuoteNotes;
  sentQuote?: SentQuote | null;
  logisticsSheet?: QuoteSheet | null;
  customerKind?: string | null;
  shippingMode?: "AIR" | "SEA" | null;
  logisticsClass?: string | null;
};

/** Mẫu đang chọn trên báo giá sourcing (hoặc mẫu đầu). */
function selectedOrder(orders: QuoteOrder[]): QuoteOrder | null {
  return orders.find((item) => item.selected) ?? orders[0] ?? null;
}

/** Tổng số lượng từ các dòng đơn hàng đã chọn. */
function orderQuantity(order: QuoteOrder | null): number | null {
  if (!order) return null;
  const values = order.lines.map((line) => line.quantity).filter((value): value is number => value != null);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

function productFromOrder(order: QuoteOrder | null, fallback: string | null): string {
  const names = [...new Set(order?.lines.map((line) => line.productName?.trim()).filter((name): name is string => Boolean(name)) ?? [])];
  return names.join(", ") || fallback?.trim() || order?.name || "";
}

function shipToFromQuote(address: string | null | undefined): string {
  const normalized = address?.trim().toLocaleLowerCase();
  return contractShipToOptions.find((option) => option.toLocaleLowerCase() === normalized) ?? "";
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
  const order = quote.sentQuote?.order ?? selectedOrder(quote.orders);
  const pureLogistics = quote.customerKind === "LOGISTICS";
  const sourceTotal = quoteAmount(quote, pureLogistics ? "logistics" : "sourcing");
  const currency = sourceTotal.currency as QuoteCurrency;
  const customerName = quote.customerName?.trim() || quote.companyName?.trim() || "";
  const product = productFromOrder(order, quote.goods);
  const quantity = orderQuantity(order);
  const productLines = pureLogistics ? [] : productAmounts(order);
  const productValue = pureLogistics ? 0 : productLines.find((item) => item.currency === currency)?.amount ?? sourceTotal.amount ?? 0;
  const logisticsSheet = quote.logisticsSheet?.sentQuote ? quote.logisticsSheet : null;
  const linkedShipping = pureLogistics ? shippingAmount(quote)
    : logisticsSheet ? shippingAmount({ ...logisticsSheet, shippingMode: quote.shippingMode, logisticsClass: quote.logisticsClass }) : { currency, amount: 0 };
  const shippingCost = linkedShipping?.amount ?? 0;
  const shippingCurrency = linkedShipping?.currency ?? currency;
  // Cước khác loại tiền chính thì quy đổi theo tỷ giá trên báo giá; thiếu tỷ giá thì giữ riêng từng loại tiền.
  const shippingInMain = linkedShipping == null ? null
    : shippingCurrency === currency ? shippingCost
    : logisticsSheet ? shippingInCurrency({ ...logisticsSheet, shippingMode: quote.shippingMode, logisticsClass: quote.logisticsClass }, { currency, rate: order?.rate ?? null }) : null;
  const totals = shippingInMain == null
    ? sumByCurrency([productLines.length > 0 ? productLines : [{ currency, amount: productValue }], linkedShipping ? [linkedShipping] : []])
    : [{ currency, amount: Math.round((productValue + shippingInMain) * 100) / 100 }];
  const totalValue = shippingInMain == null ? productValue : Math.round((productValue + shippingInMain) * 100) / 100;
  const shipTo = shipToFromQuote(quote.shipToAddress);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (linkedShipping == null) {
      setError("Chi phí vận chuyển trên báo giá chưa hợp lệ");
      return;
    }
    const parsed = createContractSchema.safeParse({
      currency,
      customerName,
      saleName: user.name,
      shipTo,
      product,
      quantity,
      productValue,
      shippingCost,
      totalValue,
      paidAmount: 0,
      signedOn: "",
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Thông tin báo giá chưa đủ để tạo hợp đồng");
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

  const facts: [string, string][] = [
    ["Mã báo giá", quote.code],
    ["Mẫu đơn hàng", order?.name || "—"],
    ["Khách hàng", customerName || "Chưa có tên khách hàng trong báo giá"],
    ["Sản phẩm", product || "—"],
    ["Số lượng", quantity == null ? "—" : String(quantity)],
    ["Tuyến vận chuyển", shipTo || "—"],
    ...(productLines.length > 0 ? productLines : [{ currency, amount: productValue }]).map((line) => [`Giá trị sản phẩm (${line.currency})`, formatMoney(line.amount, line.currency)] as [string, string]),
    ["Chi phí vận chuyển", !pureLogistics && !logisticsSheet ? "Chưa có báo giá Logistics · tạm tính 0" : linkedShipping == null ? "Chưa đủ dữ liệu" : formatMoney(shippingCost, shippingCurrency)],
    ...totals.map((line) => [`Tổng ${line.currency}`, formatMoney(line.amount, line.currency)] as [string, string]),
    ["Ngày ký", "Để trống đến khi ký"],
    ["Đã thanh toán", formatMoney(0, currency)],
  ];

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent className="z-[80] max-h-[92dvh] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Tạo hợp đồng từ báo giá · {quote.code}</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[min(68vh,680px)] gap-4 overflow-y-auto pr-1">
          {error && <InlineAlert>{error}</InlineAlert>}
          {linkedShipping == null && <InlineAlert>Chi phí vận chuyển trên báo giá chưa hợp lệ.</InlineAlert>}
          <InlineAlert>
            Thông tin khách hàng, sản phẩm, số lượng và giá trị được lấy từ báo giá. Ngày ký để trống; tiền đã thanh toán mặc định là 0 để cập nhật khi phát sinh.
          </InlineAlert>
          <dl className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
            {facts.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>Đóng</Button>
          <Button type="button" disabled={pending || linkedShipping == null} onClick={submit}>
            {pending ? "Đang tạo…" : "Tạo hợp đồng"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
