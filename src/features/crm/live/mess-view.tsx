"use client";

import { useCallback, useEffect, useState } from "react";
import { ImagePlus, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { convertMessageSchema, createMessageSchema, updateMessageSchema, type CrmLane } from "@speego/shared";
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
import { clipboardImage } from "@/lib/clipboard-image";
import { uploadImageSources } from "@/lib/upload-image";
import type { Role } from "@/types/role";
import { crmPath, LaneSwitch, useCrmLane } from "./lane";
import { dateRangeError, FilterSelect, ListSearchBar, searchParams, useAppliedSearch } from "./list-search-bar";
import { RowMenu } from "./row-menu";
import { CustomerTypeBadge, DemandBadge, HeatBadge, MessageStatusBadge } from "./status-badges";
import { customerTypeOptions, demandOptions, messageClassificationOptions, messageStatusLabels, type MessageRecord } from "./types";

const writeRoles: Role[] = ["admin", "marketing", "sale-vn", "sale-global"];
const convertRoles: Role[] = ["admin", "sale-vn", "sale-global"];

const marketPresets = ["Mỹ", "Úc", "Canada", "Anh", "Đức", "Pháp", "Nhật", "Hàn", "Singapore", "Thái Lan"];

type ConvertImage = {
  key: string;
  /** Preview local (blob: / data: / https) — chưa upload Cloudinary */
  preview: string;
  /** Nguồn upload khi bấm lưu: File hoặc data:/https: string */
  source: File | string;
};

function newImageKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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
  saleName: string;
  painPoint: string;
  linkMess: string;
  note: string;
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
  saleName: "",
  painPoint: "",
  linkMess: "",
  note: "",
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
    saleName: row.saleName ?? "",
    painPoint: row.painPoint ?? "",
    linkMess: row.linkMess ?? "",
    note: row.note ?? "",
  };
}

