"use client";

import { useState } from "react";
import { convertMessageSchema, orderHasContent, updateQuoteSchema, type CrmLane, type UpdatePotentialInput, type UpdateQuoteInput } from "@speego/shared";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError, api } from "@/lib/api";
import { withShippingMetrics } from "./mess-form";
import { orderSummary } from "./order-summary";
import { crmPath } from "./lane";
import { QuoteEditor, quoteFieldsFromPotential } from "./quote-editor";
import { brandOptions, careChannelOptions, customerTypeOptions, type MessageRecord, type QuoteRecord } from "./types";

type Mode = "" | "AIR" | "SEA";
type ShipClass = "" | "LCL" | "FCL";
export type Details = { phone: string; brand: string; customerType: string; careChannel: string; productInterest: string; quantityNote: string; address: string; saleNote: string; requirements: string; packageDimensions: string; weightKg: string; shipToAddress: string; reason: string };
const detailsFrom = (row: MessageRecord): Details => ({ phone: row.phone ?? "", brand: "", customerType: row.customerType ?? "", careChannel: "", productInterest: row.goods ?? "", ...orderSummary(row.order), address: "", saleNote: row.note ?? "", requirements: [row.goods, row.painPoint, row.note].filter(Boolean).join("\n\n"), shipToAddress: "", reason: "" });

/**
 * Luồng chuyển mess thành khách tiềm năng: chọn đường bay/biển (Vận chuyển) → chuyển → tạo báo giá →
 * đưa nháp thông tin sản phẩm của mess sang báo giá → chuyển bàn Sourcing/Logistics nếu đủ thông tin.
 * Dùng chung cho nút Chuyển ở Mess và nút Tạo khách tiềm năng.
 */
