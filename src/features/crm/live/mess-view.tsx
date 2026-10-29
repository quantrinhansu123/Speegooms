"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, UserPlus, RefreshCw, Save } from "lucide-react";
import { createMessageSchema, updateMessageSchema, type CrmLane } from "@speego/shared";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { ListView } from "@/components/shared/list-view";
import type { Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
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

  const load = useCallback(() => {
    api<{ messages: MessageRecord[] }>(crmPath("/api/crm/messages", lane))
      .then((body) => setRows(body.messages))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tải được mess"));
  }, [lane]);

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

  const columns: Column<MessageRecord>[] = [
    { key: "code", header: "Mess", sortValue: (row) => row.messCode, cell: (row) => (<div><p className="font-mono text-xs font-semibold text-primary">{row.messCode}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(dateInputFromIso(row.receivedAt))}</p></div>) },
    { key: "customer", header: "Khách hàng", cell: (row) => (<div className="min-w-44"><p className="font-medium">{row.customerName || "Chưa có tên"}</p><p className="text-xs text-muted-foreground">{row.phone || row.email || "Chưa có liên hệ"}</p><p className="text-xs text-muted-foreground">{row.market || "Chưa có thị trường"}</p></div>) },
    { key: "class", header: "Phân loại", cell: (row) => (<div><StatusBadge tone={row.classification === "HOT" ? "danger" : row.classification === "WARM" ? "warning" : "neutral"}>{labelOf(messageClassificationOptions, row.classification)}</StatusBadge><p className="mt-1 text-xs text-muted-foreground">{labelOf(customerTypeOptions, row.customerType)}</p></div>) },
    { key: "demand", header: "Nhu cầu / hàng hóa", cell: (row) => (<div className="max-w-56 whitespace-normal"><p>{labelOf(demandOptions, row.demand)}</p><p className="text-xs text-muted-foreground">{row.goods || "Chưa có hàng hóa"}</p></div>) },
    { key: "sale", header: "Sale phụ trách", cell: (row) => (<span>{row.saleName || "Chưa phân công"}</span>) },
    { key: "note", header: "Nội dung chăm sóc", cell: (row) => (<div className="max-w-64 whitespace-normal"><p>{row.painPoint || "—"}</p><p className="mt-1 text-xs text-muted-foreground">{row.note}</p></div>) },
    { key: "status", header: "Trạng thái", cell: (row) => (<StatusBadge tone={row.leadId ? "success" : "neutral"}>{row.leadCode ? `Đã chuyển · ${row.leadCode}` : messageStatusLabels[row.status] ?? row.status}</StatusBadge>) },
    { key: "actions", header: "Thao tác", className: "w-16", cell: (row) => { return (<RowMenu
                    label={`Thao tác ${row.messCode}`}
                    items={[
                      ...(canConvert && !row.leadId && row.status !== "LOST"
                        ? [{ key: "convert", label: "Chuyển tiềm năng", icon: <UserPlus />, onClick: () => convert(row) }]
                        : []),
                      ...(canWrite
                        ? [
                            { key: "edit", label: "Sửa", icon: <Pencil />, onClick: () => { setEditingId(row.id); setFormError(undefined); setDraft(draftFrom(row)); } },
                            { key: "delete", label: "Xóa", icon: <Trash2 />, destructive: true, onClick: () => setRemoving(row) },
                          ]
                        : []),
                    ]}
                  />); } }
  ];

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
      <ListView<MessageRecord>
        key={lane}
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        searchLabel="Tìm kiếm"
        searchPlaceholder="Mã mess, khách hàng, điện thoại, hàng hóa…"
        searchText={(row) => [row.messCode, row.customerName ?? "", row.phone ?? "", row.email ?? "", row.goods ?? "", row.saleName ?? "", row.market ?? ""]}
        dateValue={(row) => dateInputFromIso(row.receivedAt)}
        dateLabel="Ngày tiếp nhận"
        filters={[
          { id: "status", label: "Trạng thái", options: Object.entries(messageStatusLabels).map(([value, label]) => ({ value, label })), match: (row, value) => row.status === value },
          { id: "classification", label: "Phân loại", options: messageClassificationOptions.map(([value, label]) => ({ value, label })), match: (row, value) => row.classification === value },
          { id: "demand", label: "Nhu cầu", options: demandOptions.map(([value, label]) => ({ value, label })), match: (row, value) => row.demand === value },
          { id: "customerType", label: "Đối tượng", options: customerTypeOptions.map(([value, label]) => ({ value, label })), match: (row, value) => row.customerType === value }
        ]}
        sort={(a, b) => b.receivedAt.localeCompare(a.receivedAt)}
      />

      <Dialog open={draft !== null} onOpenChange={(open) => { if (!open) setDraft(null); }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Sửa mess" : "Tạo mess"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid max-h-[65dvh] gap-4 overflow-y-auto px-1 pb-2 sm:grid-cols-2">
              {formError && <InlineAlert className="sm:col-span-2">{formError}</InlineAlert>}
              <div className="border-b pb-3 pt-2 sm:col-span-2"><h3 className="font-semibold text-foreground">Thông tin khách hàng</h3><p className="mt-1 text-xs text-muted-foreground">Thông tin liên hệ để Sale tiếp nhận và chăm sóc.</p></div>
              <Field label="Tên khách" htmlFor="mess-name" required>
                <Input id="mess-name" value={draft.customerName} onChange={(event) => setDraft({ ...draft, customerName: event.target.value })} />
              </Field>
              <Field label="Số điện thoại" htmlFor="mess-phone">
                <Input type="tel" autoComplete="tel" id="mess-phone" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} />
              </Field>
              <Field label="Email" htmlFor="mess-email">
                <Input id="mess-email" type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
              </Field>
              <Field label="Thị trường" htmlFor="mess-market">
                <Input id="mess-market" value={draft.market} placeholder="Ví dụ: Mỹ, Úc, Canada" onChange={(event) => setDraft({ ...draft, market: event.target.value })} />
              </Field>
              <div className="border-b pb-3 pt-2 sm:col-span-2"><h3 className="font-semibold text-foreground">Phân loại & nhu cầu</h3><p className="mt-1 text-xs text-muted-foreground">Xác định mức độ quan tâm và dịch vụ khách cần.</p></div>
              <Field label="Ngày tiếp nhận" htmlFor="mess-date" required>
                <Input id="mess-date" type="date" value={draft.receivedOn} onChange={(event) => setDraft({ ...draft, receivedOn: event.target.value })} />
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
              <Field className="sm:col-span-2" label="Hàng hóa" htmlFor="mess-goods">
                <Input id="mess-goods" value={draft.goods} onChange={(event) => setDraft({ ...draft, goods: event.target.value })} />
              </Field>
              <Field label="Sale phụ trách" htmlFor="mess-sale">
                <Input id="mess-sale" value={draft.saleName} placeholder="Tên sale phụ trách" onChange={(event) => setDraft({ ...draft, saleName: event.target.value })} />
              </Field>
              <div className="border-b pb-3 pt-2 sm:col-span-2"><h3 className="font-semibold text-foreground">Nội dung chăm sóc</h3><p className="mt-1 text-xs text-muted-foreground">Ghi nhận vấn đề cần giải quyết và thông tin trao đổi.</p></div>
              <Field className="sm:col-span-2" label="Vấn đề / mong muốn của khách" htmlFor="mess-pain">
                <Textarea id="mess-pain" value={draft.painPoint} onChange={(event) => setDraft({ ...draft, painPoint: event.target.value })} />
              </Field>
              <Field className="sm:col-span-2" label="Ghi chú Sale" htmlFor="mess-note">
                <Textarea id="mess-note" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Hủy</Button>
            <Button disabled={pending} onClick={save}>{editingId ? <RefreshCw aria-hidden /> : <Save aria-hidden />}{pending ? "Đang lưu…" : "Lưu"}</Button>
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