export function MessView({ lane: fixedLane }: { lane?: CrmLane }) {
  const user = useSession();
  const { lane, canPick, setLane } = useCrmLane(fixedLane);
  const canWrite = writeRoles.includes(user.role);
  const canConvert = convertRoles.includes(user.role);
  const [rows, setRows] = useState<MessageRecord[]>([]);
  const [error, setError] = useState<string>();
  const [draft, setDraft] = useState<MessDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState<MessageRecord | null>(null);
  const [converting, setConverting] = useState<MessageRecord | null>(null);
  const [convertDraft, setConvertDraft] = useState({ requirements: "", reason: "", images: [] as ConvertImage[] });
  const [convertError, setConvertError] = useState<string>();
  const [convertPending, setConvertPending] = useState(false);
  const [confirmCloseConvert, setConfirmCloseConvert] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const filters = useAppliedSearch({ q: "", from: "", to: "", status: "", classification: "", demand: "", customerType: "" });

  const convertDirty = Boolean(
    convertDraft.requirements.trim() || convertDraft.reason.trim() || convertDraft.images.length > 0,
  );

  const requestCloseConvert = () => {
    if (convertPending) return;
    if (convertDirty) setConfirmCloseConvert(true);
    else {
      setConverting(null);
      setConvertError(undefined);
      setPreviewImage(null);
    }
  };

  const forceCloseConvert = () => {
    setConfirmCloseConvert(false);
    setConverting(null);
    setConvertError(undefined);
    setPreviewImage(null);
    setConvertDraft((current) => {
      for (const image of current.images) {
        if (image.preview.startsWith("blob:")) URL.revokeObjectURL(image.preview);
      }
      return { requirements: "", reason: "", images: [] };
    });
  };

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
    });
    api<{ messages: MessageRecord[] }>(`${crmPath("/api/crm/messages", lane)}${query}`)
      .then((body) => setRows(body.messages))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tải được mess"));
  }, [filters.applied, lane]);

  useEffect(() => {
    load();
  }, [load]);

  const marketOptions = uniqueSuggestions(rows.map((row) => row.market), marketPresets);
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
      customerType: draft.customerType || undefined,
      classification: draft.classification || undefined,
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
    setError(undefined);
    setConvertError(undefined);
    setPreviewImage(null);
    setConvertDraft({
      requirements: [row.goods, row.painPoint, row.note].filter(Boolean).join("\n\n"),
      reason: "",
      images: [],
    });
    setConverting(row);
  };

  const submitConvert = () => {
    if (!converting) return;
    const formParsed = convertMessageSchema.safeParse({
      requirements: convertDraft.requirements,
      reason: convertDraft.reason,
      images: [],
    });
    if (!formParsed.success) {
      setConvertError(formParsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      return;
    }
    const messageId = converting.id;
    const images = convertDraft.images;
    setConvertPending(true);
    setConvertError(undefined);
    void (async () => {
      try {
        const uploaded = await uploadImageSources(images.map((image) => image.source));
        const parsed = convertMessageSchema.safeParse({
          requirements: formParsed.data.requirements,
          reason: formParsed.data.reason,
          images: uploaded,
        });
        if (!parsed.success) {
          setConvertError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
          return;
        }
        await api(crmPath(`/api/crm/messages/${messageId}/convert`, lane), {
          method: "POST",
          body: JSON.stringify(parsed.data),
        });
        forceCloseConvert();
        load();
      } catch (err: unknown) {
        setConvertError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Không chuyển được mess",
        );
      } finally {
        setConvertPending(false);
      }
    })();
  };

  const addConvertImages = (files: File[]) => {
    if (files.length === 0) return;
    setConvertError(undefined);
    setConvertDraft((current) => {
      const room = 20 - current.images.length;
      if (room <= 0) {
        queueMicrotask(() => setConvertError("Tối đa 20 ảnh"));
        return current;
      }
      const pending: ConvertImage[] = files.slice(0, room).map((file) => ({
        key: newImageKey(),
        preview: URL.createObjectURL(file),
        source: file,
      }));
      return { ...current, images: [...current.images, ...pending] };
    });
  };

  const pasteConvertImage = (event: React.ClipboardEvent) => {
    const pasted = clipboardImage(event);
    if (!pasted) return;
    event.preventDefault();
    setConvertError(undefined);
    if (typeof pasted === "string") {
      setConvertDraft((current) => {
        if (current.images.length >= 20) {
          queueMicrotask(() => setConvertError("Tối đa 20 ảnh"));
          return current;
        }
        return {
          ...current,
          images: [...current.images, { key: newImageKey(), preview: pasted, source: pasted }],
        };
      });
      return;
    }
    addConvertImages([pasted]);
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
            {canWrite && <Button onClick={openCreate}><Plus /> Tạo mess</Button>}
          </>
        }
      />
      {error && <InlineAlert className="mb-4">{error}</InlineAlert>}
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
        <FilterSelect id="mess-demand" label="Nhu cầu" value={filters.draft.demand} onChange={(value) => filters.set("demand", value)} options={demandOptions} />
        <FilterSelect id="mess-customer-type" label="Đối tượng" value={filters.draft.customerType} onChange={(value) => filters.set("customerType", value)} options={customerTypeOptions} />
        <FilterSelect id="mess-status" label="Trạng thái" value={filters.draft.status} onChange={(value) => filters.set("status", value)} options={Object.entries(messageStatusLabels)} />
      </ListSearchBar>
      <div className="overflow-x-auto rounded-xl border bg-card [&_th]:whitespace-nowrap">
        <table className="w-full min-w-[1680px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="whitespace-nowrap px-3 py-2 font-medium">Mã</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Ngày</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Tên khách</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Thị trường</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Phân loại</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Đối tượng</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Nhu cầu</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Hàng hóa</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Sales - hot & warm</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Pain-Point của KH</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Link mess</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Ghi chú Sale</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Trạng thái</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={14} className="px-3 py-8 text-center text-muted-foreground">{filters.active ? "Không có kết quả." : "Chưa có mess."}</td></tr>}
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-3 py-3 font-medium">{row.messCode}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.receivedAt ? formatDate(dateInputFromIso(row.receivedAt)) : "—"}</td>
                <td className="px-3 py-3">{row.customerName}</td>
                <td className="px-3 py-3">{row.market || "—"}</td>
                <td className="px-3 py-3"><HeatBadge value={row.classification} /></td>
                <td className="px-3 py-3"><CustomerTypeBadge value={row.customerType} /></td>
                <td className="px-3 py-3"><DemandBadge value={row.demand} /></td>
                <td className="px-3 py-3">{row.goods || "—"}</td>
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
                    {canConvert && !row.leadId && row.status !== "LOST" && (
                      <Button
                        size="sm"
                        title="Chuyển sang Khách tiềm năng"
                        aria-label={`Chuyển sang Khách tiềm năng · ${row.messCode}`}
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
      </div>

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
                  {marketOptions.map((item) => <option key={item} value={item} />)}
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

      <Dialog
        open={converting !== null}
        onOpenChange={(open) => {
          if (!open) requestCloseConvert();
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chuyển sang khách tiềm năng{converting ? ` · ${converting.messCode}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[min(68vh,720px)] gap-3 overflow-y-auto pr-1">
            {convertError && <InlineAlert>{convertError}</InlineAlert>}
            <Field label="Yêu cầu của khách" htmlFor="convert-requirements" required hint="Mô tả toàn bộ yêu cầu để vận hành / sourcing xử lý">
              <Textarea
                id="convert-requirements"
                rows={6}
                value={convertDraft.requirements}
                placeholder="Chi tiết hàng hóa, số lượng, quy cách, hạn giao, lưu ý…"
                onChange={(event) => setConvertDraft({ ...convertDraft, requirements: event.target.value })}
              />
            </Field>
            <Field label="Lý do chuyển" htmlFor="convert-reason" required>
              <Textarea
                id="convert-reason"
                rows={3}
                value={convertDraft.reason}
                placeholder="Vì sao chuyển mess này sang khách tiềm năng…"
                onChange={(event) => setConvertDraft({ ...convertDraft, reason: event.target.value })}
              />
            </Field>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Ảnh yêu cầu</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  Đã thêm {convertDraft.images.length}/20
                </p>
              </div>
              <div
                tabIndex={0}
                className="flex min-h-28 flex-col gap-2 rounded-lg border border-dashed p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Vùng ảnh yêu cầu — Ctrl+C / Ctrl+V"
                onCopy={(event) => {
                  const image = convertDraft.images[0]?.preview;
                  if (!image || !event.clipboardData) return;
                  event.preventDefault();
                  event.clipboardData.setData("text/plain", image);
                }}
                onPaste={pasteConvertImage}
              >
                <div className="flex flex-wrap gap-2">
                  {convertDraft.images.map((image, index) => (
                    <div key={image.key} className="relative">
                      <button
                        type="button"
                        className="block overflow-hidden rounded-md border bg-white"
                        title="Xem ảnh lớn"
                        onClick={() => setPreviewImage(image.preview)}
                      >
                        <img
                          src={image.preview}
                          alt={`Ảnh yêu cầu ${index + 1}`}
                          className="h-28 w-28 object-cover"
                        />
                      </button>
                      <span className="absolute left-1 top-1 rounded bg-card/95 px-1.5 text-[10px] font-medium shadow">
                        {index + 1}
                      </span>
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded bg-card px-1 text-xs shadow"
                        onClick={() => {
                          if (image.preview.startsWith("blob:")) URL.revokeObjectURL(image.preview);
                          setConvertDraft({
                            ...convertDraft,
                            images: convertDraft.images.filter((item) => item.key !== image.key),
                          });
                        }}
                      >
                        Xóa
                      </button>
                    </div>
                  ))}
                  {convertDraft.images.length === 0 && (
                    <p className="text-sm text-muted-foreground">Chưa có ảnh. Chọn file hoặc Ctrl+V để dán — ảnh hiện preview ngay.</p>
                  )}
                </div>
                <label className="inline-flex h-9 w-fit cursor-pointer items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-muted">
                  <ImagePlus aria-hidden className="size-4" />
                  Thêm ảnh
                  <input
                    className="sr-only"
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/*"
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      event.target.value = "";
                      addConvertImages(files);
                    }}
                  />
                </label>
                <p className="text-xs text-muted-foreground">Chọn / Ctrl+V · preview ngay · upload khi chuyển · tối đa 20</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={convertPending} onClick={requestCloseConvert}>Hủy</Button>
            <Button type="button" disabled={convertPending} onClick={submitConvert}>
              {convertPending ? "Đang chuyển…" : "Chuyển tiềm năng"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewImage !== null} onOpenChange={(open) => { if (!open) setPreviewImage(null); }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Xem ảnh yêu cầu</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="flex max-h-[75vh] items-center justify-center overflow-auto rounded-lg bg-muted/40 p-2">
              <img src={previewImage} alt="Preview ảnh yêu cầu" className="max-h-[70vh] w-auto max-w-full object-contain" />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPreviewImage(null)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmCloseConvert}
        onOpenChange={setConfirmCloseConvert}
        title="Đóng form chuyển tiềm năng?"
        description="Nội dung đã nhập sẽ bị mất nếu bạn đóng."
        confirmLabel="Đóng"
        cancelLabel="Tiếp tục nhập"
        destructive
        onConfirm={forceCloseConvert}
      />

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
