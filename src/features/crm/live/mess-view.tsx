"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { createMessageSchema, updateMessageSchema } from "@speego/shared";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSession } from "@/features/auth/session-provider";
import { ApiError, api } from "@/lib/api";
import type { Role } from "@/types/role";
import { demandOptions, labelOf, messageStatusLabels, customerTypeOptions, type MessageRecord } from "./types";

const writeRoles: Role[] = ["admin", "marketing", "sale-vn", "sale-global"];
const convertRoles: Role[] = ["admin", "sale-vn", "sale-global"];

type MessDraft = {
  customerName: string;
  phone: string;
  email: string;
  goods: string;
  note: string;
  demand: "" | "SHIPPING" | "SOURCING";
  customerType: "" | "INDIVIDUAL" | "PRINCIPAL" | "ENTERPRISE";
};

const emptyDraft: MessDraft = {
  customerName: "",
  phone: "",
  email: "",
  goods: "",
  note: "",
  demand: "",
  customerType: "",
};

function draftFrom(row: MessageRecord): MessDraft {
  return {
    customerName: row.customerName ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    goods: row.goods ?? "",
    note: row.note ?? "",
    demand: row.demand === "SHIPPING" || row.demand === "SOURCING" ? row.demand : "",
    customerType: row.customerType === "INDIVIDUAL" || row.customerType === "PRINCIPAL" || row.customerType === "ENTERPRISE" ? row.customerType : "",
  };
}

export function MessView() {
  const user = useSession();
  const canWrite = writeRoles.includes(user.role);
  const canConvert = convertRoles.includes(user.role);
  const [rows, setRows] = useState<MessageRecord[]>([]);
  const [error, setError] = useState<string>();
  const [draft, setDraft] = useState<MessDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState<MessageRecord | null>(null);

  const load = () => {
    api<{ messages: MessageRecord[] }>("/api/crm/messages")
      .then((body) => setRows(body.messages))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tải được mess"));
  };

  useEffect(load, []);

  const save = () => {
    if (!draft) return;
    const payload = {
      ...draft,
      demand: draft.demand || undefined,
      customerType: draft.customerType || undefined,
    };
    const parsed = (editingId ? updateMessageSchema : createMessageSchema).safeParse(payload);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      return;
    }
    setPending(true);
    setFormError(undefined);
    const request = editingId
      ? api(`/api/crm/messages/${editingId}`, { method: "PATCH", body: JSON.stringify(parsed.data) })
      : api("/api/crm/messages", { method: "POST", body: JSON.stringify(parsed.data) });
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
    void api(`/api/crm/messages/${row.id}/convert`, { method: "POST" })
      .then(() => load())
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không chuyển được mess"));
  };

  const remove = () => {
    if (!removing) return;
    const id = removing.id;
    setRemoving(null);
    void api(`/api/crm/messages/${id}`, { method: "DELETE" })
      .then(load)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không xóa được mess"));
  };

  return (
    <>
      <PageHeader
        title="Mess"
        description="Tin từ Ads hoặc Page. Sale chuyển mess thành khách hàng tiềm năng."
        actions={canWrite && <Button onClick={() => { setEditingId(null); setFormError(undefined); setDraft(emptyDraft); }}><Plus /> Tạo mess</Button>}
      />
      {error && <InlineAlert className="mb-4">{error}</InlineAlert>}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Mã</th>
              <th className="px-3 py-2 font-medium">Khách</th>
              <th className="px-3 py-2 font-medium">Số điện thoại</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Nhu cầu</th>
              <th className="px-3 py-2 font-medium">Đối tượng</th>
              <th className="px-3 py-2 font-medium">Hàng hóa</th>
              <th className="px-3 py-2 font-medium">Ghi chú</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
              <th className="px-3 py-2 font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Chưa có mess.</td></tr>}
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-3 py-3 font-medium">{row.messCode}</td>
                <td className="px-3 py-3">{row.customerName}</td>
                <td className="px-3 py-3">{row.phone || "—"}</td>
                <td className="px-3 py-3">{row.email || "—"}</td>
                <td className="px-3 py-3">{labelOf(demandOptions, row.demand)}</td>
                <td className="px-3 py-3">{labelOf(customerTypeOptions, row.customerType)}</td>
                <td className="px-3 py-3">{row.goods || "—"}</td>
                <td className="max-w-48 truncate px-3 py-3" title={row.note ?? undefined}>{row.note || "—"}</td>
                <td className="px-3 py-3">{row.leadCode ? `Đã chuyển · ${row.leadCode}` : messageStatusLabels[row.status] ?? row.status}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {canConvert && !row.leadId && row.status !== "LOST" && (
                      <Button size="sm" variant="outline" onClick={() => convert(row)}><UserPlus /> Chuyển tiềm năng</Button>
                    )}
                    {canWrite && (
                      <Button size="icon-sm" variant="ghost" aria-label={`Sửa ${row.messCode}`} onClick={() => { setEditingId(row.id); setFormError(undefined); setDraft(draftFrom(row)); }}><Pencil /></Button>
                    )}
                    {canWrite && (
                      <Button size="icon-sm" variant="ghost" aria-label={`Xóa ${row.messCode}`} onClick={() => setRemoving(row)}><Trash2 /></Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={draft !== null} onOpenChange={(open) => { if (!open) setDraft(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Sửa mess" : "Tạo mess"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid gap-3">
              {formError && <InlineAlert>{formError}</InlineAlert>}
              <Field label="Tên khách" htmlFor="mess-name" required>
                <Input id="mess-name" value={draft.customerName} onChange={(event) => setDraft({ ...draft, customerName: event.target.value })} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Số điện thoại" htmlFor="mess-phone">
                  <Input id="mess-phone" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} />
                </Field>
                <Field label="Email" htmlFor="mess-email">
                  <Input id="mess-email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
                </Field>
              </div>
              <Field label="Nhu cầu" htmlFor="mess-demand">
                <NativeSelect id="mess-demand" value={draft.demand} onChange={(event) => setDraft({ ...draft, demand: event.target.value as MessDraft["demand"] })}>
                  <option value="">Chưa chọn</option>
                  {demandOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Đối tượng" htmlFor="mess-type">
                <NativeSelect id="mess-type" value={draft.customerType} onChange={(event) => setDraft({ ...draft, customerType: event.target.value as MessDraft["customerType"] })}>
                  <option value="">Chưa chọn</option>
                  {customerTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Hàng hóa" htmlFor="mess-goods">
                <Input id="mess-goods" value={draft.goods} onChange={(event) => setDraft({ ...draft, goods: event.target.value })} />
              </Field>
              <Field label="Ghi chú" htmlFor="mess-note">
                <Input id="mess-note" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
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
