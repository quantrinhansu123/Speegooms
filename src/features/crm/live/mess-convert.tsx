"use client";

import { useState } from "react";
import { convertMessageSchema, orderHasContent, updateQuoteSchema, type CrmLane, type UpdatePotentialInput, type UpdateQuoteInput } from "@speego/shared";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError, api } from "@/lib/api";
import { withShippingMetrics } from "./mess-form";
import { crmPath } from "./lane";
import { QuoteEditor, quoteFieldsFromPotential } from "./quote-editor";
import type { MessageRecord, QuoteRecord } from "./types";

type Mode = "" | "AIR" | "SEA";
type ShipClass = "" | "LCL" | "FCL";

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
  const [converting, setConverting] = useState<{ row: MessageRecord; mode: Mode; logisticsClass: ShipClass } | null>(null);
  const [orderQuote, setOrderQuote] = useState<QuoteRecord | null>(null);
  const [orderDesk, setOrderDesk] = useState<"sourcing" | "logistics">("logistics");
  const [orderPending, setOrderPending] = useState(false);
  const [orderError, setOrderError] = useState<string>();

  const openConvert = (row: MessageRecord) => {
    if (row.demand !== "SHIPPING" && row.demand !== "SOURCING") {
      setError("Chọn nhu cầu Tìm hàng hoặc Vận chuyển trước khi chuyển");
      return;
    }
    setConverting({ row, mode: "", logisticsClass: "" });
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
  const convertWith = (row: MessageRecord, mode: Mode, logisticsClass: ShipClass, errorPrefix = ""): Promise<boolean> => {
    const requirements = [row.goods, row.painPoint, row.note].filter(Boolean).join("\n\n") || `Chuyển từ mess ${row.messCode}`;
    const parsed = convertMessageSchema.safeParse({
      requirements, images: [], reason: "",
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
        <DialogContent>
          <DialogHeader><DialogTitle>Chuyển sang khách tiềm năng</DialogTitle></DialogHeader>
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
            <Button disabled={convertPending} onClick={() => { if (converting) void convertWith(converting.row, converting.mode, converting.logisticsClass); }}>{convertPending ? "Đang chuyển…" : "Chuyển"}</Button>
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
