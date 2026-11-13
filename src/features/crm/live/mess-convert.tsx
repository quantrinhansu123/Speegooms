"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { convertMessageSchema, orderHasContent, updateQuoteSchema, type CrmLane, type QuoteOrder, type UpdatePotentialInput, type UpdateQuoteInput } from "@speego/shared";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError, api } from "@/lib/api";
import { orderLineCount, withShippingMetrics } from "./mess-form";
import { orderSummary } from "./order-summary";
import { PhoneInput } from "./phone-input";
import { crmPath } from "./lane";
import { MessOrderDialog, QuoteEditor, quoteFieldsFromPotential } from "./quote-editor";
import { brandOptions, careChannelOptions, customerTypeOptions, type MessageRecord, type QuoteRecord } from "./types";
import { zodFieldErrors } from "@/lib/zod-errors";
import { useSession } from "@/features/auth/session-provider";
import { CrmHandoverField } from "./crm-handover-field";

type Mode = "" | "AIR" | "SEA";
type ShipClass = "" | "LCL" | "FCL";
export type Details = { phone: string; brand: string; customerType: string; careChannel: string; productInterest: string; quantityNote: string; address: string; saleNote: string; requirements: string; shipToAddress: string; reason: string };
/** Trường của schema chuyển khách tiềm năng → id ô trong hộp thoại Chuyển. */
const convertFieldIds: Record<string, string> = {
  phone: "convert-phone", brand: "convert-brand", customerType: "convert-customerType", careChannel: "convert-careChannel",
  productInterest: "convert-productInterest", quantityNote: "convert-quantityNote", address: "convert-address",
  saleNote: "convert-saleNote", requirements: "convert-requirements",
  shipToAddress: "convert-shipToAddress", reason: "convert-reason",
  shippingMode: "convert-mode", logisticsClass: "convert-class",
};
const detailsFrom = (row: MessageRecord): Details => ({ phone: row.phone ?? "", brand: row.brand ?? "", customerType: row.customerType ?? "", careChannel: "", productInterest: row.goods ?? "", quantityNote: orderSummary(row.order).quantityNote, address: "", saleNote: row.note ?? "", requirements: [row.goods, row.painPoint, row.note].filter(Boolean).join("\n\n"), shipToAddress: "", reason: "" });

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
  const user = useSession();
  const [handlerId, setHandlerId] = useState("");
  const [convertPending, setConvertPending] = useState(false);
  const [converting, setConverting] = useState<{ row: MessageRecord; mode: Mode; logisticsClass: ShipClass; details: Details; order: QuoteOrder | null } | null>(null);
  const [orderDialog, setOrderDialog] = useState(false);
  const [orderQuote, setOrderQuote] = useState<QuoteRecord | null>(null);
  const [orderDesk, setOrderDesk] = useState<"sourcing" | "logistics">("logistics");
  const [orderPending, setOrderPending] = useState(false);
  const [orderError, setOrderError] = useState<string>();
  /** Lỗi theo từng ô của hộp thoại chuyển (id ô → thông báo), báo đỏ ngay dưới ô. */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const openConvert = (row: MessageRecord, mode: Mode = "", logisticsClass: ShipClass = "") => {
    if (row.demand !== "SHIPPING" && row.demand !== "SOURCING") {
      setError("Chọn nhu cầu Tìm hàng hoặc Vận chuyển trước khi chuyển");
      return;
    }
    setFieldErrors({});
    setOrderDialog(false);
    setHandlerId("");
    setConverting({ row, mode, logisticsClass, details: detailsFrom(row), order: row.order });
  };

  /** Đơn nhập trong hộp thoại chuyển (hoặc nháp đã lưu trên mess): đưa vào báo giá vừa tạo để Sale không phải nhập lại. */
  const prefillOrder = async (draft: QuoteOrder | null, quote: QuoteRecord, desk: "sourcing" | "logistics", shippingMode: "AIR" | "SEA" | null): Promise<QuoteRecord | null> => {
    if (!draft || !orderHasContent(draft)) return null;
    // Nháp nhập khi chưa chọn đường bay/biển nên cân và CBM từng dòng phải tính lại theo hệ số của phương thức vừa chọn.
    const order = shippingMode ? withShippingMetrics(draft, shippingMode) : draft;
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
  const convertWith = (row: MessageRecord, mode: Mode, logisticsClass: ShipClass, errorPrefix = "", details = detailsFrom(row), order: QuoteOrder | null = row.order): Promise<boolean> => {
    const parsed = convertMessageSchema.safeParse({
      ...details, images: [],
      handlerId: handlerId || undefined,
      // Nguồn lấy theo mess; chỉ gửi khi mess chưa có nguồn.
      brand: details.brand || undefined,
      // Đơn Sourcing không nhập Số lượng ở bước chuyển (số lượng nằm trên từng dòng hàng).
      quantityNote: row.demand === "SHIPPING" ? details.quantityNote : "",
      shippingMode: row.demand === "SHIPPING" ? mode || undefined : undefined,
      logisticsClass: row.demand === "SHIPPING" && mode === "SEA" ? logisticsClass || undefined : undefined,
    });
    /** Gom lỗi Zod và lỗi chọn phương thức theo từng ô để báo đỏ cùng lúc. */
    const errors: Record<string, string> = parsed.success ? {} : zodFieldErrors(parsed.error, convertFieldIds);
    if (!details.brand) errors["convert-brand"] = "Chọn nguồn";
    if (row.demand === "SHIPPING" && !mode) errors["convert-mode"] = "Chọn đường bay hoặc đường biển";
    if (row.demand === "SHIPPING" && mode === "SEA" && !logisticsClass) errors["convert-class"] = "Chọn LCL hoặc FCL";
    if (!parsed.success || Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError(undefined);
      return Promise.resolve(false);
    }
    setFieldErrors({});
    setError(undefined);
    setNotice(undefined);
    setOrderError(undefined);
    setConvertPending(true);
    return api<{ potential: { id: string } }>(crmPath(`/api/crm/messages/${row.id}/convert`, lane), {
      method: "POST",
      body: JSON.stringify(parsed.data),
    })
      .then((converted) => {
        if (handlerId && handlerId !== user.id) {
          setConverting(null);
          setNotice("Đã chuyển thành khách tiềm năng và bàn giao cho Sale nhận tiếp tục xử lý.");
          load();
          return null;
        }
        return api<{ quote: QuoteRecord; desk?: "sourcing" | "logistics" }>(crmPath(`/api/crm/potentials/${converted.potential.id}/quotes`, lane), { method: "POST" });
      })
      .then(async (body) => {
        if (!body) return true;
        setConverting(null);
        const desk = body.desk ?? (row.demand === "SHIPPING" ? "logistics" : "sourcing");
        // FCL dùng form cước riêng; vẫn mang hàng bảo hiểm sang để giữ giá trị khai báo.
        const skipDraft = mode === "SEA" && logisticsClass === "FCL" && order?.insurance !== true;
        const prefilled = skipDraft ? null : await prefillOrder(order, body.quote, desk, mode || null);
        setOrderDesk(desk);
        setOrderQuote(prefilled ?? body.quote);
        if (skipDraft && order && orderHasContent(order)) {
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
      <Dialog open={converting !== null} onOpenChange={(open) => { if (!open && !convertPending) { setOrderDialog(false); setConverting(null); } }}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Chuyển sang khách tiềm năng</DialogTitle></DialogHeader>
          {converting && <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Số điện thoại" htmlFor="convert-phone" error={fieldErrors["convert-phone"]} required><PhoneInput id="convert-phone" value={converting.details.phone} onChange={(phone) => setConverting({ ...converting, details: { ...converting.details, phone } })} /></Field>
            {([['productInterest', 'Hàng hóa'], ['quantityNote', 'Số lượng'], ['address', 'Địa chỉ gửi hàng'], ['saleNote', 'Ghi chú sale']] as const).filter(([key]) => key !== 'quantityNote' || converting.row.demand === 'SHIPPING').map(([key, label]) => <Field key={key} label={label} htmlFor={`convert-${key}`} error={fieldErrors[`convert-${key}`]} required={key !== "address"}><Input id={`convert-${key}`} value={converting.details[key]} onChange={(event) => setConverting({ ...converting, details: { ...converting.details, [key]: event.target.value } })} /></Field>)}
            <div className="sm:col-span-2"><CrmHandoverField id="convert-handler" lane={lane} value={handlerId} onChange={setHandlerId} disabled={convertPending} /></div>
            {([['brand', 'Nguồn', brandOptions], ['customerType', 'Đối tượng', customerTypeOptions], ['careChannel', 'Kênh chăm sóc', careChannelOptions]] as const).map(([key, label, options]) => <Field key={key} label={label} htmlFor={`convert-${key}`} error={fieldErrors[`convert-${key}`]} required hint={key === 'brand' && converting.row.brand ? 'Lấy theo Nguồn trên mess' : undefined}><NativeSelect id={`convert-${key}`} disabled={key === 'brand' && Boolean(converting.row.brand)} value={converting.details[key]} onChange={(event) => setConverting({ ...converting, details: { ...converting.details, [key]: event.target.value } })}><option value="">Chưa chọn</option>{options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</NativeSelect></Field>)}
            <Field label="Yêu cầu của khách" htmlFor="convert-requirements" error={fieldErrors["convert-requirements"]} required className="sm:col-span-2"><Textarea id="convert-requirements" value={converting.details.requirements} onChange={(event) => setConverting({ ...converting, details: { ...converting.details, requirements: event.target.value } })} /></Field>
            <div className="grid gap-2 rounded-lg border p-3 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Thông tin đơn hàng</p>
                  <p className="text-sm text-muted-foreground">
                    {orderLineCount(converting.order) > 0
                      ? `Đã nhập ${orderLineCount(converting.order)} dòng hàng. Bấm Chuyển sẽ đưa đơn này sang báo giá.`
                      : converting.row.demand === "SOURCING"
                        ? "Tìm hàng: nhập mặt hàng, hình ảnh, số lượng, quy cách và lưu ý. Không nhập giá và đóng gói."
                        : "Vận chuyển: nhập mặt hàng, số lượng, đơn vị và cân. Quy cách đóng gói có thể bổ sung ở bước báo giá."}
                  </p>
                </div>
                <div className="flex gap-2">
                  {orderLineCount(converting.order) > 0 && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setConverting({ ...converting, order: null })}>Xóa</Button>
                  )}
                  {converting.logisticsClass !== "FCL" && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setOrderDialog(true)}>
                      <Plus /> {orderLineCount(converting.order) > 0 ? "Sửa thông tin đơn hàng" : "Tạo thông tin đơn hàng"}
                    </Button>
                  )}
                </div>
              </div>
              {converting.row.demand === "SHIPPING" && converting.logisticsClass === "FCL" && (
                <p className="text-xs text-muted-foreground">Hàng biển FCL nhập ở form cước riêng trên bước báo giá, nên không nhập đơn hàng ở bước này.</p>
              )}
            </div>
            {converting.row.demand === 'SHIPPING' && <>
              {([['shipToAddress', 'Địa chỉ nhận hàng'], ['reason', 'Lý do chuyển']] as const).map(([key, label]) => <Field key={key} label={label} htmlFor={`convert-${key}`} error={fieldErrors[`convert-${key}`]} required><Input id={`convert-${key}`} value={converting.details[key]} onChange={(event) => setConverting({ ...converting, details: { ...converting.details, [key]: event.target.value } })} /></Field>)}
            </>}
          </div>}
          {converting?.row.demand === "SHIPPING" && (
            <div className="grid gap-4">
              <Field label="Phương thức vận chuyển" htmlFor="convert-mode" error={fieldErrors["convert-mode"]} required>
                <NativeSelect id="convert-mode" value={converting.mode} onChange={(event) => setConverting({ ...converting, mode: event.target.value as "AIR" | "SEA", logisticsClass: "" })}>
                  <option value="">Chọn phương thức</option><option value="AIR">Đường bay</option><option value="SEA">Đường biển</option>
                </NativeSelect>
              </Field>
              {converting.mode === "SEA" && <Field label="Hình thức hàng biển" htmlFor="convert-class" error={fieldErrors["convert-class"]} required>
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
            <Button disabled={convertPending} onClick={() => { if (converting) void convertWith(converting.row, converting.mode, converting.logisticsClass, "", converting.details, converting.order); }}>{convertPending ? "Đang chuyển…" : "Chuyển"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {orderDialog && converting && (
        <MessOrderDialog
          demand={converting.row.demand === "SOURCING" ? "SOURCING" : "SHIPPING"}
          order={converting.order}
          onClose={() => setOrderDialog(false)}
          onSave={(order) => {
            const summary = orderSummary(order);
            setConverting((current) => current ? {
              ...current,
              order,
              details: {
                ...current.details,
                quantityNote: current.details.quantityNote || summary.quantityNote,
              },
            } : current);
            setOrderDialog(false);
          }}
        />
      )}

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
