"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { convertMessageSchema, createMessageSchema, industryCategoryOptions, orderHasContent, updateMessageSchema, updateQuoteSchema, type CrmLane, type IndustryCategory, type QuoteOrder, type UpdatePotentialInput, type UpdateQuoteInput } from "@speego/shared";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/features/auth/session-provider";
import { ApiError, api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Role } from "@/types/role";
import { useExcelImport } from "./excel-import";
import { crmPath, LaneSwitch, useCrmLane } from "./lane";
import { dateRangeError, FilterSelect, ListSearchBar, searchParams, useAppliedSearch } from "./list-search-bar";
import { MessOrderDialog, QuoteEditor, quoteFieldsFromPotential } from "./quote-editor";
import { RowMenu } from "./row-menu";
import { TableHScroll } from "./table-h-scroll";
import { CustomerTypeBadge, DemandBadge, HeatBadge, MessageStatusBadge } from "./status-badges";
import { customerTypeOptions, demandOptions, labelOf, messageClassificationOptions, messageStatusLabels, type MessageRecord, type QuoteRecord } from "./types";

const writeRoles: Role[] = ["admin", "marketing", "sale-vn", "sale-global"];
const convertRoles: Role[] = ["admin", "sale-vn", "sale-global"];

const marketPresets = ["Mỹ", "Úc", "Canada", "Anh", "Đức", "Pháp", "Nhật", "Hàn", "Singapore", "Thái Lan"];

type Classification = "" | "HOT" | "WARM" | "COLD" | "DEAD";

