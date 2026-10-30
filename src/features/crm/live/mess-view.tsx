"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { createMessageSchema, updateMessageSchema, type CrmLane } from "@speego/shared";
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
import { crmPath, LaneSwitch, useCrmLane } from "./lane";
import { dateRangeError, FilterSelect, ListSearchBar, searchParams, useAppliedSearch } from "./list-search-bar";
import { RowMenu } from "./row-menu";
import { customerTypeOptions, demandOptions, labelOf, messageClassificationOptions, messageStatusLabels, type MessageRecord } from "./types";

const writeRoles: Role[] = ["admin", "marketing", "sale-vn", "sale-global"];
const convertRoles: Role[] = ["admin", "sale-vn", "sale-global"];

type Classification = "" | "HOT" | "WARM" | "COLD" | "DEAD";

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
  const filters = useAppliedSearch({ q: "", from: "", to: "", status: "", classification: "", demand: "", customerType: "" });

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

  const save = () => {
    if (!draft) return;
    const payload = {
      ...draft,
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

  const convert = (row: MessageRecord) => {
    setError(undefined);
    void api(crmPath(`/api/crm/messages/${row.id}/convert`, lane), { method: "POST" })
      .then(() => load())
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không chuyển được mess"));
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
            {canWrite && <Button onClick={() => { setEditingId(null); setFormError(undefined); setDraft({ ...emptyDraft, receivedOn: todayInput() }); }}><Plus /> Tạo mess</Button>}
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
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[1680px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Mã</th>
              <th className="px-3 py-2 font-medium">Ngày</th>
              <th className="px-3 py-2 font-medium">Tên khách</th>
              <th className="px-3 py-2 font-medium">Thị trường</th>
              <th className="px-3 py-2 font-medium">Phân loại</th>
              <th className="px-3 py-2 font-medium">Đối tượng</th>
              <th className="px-3 py-2 font-medium">Nhu cầu</th>
              <th className="px-3 py-2 font-medium">Hàng hóa</th>
              <th className="px-3 py-2 font-medium">Sales - hot & warm</th>
              <th className="px-3 py-2 font-medium">Pain-Point của KH</th>
              <th className="px-3 py-2 font-medium">Link mess</th>
              <th className="px-3 py-2 font-medium">Ghi chú Sale</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
              <th className="px-3 py-2 font-medium">Thao tác</th>
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
                <td className="px-3 py-3">{labelOf(messageClassificationOptions, row.classification)}</td>
                <td className="px-3 py-3">{labelOf(customerTypeOptions, row.customerType)}</td>
                <td className="px-3 py-3">{labelOf(demandOptions, row.demand)}</td>
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
                <td className="px-3 py-3">{row.leadCode ? `Đã chuyển · ${row.leadCode}` : messageStatusLabels[row.status] ?? row.status}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    {canConvert && !row.leadId && row.status !== "LOST" && (
                      <Button
                        size="sm"
                        variant="outline"
                        title="Chuyển sang Khách tiềm năng"
                        aria-label={`Chuyển sang Khách tiềm năng · ${row.messCode}`}
                        onClick={() => convert(row)}
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
                              { key: "edit", label: "Sửa", icon: <Pencil />, onClick: () => { setEditingId(row.id); setFormError(undefined); setDraft(draftFrom(row)); } },
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
              <Field label="Thị trường" htmlFor="mess-market">
                <Input id="mess-market" value={draft.market} placeholder="Ví dụ: Mỹ, Úc, Canada" onChange={(event) => setDraft({ ...draft, market: event.target.value })} />
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
              <Field label="Hàng hóa" htmlFor="mess-goods" className="sm:col-span-2">
                <Input id="mess-goods" value={draft.goods} onChange={(event) => setDraft({ ...draft, goods: event.target.value })} />
              </Field>
              <Field label="Sales - hot & warm" htmlFor="mess-sale" className="sm:col-span-2">
                <Input id="mess-sale" value={draft.saleName} placeholder="Tên sale phụ trách" onChange={(event) => setDraft({ ...draft, saleName: event.target.value })} />
              </Field>
              <Field label="Pain-Point của KH" htmlFor="mess-pain" className="sm:col-span-2">
                <Textarea id="mess-pain" value={draft.painPoint} onChange={(event) => setDraft({ ...draft, painPoint: event.target.value })} />
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