export function useMessConvert({
  lane,
  load,
  error,
  setError,
  setNotice,
}: {
  lane: CrmLane;
  load: () => void;
  error?: string;
  setError: (message: string | undefined) => void;
  setNotice: (message: string | undefined) => void;
}) {
  const [convertPending, setConvertPending] = useState(false);
  const [converting, setConverting] = useState<{ row: MessageRecord; mode: Mode; logisticsClass: ShipClass; details: Details } | null>(null);
  const [orderQuote, setOrderQuote] = useState<QuoteRecord | null>(null);
  const [orderDesk, setOrderDesk] = useState<"sourcing" | "logistics">("logistics");
  const [orderPending, setOrderPending] = useState(false);
  const [orderError, setOrderError] = useState<string>();

  const openConvert = (row: MessageRecord, mode: Mode = "", logisticsClass: ShipClass = "") => {
    if (row.demand !== "SHIPPING" && row.demand !== "SOURCING") {
      setError("Chọn nhu cầu Tìm hàng hoặc Vận chuyển trước khi chuyển");
      return;
    }
    setConverting({ row, mode, logisticsClass, details: detailsFrom(row) });
  };

  /** Mess đã có nháp thông tin đơn hàng: đưa vào báo giá vừa tạo để Sale không phải nhập lại. */
  const prefillOrder = async (row: MessageRecord, quote: QuoteRecord, desk: "sourcing" | "logistics", shippingMode: "AIR" | "SEA" | null): Promise<QuoteRecord | null> => {
    if (!row.order || !orderHasContent(row.order)) return null;
    // Nháp nhập khi chưa chọn đường bay/biển nên cân và CBM từng dòng phải tính lại theo hệ số của phương thức vừa chọn.
    const order = shippingMode ? withShippingMetrics(row.order, shippingMode) : row.order;
    const parsed = updateQuoteSchema.safeParse({
      templateId: quote.templateId,
      opsNote: quote.opsNote ?? "",
      quoteStatus: quote.quoteStatus,
      contractStatus: quote.contractStatus,
      orders: [{ ...order, selected: true }],
      notes: quote.notes,
      bank: quote.bank,
    });
    if (!parsed.success) return null;
    const saved = await api<{ quote: QuoteRecord }>(crmPath(`/api/crm/quotes/${quote.id}?desk=${desk}&orderContent=1`, lane), {
      method: "PATCH",
      body: JSON.stringify(parsed.data),
    });
    return saved.quote;
  };

  /** Đã có đủ thông tin đơn hàng thì chuyển luôn; thiếu thì giữ bước báo giá mở sẵn với đơn đã điền để bổ sung. */
  const sendPrefilled = async (quote: QuoteRecord, desk: "sourcing" | "logistics") => {
    const path = desk === "sourcing" ? "handoff-sourcing" : "handoff-logistics";
    try {
      await api(crmPath(`/api/crm/quotes/${quote.id}/${path}`, lane), { method: "POST" });
      setOrderQuote(null);
      setNotice(desk === "sourcing" ? "Đã chuyển thông tin đơn hàng cho Sourcing" : "Đã chuyển thông tin đơn hàng cho Logistics");
    } catch (err: unknown) {
      setOrderError(err instanceof ApiError ? err.message : "Không chuyển được báo giá");
    }
  };

  /** Trả về true khi mess đã chuyển thành khách tiềm năng. */
  const convertWith = (row: MessageRecord, mode: Mode, logisticsClass: ShipClass, errorPrefix = "", details = detailsFrom(row)): Promise<boolean> => {
    const parsed = convertMessageSchema.safeParse({
      ...details, images: [],
      shippingMode: row.demand === "SHIPPING" ? mode || undefined : undefined,
      logisticsClass: row.demand === "SHIPPING" && mode === "SEA" ? logisticsClass || undefined : undefined,
    });
    if (row.demand === "SHIPPING" && (!mode || (mode === "SEA" && !logisticsClass))) {
      setError("Chọn đường bay hoặc đường biển và loại LCL/FCL nếu đi biển");
      return Promise.resolve(false);
    }
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      return Promise.resolve(false);
    }
    setError(undefined);
    setNotice(undefined);
    setOrderError(undefined);
    setConvertPending(true);
    return api<{ potential: { id: string } }>(crmPath(`/api/crm/messages/${row.id}/convert`, lane), {
      method: "POST",
      body: JSON.stringify(parsed.data),
    })
      .then((converted) => api<{ quote: QuoteRecord; desk?: "sourcing" | "logistics" }>(crmPath(`/api/crm/potentials/${converted.potential.id}/quotes`, lane), { method: "POST" }))
      .then(async (body) => {
        setConverting(null);
        const desk = body.desk ?? (row.demand === "SHIPPING" ? "logistics" : "sourcing");
        // Hàng biển FCL dùng form cước riêng nên không đưa nháp đơn hàng sang.
        const skipDraft = mode === "SEA" && logisticsClass === "FCL";
        const prefilled = skipDraft ? null : await prefillOrder(row, body.quote, desk, mode || null);
        setOrderDesk(desk);
        setOrderQuote(prefilled ?? body.quote);
        if (skipDraft && row.order && orderHasContent(row.order)) {
          setOrderError("Hàng biển FCL nhập ở form cước riêng nên thông tin sản phẩm đã nhập trên mess không được đưa sang. Hãy nhập lại ở đây.");
        }
        if (prefilled) await sendPrefilled(prefilled, desk);
        load();
        return true;
      })
      .catch((err: unknown) => {
        setError(errorPrefix + (err instanceof ApiError ? err.message : "Không chuyển được mess"));
        return false;
      })
      .finally(() => setConvertPending(false));
  };

  const saveOrderPart = (input: UpdateQuoteInput, orderContent: boolean) => {
    if (!orderQuote) return Promise.resolve(false);
    setOrderPending(true);
    setOrderError(undefined);
    const scope = orderContent ? "&orderContent=1" : "";
    return api<{ quote: QuoteRecord }>(crmPath(`/api/crm/quotes/${orderQuote.id}?desk=${orderDesk}${scope}`, lane), {
      method: "PATCH",
      body: JSON.stringify(input),
    })
      .then((body) => {
        setOrderQuote(body.quote);
        return true;
      })
      .catch((err: unknown) => {
        setOrderError(err instanceof ApiError ? err.message : "Không lưu được báo giá");
        return false;
      })
      .finally(() => setOrderPending(false));
  };

  const saveOrderLead = (input: UpdatePotentialInput) => {
    if (!orderQuote) return Promise.resolve(null);
    return api<{ potential: { requirementImages?: string[] } }>(crmPath(`/api/crm/potentials/${orderQuote.potentialId}`, lane), {
      method: "PATCH",
      body: JSON.stringify(input),
    })
      .then((body) => {
        const patch = quoteFieldsFromPotential(input, body.potential.requirementImages ?? input.requirementImages ?? []);
        setOrderQuote((current) => (current ? { ...current, ...patch } : current));
        return patch;
      })
      .catch((err: unknown) => {
        setOrderError(err instanceof ApiError ? err.message : "Không lưu được lưu ý");
        return null;
      });
  };

  const handoffOrder = (desk: "sourcing" | "logistics") => {
    if (!orderQuote) return Promise.resolve(false);
    setOrderPending(true);
    setOrderError(undefined);
    const path = desk === "sourcing" ? "handoff-sourcing" : "handoff-logistics";
    const done = desk === "sourcing" ? "Đã chuyển thông tin đơn hàng cho Sourcing" : "Đã chuyển thông tin đơn hàng cho Logistics";
    return api(crmPath(`/api/crm/quotes/${orderQuote.id}/${path}`, lane), { method: "POST" })
      .then(() => {
        setOrderQuote(null);
        setNotice(done);
        load();
        return true;
      })
      .catch((err: unknown) => {
        setOrderError(err instanceof ApiError ? err.message : "Không chuyển được báo giá");
        return false;
      })
      .finally(() => setOrderPending(false));
  };

  const dialogs = (
    <>
      <Dialog open={converting !== null} onOpenChange={(open) => { if (!open && !convertPending) setConverting(null); }}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Chuyển sang khách tiềm năng</DialogTitle></DialogHeader>
          {converting && <div className="grid gap-3 sm:grid-cols-2">
            {([['phone', 'Số điện thoại'], ['productInterest', 'Hàng hóa'], ['quantityNote', 'Số lượng'], ['address', 'Địa chỉ'], ['saleNote', 'Ghi chú sale']] as const).map(([key, label]) => <Field key={key} label={label} htmlFor={`convert-${key}`} required><Input id={`convert-${key}`} value={converting.details[key]} onChange={(event) => setConverting({ ...converting, details: { ...converting.details, [key]: event.target.value } })} /></Field>)}
            {([['brand', 'Nguồn', brandOptions], ['customerType', 'Đối tượng', customerTypeOptions], ['careChannel', 'Kênh chăm sóc', careChannelOptions]] as const).map(([key, label, options]) => <Field key={key} label={label} htmlFor={`convert-${key}`} required><NativeSelect id={`convert-${key}`} value={converting.details[key]} onChange={(event) => setConverting({ ...converting, details: { ...converting.details, [key]: event.target.value } })}><option value="">Chưa chọn</option>{options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</NativeSelect></Field>)}
            <Field label="Yêu cầu của khách" htmlFor="convert-requirements" required className="sm:col-span-2"><Textarea id="convert-requirements" value={converting.details.requirements} onChange={(event) => setConverting({ ...converting, details: { ...converting.details, requirements: event.target.value } })} /></Field>
            {converting.row.demand === 'SHIPPING' && <>
              {([['weightKg', 'Trọng lượng'], ['shipToAddress', 'Địa chỉ nhận hàng'], ['reason', 'Lý do chuyển']] as const).map(([key, label]) => <Field key={key} label={label} htmlFor={`convert-${key}`} required><Input id={`convert-${key}`} value={converting.details[key]} onChange={(event) => setConverting({ ...converting, details: { ...converting.details, [key]: event.target.value } })} /></Field>)}
              {converting.logisticsClass !== 'FCL' && <Field label="Kích thước kiện hàng" htmlFor="convert-dimensions" required><Input id="convert-dimensions" value={converting.details.packageDimensions} onChange={(event) => setConverting({ ...converting, details: { ...converting.details, packageDimensions: event.target.value } })} /></Field>}
            </>}
          </div>}
          {converting?.row.demand === "SHIPPING" && (
            <div className="grid gap-4">
              <Field label="Phương thức vận chuyển" htmlFor="convert-mode" required>
                <NativeSelect id="convert-mode" value={converting.mode} onChange={(event) => setConverting({ ...converting, mode: event.target.value as "AIR" | "SEA", logisticsClass: "" })}>
                  <option value="">Chọn phương thức</option><option value="AIR">Đường bay</option><option value="SEA">Đường biển</option>
                </NativeSelect>
              </Field>
              {converting.mode === "SEA" && <Field label="Hình thức hàng biển" htmlFor="convert-class" required>
                <NativeSelect id="convert-class" value={converting.logisticsClass} onChange={(event) => setConverting({ ...converting, logisticsClass: event.target.value as "LCL" | "FCL" })}>
                  <option value="">Chọn LCL/FCL</option><option value="LCL">LCL</option><option value="FCL">FCL</option>
                </NativeSelect>
              </Field>}
              <p className="text-sm text-muted-foreground">Cân thể tích: D × R × C (cm) / {converting.mode === "AIR" ? "5000" : "6000"}.</p>
            </div>
          )}
          {error && <InlineAlert>{error}</InlineAlert>}
          <DialogFooter>
            <Button variant="outline" disabled={convertPending} onClick={() => setConverting(null)}>Hủy</Button>
            <Button disabled={convertPending} onClick={() => { if (converting) void convertWith(converting.row, converting.mode, converting.logisticsClass, "", converting.details); }}>{convertPending ? "Đang chuyển…" : "Chuyển"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {orderQuote && (
        <QuoteEditor
          key={orderQuote.id}
          quote={orderQuote}
          templates={[]}
          editMode="content"
          desk={orderDesk}
          saleOrder
          quoteStep
          pending={orderPending}
          error={orderError}
          onClose={() => setOrderQuote(null)}
          onSave={(input) => saveOrderPart(input, true)}
          onSaveSale={saveOrderLead}
          onHandoffLogistics={orderQuote.customerKind === "LOGISTICS" ? () => handoffOrder("logistics") : undefined}
          onHandoffSourcing={orderQuote.customerKind === "SOURCING" ? () => handoffOrder("sourcing") : undefined}
        />
      )}
    </>
  );

  return { openConvert, convertWith, convertPending, dialogs };
}