function uniqueSuggestions(values: Array<string | null | undefined>, presets: string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of [...presets, ...values]) {
    const trimmed = value?.trim() ?? "";
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

type MessDraft = {
  receivedOn: string;
  customerName: string;
  phone: string;
  email: string;
  market: string;
  classification: Classification;
  customerType: "" | "INDIVIDUAL" | "PRINCIPAL" | "ENTERPRISE";
  demand: "" | "SHIPPING" | "SOURCING";
  goods: string;
  industry: "" | IndustryCategory;
  saleName: string;
  painPoint: string;
  linkMess: string;
  note: string;
  /** Nháp thông tin sản phẩm/đơn hàng (Sale nhập, không bắt buộc). */
  order: QuoteOrder | null;
};

const emptyDraft: MessDraft = {
  receivedOn: "",
  customerName: "",
  phone: "",
  email: "",
  market: "",
  classification: "",
  customerType: "",
  demand: "",
  goods: "",
  industry: "",
  saleName: "",
  painPoint: "",
  linkMess: "",
  note: "",
  order: null,
};

function todayInput(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

function dateInputFromIso(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(date);
}

function isClassification(value: string | null): value is Exclude<Classification, ""> {
  return messageClassificationOptions.some((item) => item[0] === value);
}

function isIndustryCategory(value: string | null): value is IndustryCategory {
  return industryCategoryOptions.some(([option]) => option === value);
}

function draftFrom(row: MessageRecord): MessDraft {
  return {
    receivedOn: dateInputFromIso(row.receivedAt),
    customerName: row.customerName ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    market: row.market ?? "",
    classification: isClassification(row.classification) ? row.classification : "",
    customerType: row.customerType === "INDIVIDUAL" || row.customerType === "PRINCIPAL" || row.customerType === "ENTERPRISE" ? row.customerType : "",
    demand: row.demand === "SHIPPING" || row.demand === "SOURCING" ? row.demand : "",
    goods: row.goods ?? "",
    industry: isIndustryCategory(row.industry) ? row.industry : "",
    saleName: row.saleName ?? "",
    painPoint: row.painPoint ?? "",
    linkMess: row.linkMess ?? "",
    note: row.note ?? "",
    order: row.order ?? null,
  };
}

/** Số dòng hàng đã nhập trong nháp đơn hàng. */
function orderLineCount(order: QuoteOrder | null): number {
  return order ? order.lines.filter((line) => line.productName?.trim()).length : 0;
}

export function MessView({ lane: fixedLane }: { lane?: CrmLane }) {
  const user = useSession();
  const { lane, canPick, setLane } = useCrmLane(fixedLane);
  const canWrite = writeRoles.includes(user.role);
  const canConvert = convertRoles.includes(user.role);
  const [rows, setRows] = useState<MessageRecord[]>([]);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [draft, setDraft] = useState<MessDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState<MessageRecord | null>(null);
  const [knownMarkets, setKnownMarkets] = useState<string[]>(marketPresets);
  const [convertPending, setConvertPending] = useState(false);
  const [converting, setConverting] = useState<{ row: MessageRecord; mode: "" | "AIR" | "SEA"; logisticsClass: "" | "LCL" | "FCL" } | null>(null);
  const [orderQuote, setOrderQuote] = useState<QuoteRecord | null>(null);
  const [orderDesk, setOrderDesk] = useState<"sourcing" | "logistics">("logistics");
  const [orderDialog, setOrderDialog] = useState(false);
  const [orderPending, setOrderPending] = useState(false);
  const [orderError, setOrderError] = useState<string>();
  const filters = useAppliedSearch({ q: "", from: "", to: "", status: "", classification: "", demand: "", customerType: "", market: "" });

  const load = useCallback(() => {
    const rangeError = dateRangeError(filters.applied.from, filters.applied.to);
    if (rangeError) {
      setError(rangeError);
      return;
    }
    setError(undefined);
    const query = searchParams(filters.applied, {
      status: filters.applied.status,
      classification: filters.applied.classification,
      demand: filters.applied.demand,
      customerType: filters.applied.customerType,
      market: filters.applied.market,
    });
    api<{ messages: MessageRecord[] }>(`${crmPath("/api/crm/messages", lane)}${query}`)
      .then((body) => {
        setRows(body.messages);
        setKnownMarkets((current) => uniqueSuggestions([...current, ...body.messages.map((row) => row.market)]));
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tải được mess"));
  }, [filters.applied, lane]);

  const excel = useExcelImport({ kind: "messages", lane, allLanes: canPick, enabled: canWrite, onDone: load });

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setKnownMarkets(marketPresets);
  }, [lane]);

  const marketOptions = uniqueSuggestions([...knownMarkets, ...rows.map((row) => row.market)], marketPresets)
    .map((market) => [market, market] as const);
  const goodsOptions = uniqueSuggestions(rows.map((row) => row.goods));

  const openCreate = () => {
    setEditingId(null);
    setFormError(undefined);
    setDraft({ ...emptyDraft, receivedOn: todayInput(), saleName: user.name });
  };

  const save = () => {
    if (!draft) return;
    const payload = {
      ...draft,
      saleName: editingId ? draft.saleName : user.name,
      receivedOn: draft.receivedOn || undefined,
      demand: draft.demand || undefined,
      industry: draft.industry || undefined,
      customerType: draft.customerType || undefined,
      classification: draft.classification || undefined,
      // Chỉ Sale/Admin ghi nháp đơn hàng; vai trò khác không gửi để server giữ nguyên nháp cũ.
      order: canConvert ? draft.order : undefined,
    };
    const parsed = (editingId ? updateMessageSchema : createMessageSchema).safeParse(payload);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      return;
    }
    setPending(true);
    setFormError(undefined);
    const request = editingId
      ? api(crmPath(`/api/crm/messages/${editingId}`, lane), { method: "PATCH", body: JSON.stringify(parsed.data) })
      : api(crmPath("/api/crm/messages", lane), { method: "POST", body: JSON.stringify(parsed.data) });
    void request
      .then(() => {
        setDraft(null);
        load();
      })
      .catch((err: unknown) => setFormError(err instanceof ApiError ? err.message : "Không lưu được mess"))
      .finally(() => setPending(false));
  };

  const openConvert = (row: MessageRecord) => {
    if (row.demand !== "SHIPPING" && row.demand !== "SOURCING") {
      setError("Chọn nhu cầu Tìm hàng hoặc Vận chuyển trước khi chuyển");
      return;
    }
    setConverting({ row, mode: "", logisticsClass: "" });
  };

  const convert = () => {
    if (!converting) return;
    const { row, mode, logisticsClass } = converting;
    const requirements = [row.goods, row.painPoint, row.note].filter(Boolean).join("\n\n") || `Chuyển từ mess ${row.messCode}`;
    const parsed = convertMessageSchema.safeParse({
      requirements, images: [], reason: "",
      shippingMode: row.demand === "SHIPPING" ? mode || undefined : undefined,
      logisticsClass: row.demand === "SHIPPING" && mode === "SEA" ? logisticsClass || undefined : undefined,
    });
    if (row.demand === "SHIPPING" && (!mode || (mode === "SEA" && !logisticsClass))) {
      setError("Chọn đường bay hoặc đường biển và loại LCL/FCL nếu đi biển");
      return;
    }
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      return;
    }
    setError(undefined);
    setNotice(undefined);
    setOrderError(undefined);
    setConvertPending(true);
    void api<{ potential: { id: string } }>(crmPath(`/api/crm/messages/${row.id}/convert`, lane), {
      method: "POST",
      body: JSON.stringify(parsed.data),
    })
      .then((converted) => api<{ quote: QuoteRecord; desk?: "sourcing" | "logistics" }>(crmPath(`/api/crm/potentials/${converted.potential.id}/quotes`, lane), { method: "POST" }))
      .then(async (body) => {
        setConverting(null);
        const desk = body.desk ?? (row.demand === "SHIPPING" ? "logistics" : "sourcing");
        // Hàng biển FCL dùng form cước riêng nên không đưa nháp đơn hàng sang.
        const skipDraft = mode === "SEA" && logisticsClass === "FCL";
        const prefilled = skipDraft ? null : await prefillOrder(row, body.quote, desk);
        setOrderDesk(desk);
        setOrderQuote(prefilled ?? body.quote);
        if (prefilled) await sendPrefilled(prefilled, desk);
        load();
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không chuyển được mess"))
      .finally(() => setConvertPending(false));
  };

  /** Mess đã có nháp thông tin đơn hàng: đưa vào báo giá vừa tạo để Sale không phải nhập lại. */
  const prefillOrder = async (row: MessageRecord, quote: QuoteRecord, desk: "sourcing" | "logistics"): Promise<QuoteRecord | null> => {
    if (!row.order || !orderHasContent(row.order)) return null;
    const parsed = updateQuoteSchema.safeParse({
      templateId: quote.templateId,
      opsNote: quote.opsNote ?? "",
      quoteStatus: quote.quoteStatus,
      contractStatus: quote.contractStatus,
      orders: [{ ...row.order, selected: true }],
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
        return true;
      })
      .catch((err: unknown) => {
        setOrderError(err instanceof ApiError ? err.message : "Không chuyển được báo giá");
        return false;
      })
      .finally(() => setOrderPending(false));
  };

  const remove = () => {
    if (!removing) return;
    const id = removing.id;
    setRemoving(null);
    void api(crmPath(`/api/crm/messages/${id}`, lane), { method: "DELETE" })
      .then(load)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không xóa được mess"));
  };

  return (
    <>
      <PageHeader
        title="Mess"
        description={lane === "vn" ? "Mess tuyến Việt Nam. Sale chuyển mess thành khách hàng tiềm năng." : "Mess tuyến Global. Sale chuyển mess thành khách hàng tiềm năng."}
        actions={
          <>
            {canPick && <LaneSwitch lane={lane} onChange={setLane} />}
            {excel.buttons}
            {canWrite && <Button onClick={openCreate}><Plus /> Tạo mess</Button>}
          </>
        }
      />
      {error && <InlineAlert className="mb-4">{error}</InlineAlert>}
      {notice && <InlineAlert tone="success" className="mb-4">{notice}</InlineAlert>}
      {excel.banner}
      <ListSearchBar
        q={filters.draft.q}
        from={filters.draft.from}
        to={filters.draft.to}
        onQ={(value) => filters.set("q", value)}
        onFrom={(value) => filters.set("from", value)}
        onTo={(value) => filters.set("to", value)}
        onSearch={filters.search}
        onReset={filters.reset}
        dateLabel="Từ ngày"
      >
        <FilterSelect id="mess-classification" label="Phân loại" value={filters.draft.classification} onChange={(value) => filters.set("classification", value)} options={messageClassificationOptions} />
        <FilterSelect id="mess-market" label="Thị trường" value={filters.draft.market} onChange={(value) => filters.set("market", value)} options={marketOptions} />
        <FilterSelect id="mess-demand" label="Nhu cầu" value={filters.draft.demand} onChange={(value) => filters.set("demand", value)} options={demandOptions} />
        <FilterSelect id="mess-customer-type" label="Đối tượng" value={filters.draft.customerType} onChange={(value) => filters.set("customerType", value)} options={customerTypeOptions} />
        <FilterSelect id="mess-status" label="Trạng thái" value={filters.draft.status} onChange={(value) => filters.set("status", value)} options={Object.entries(messageStatusLabels)} />
      </ListSearchBar>
      <TableHScroll stickyIdentity>
        <table className="w-full min-w-[1800px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="whitespace-nowrap px-3 py-2 font-medium">Mã</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Tên khách</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Ngày</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Thị trường</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Phân loại</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Đối tượng</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Nhu cầu</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Hàng hóa</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Ngành hàng</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Sales - hot & warm</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Pain-Point của KH</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Link mess</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Ghi chú Sale</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Trạng thái</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={15} className="px-3 py-8 text-center text-muted-foreground">{filters.active ? "Không có kết quả." : "Chưa có mess."}</td></tr>}
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-3 py-3 font-medium">{row.messCode}</td>
                <td className="px-3 py-3" title={row.customerName ?? undefined}>{row.customerName}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.receivedAt ? formatDate(dateInputFromIso(row.receivedAt)) : "—"}</td>
                <td className="px-3 py-3">{row.market || "—"}</td>
                <td className="px-3 py-3"><HeatBadge value={row.classification} /></td>
                <td className="px-3 py-3"><CustomerTypeBadge value={row.customerType} /></td>
                <td className="px-3 py-3"><DemandBadge value={row.demand} /></td>
                <td className="px-3 py-3">{row.goods || "—"}</td>
                <td className="max-w-56 truncate px-3 py-3" title={labelOf(industryCategoryOptions, row.industry)}>{labelOf(industryCategoryOptions, row.industry)}</td>
                <td className="px-3 py-3">{row.saleName || "—"}</td>
                <td className="max-w-48 truncate px-3 py-3" title={row.painPoint ?? undefined}>{row.painPoint || "—"}</td>
                <td className="max-w-56 truncate px-3 py-3" title={row.linkMess ?? undefined}>
                  {row.linkMess ? (
                    /^https?:\/\//i.test(row.linkMess) ? (
                      <a href={row.linkMess} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {row.linkMess}
                      </a>
                    ) : row.linkMess
                  ) : "—"}
                </td>
                <td className="max-w-48 truncate px-3 py-3" title={row.note ?? undefined}>{row.note || "—"}</td>
                <td className="px-3 py-3"><MessageStatusBadge status={row.status} leadCode={row.leadCode} /></td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    {canConvert && row.status !== "LOST" && (
                      <Button
                        size="sm"
                        title="Điền thông tin báo giá"
                        aria-label={`Chuyển sang Khách tiềm năng · ${row.messCode}`}
                        disabled={convertPending}
                        onClick={() => openConvert(row)}
                      >
                        <UserPlus />
                        Chuyển
                      </Button>
                    )}
                    <RowMenu
                      label={`Thao tác ${row.messCode}`}
                      items={[
                        ...(canWrite
                          ? [
                              { key: "edit", label: "Sửa", icon: <Pencil />, onClick: () => {
                                setEditingId(row.id);
                                setFormError(undefined);
                                const next = draftFrom(row);
                                setDraft({ ...next, saleName: next.saleName.trim() || user.name });
                              } },
                              { key: "delete", label: "Xóa", icon: <Trash2 />, destructive: true, onClick: () => setRemoving(row) },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableHScroll>

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
          <DialogFooter><Button variant="outline" disabled={convertPending} onClick={() => setConverting(null)}>Hủy</Button><Button disabled={convertPending} onClick={convert}>{convertPending ? "Đang chuyển…" : "Chuyển"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={draft !== null} onOpenChange={(open) => { if (!open) setDraft(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Sửa mess" : "Tạo mess"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid gap-3 sm:grid-cols-2">
              {formError && <InlineAlert className="sm:col-span-2">{formError}</InlineAlert>}
              <Field label="Ngày" htmlFor="mess-date" required>
                <Input id="mess-date" type="date" value={draft.receivedOn} onChange={(event) => setDraft({ ...draft, receivedOn: event.target.value })} />
              </Field>
              <Field label="Tên khách" htmlFor="mess-name" required>
                <Input id="mess-name" value={draft.customerName} onChange={(event) => setDraft({ ...draft, customerName: event.target.value })} />
              </Field>
              <Field label="Thị trường" htmlFor="mess-market" hint="Chọn gợi ý hoặc gõ mới">
                <Input id="mess-market" list="mess-market-options" value={draft.market} placeholder="Ví dụ: Mỹ, Úc, Canada" onChange={(event) => setDraft({ ...draft, market: event.target.value })} />
                <datalist id="mess-market-options">
                  {marketOptions.map(([market]) => <option key={market} value={market} />)}
                </datalist>
              </Field>
              <Field label="Phân loại" htmlFor="mess-class">
                <NativeSelect id="mess-class" value={draft.classification} onChange={(event) => setDraft({ ...draft, classification: event.target.value as MessDraft["classification"] })}>
                  <option value="">Chưa chọn</option>
                  {messageClassificationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Đối tượng" htmlFor="mess-type">
                <NativeSelect id="mess-type" value={draft.customerType} onChange={(event) => setDraft({ ...draft, customerType: event.target.value as MessDraft["customerType"] })}>
                  <option value="">Chưa chọn</option>
                  {customerTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Nhu cầu" htmlFor="mess-demand">
                <NativeSelect id="mess-demand" value={draft.demand} onChange={(event) => setDraft({ ...draft, demand: event.target.value as MessDraft["demand"] })}>
                  <option value="">Chưa chọn</option>
                  {demandOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Hàng hóa" htmlFor="mess-goods" className="sm:col-span-2" hint="Chọn gợi ý hoặc gõ mới">
                <Input id="mess-goods" list="mess-goods-options" value={draft.goods} onChange={(event) => setDraft({ ...draft, goods: event.target.value })} />
                <datalist id="mess-goods-options">
                  {goodsOptions.map((item) => <option key={item} value={item} />)}
                </datalist>
              </Field>
              <Field label="Ngành hàng" htmlFor="mess-industry" className="sm:col-span-2">
                <NativeSelect id="mess-industry" value={draft.industry} onChange={(event) => setDraft({ ...draft, industry: event.target.value as MessDraft["industry"] })}>
                  <option value="">Chưa chọn</option>
                  {industryCategoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Sales - hot & warm" htmlFor="mess-sale" className="sm:col-span-2" hint="Tự động theo tài khoản đăng nhập">
                <Input id="mess-sale" value={draft.saleName} readOnly />
              </Field>
              <Field label="Pain-Point của KH" htmlFor="mess-pain" className="sm:col-span-2" required hint="Ghi chi tiết mô tả pain-point của khách">
                <Textarea id="mess-pain" rows={4} value={draft.painPoint} placeholder="Mô tả chi tiết vấn đề / nhu cầu của khách…" onChange={(event) => setDraft({ ...draft, painPoint: event.target.value })} />
              </Field>
              <Field label="Link mess" htmlFor="mess-link" className="sm:col-span-2">
                <Input id="mess-link" value={draft.linkMess} placeholder="https://…" onChange={(event) => setDraft({ ...draft, linkMess: event.target.value })} />
              </Field>
              <Field label="Ghi chú Sale" htmlFor="mess-note" className="sm:col-span-2">
                <Textarea id="mess-note" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
              </Field>
              {canConvert && (
                <div className="grid gap-2 rounded-lg border p-3 sm:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Thông tin sản phẩm</p>
                      <p className="text-sm text-muted-foreground">
                        {draft.order && orderLineCount(draft.order) > 0
                          ? `Đã nhập ${orderLineCount(draft.order)} dòng hàng. Bấm Chuyển sau khi lưu sẽ dùng luôn, không phải nhập lại.`
                          : "Không bắt buộc. Nhập trước để khi bấm Chuyển không phải nhập lại."}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {draft.order && orderLineCount(draft.order) > 0 && (
                        <Button type="button" variant="outline" size="sm" onClick={() => setDraft({ ...draft, order: null })}>Xóa</Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!draft.demand}
                        title={draft.demand ? undefined : "Chọn Nhu cầu trước"}
                        onClick={() => setOrderDialog(true)}
                      >
                        <Plus /> {draft.order && orderLineCount(draft.order) > 0 ? "Sửa thông tin sản phẩm" : "Thêm thông tin sản phẩm"}
                      </Button>
                    </div>
                  </div>
                  {!draft.demand && <p className="text-xs text-muted-foreground">Chọn Nhu cầu (Tìm hàng hoặc Vận chuyển) để nhập thông tin sản phẩm.</p>}
                </div>
              )}
              <Field label="Số điện thoại" htmlFor="mess-phone" hint="Chỉ nhập số">
                <Input
                  id="mess-phone"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={draft.phone}
                  onChange={(event) => setDraft({ ...draft, phone: event.target.value.replace(/\D/g, "").slice(0, 30) })}
                />
              </Field>
              <Field label="Email" htmlFor="mess-email">
                <Input id="mess-email" type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Hủy</Button>
            <Button disabled={pending} onClick={save}>{pending ? "Đang lưu…" : "Lưu"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {orderDialog && draft?.demand && (
        <MessOrderDialog
          order={draft.order}
          onClose={() => setOrderDialog(false)}
          onSave={(order) => setDraft((current) => (current ? { ...current, order } : current))}
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

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        destructive
        title="Xóa mess?"
        description={removing ? `${removing.messCode} sẽ bị xóa. Mess đã chuyển sang khách hàng tiềm năng cần xóa bản tiềm năng trước.` : ""}
        confirmLabel="Xóa"
        onConfirm={remove}
      />
    </>
  );
}
