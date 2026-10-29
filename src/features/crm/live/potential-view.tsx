"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { updatePotentialSchema, type UpdatePotentialInput } from "@speego/shared";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSession } from "@/features/auth/session-provider";
import { ApiError, api } from "@/lib/api";
import type { Role } from "@/types/role";
import { brandOptions, classificationOptions, customerKindOptions, customerTypeOptions, labelOf, potentialOptions, type PotentialRecord } from "./types";

const writeRoles: Role[] = ["admin", "sale-vn", "sale-global"];

function BrandTag({ brand }: { brand: string | null }) {
  const item = brandOptions.find((option) => option[0] === brand);
  if (!item) return <span className="text-muted-foreground">—</span>;
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${item[2]}`}>{item[1]}</span>;
}

type Draft = {
  fullName: string;
  companyName: string;
  phone: string;
  email: string;
  productInterest: string;
  quantityNote: string;
  address: string;
  saleNote: string;
  potential: UpdatePotentialInput["potential"];
  customerKind: "" | NonNullable<UpdatePotentialInput["customerKind"]>;
  customerType: "" | NonNullable<UpdatePotentialInput["customerType"]>;
  brand: "" | NonNullable<UpdatePotentialInput["brand"]>;
  careChannel: string;
  classification: "" | NonNullable<UpdatePotentialInput["classification"]>;
  packSpec: string;
  weightKg: string;
  logisticsClass: string;
  shipFromAddress: string;
  shipToAddress: string;
};

function draftFrom(row: PotentialRecord): Draft {
  return {
    fullName: row.fullName ?? "",
    companyName: row.companyName ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    productInterest: row.productInterest ?? "",
    quantityNote: row.quantityNote ?? "",
    address: row.address ?? "",
    saleNote: row.saleNote ?? "",
    potential: potentialOptions.some((item) => item[0] === row.potential) ? row.potential as Draft["potential"] : "POTENTIAL",
    customerKind: row.customerKind === "SOURCING" || row.customerKind === "LOGISTICS" || row.customerKind === "SOURCING_LOGISTICS" ? row.customerKind : "",
    customerType: row.customerType === "INDIVIDUAL" || row.customerType === "PRINCIPAL" || row.customerType === "ENTERPRISE" ? row.customerType : "",
    brand: brandOptions.some((item) => item[0] === row.brand) ? row.brand as Draft["brand"] : "",
    careChannel: row.careChannel ?? "",
    classification: row.classification === "LCL" || row.classification === "FCL" ? row.classification : "",
    packSpec: row.packSpec ?? "",
    weightKg: row.weightKg == null ? "" : String(row.weightKg),
    logisticsClass: row.logisticsClass ?? "",
    shipFromAddress: row.shipFromAddress ?? "",
    shipToAddress: row.shipToAddress ?? "",
  };
}

export function PotentialView() {
  const user = useSession();
  const canWrite = writeRoles.includes(user.role);
  const [rows, setRows] = useState<PotentialRecord[]>([]);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<PotentialRecord | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState<PotentialRecord | null>(null);

  const load = () => {
    api<{ potentials: PotentialRecord[] }>("/api/crm/potentials")
      .then((body) => setRows(body.potentials))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tải được khách hàng tiềm năng"));
  };

  useEffect(load, []);

  const open = (row: PotentialRecord) => {
    setEditing(row);
    setDraft(draftFrom(row));
    setFormError(undefined);
  };

  const save = () => {
    if (!editing || !draft) return;
    const parsed = updatePotentialSchema.safeParse({
      ...draft,
      customerKind: draft.customerKind || undefined,
      customerType: draft.customerType || undefined,
      brand: draft.brand || undefined,
      careChannel: draft.careChannel || undefined,
      classification: draft.classification || undefined,
      packSpec: draft.packSpec || undefined,
      weightKg: draft.weightKg === "" ? undefined : Number(draft.weightKg),
      logisticsClass: draft.logisticsClass || undefined,
      shipFromAddress: draft.shipFromAddress || undefined,
      shipToAddress: draft.shipToAddress || undefined,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      return;
    }
    setPending(true);
    void api(`/api/crm/potentials/${editing.id}`, { method: "PATCH", body: JSON.stringify(parsed.data) })
      .then(() => {
        setEditing(null);
        setDraft(null);
        load();
      })
      .catch((err: unknown) => setFormError(err instanceof ApiError ? err.message : "Không lưu được"))
      .finally(() => setPending(false));
  };

  const remove = () => {
    if (!removing) return;
    const id = removing.id;
    setRemoving(null);
    void api(`/api/crm/potentials/${id}`, { method: "DELETE" })
      .then(load)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không xóa được"));
  };

  return (
    <>
      <PageHeader title="Khách hàng tiềm năng" description="Lead được chuyển từ mess, giai đoạn bắt đầu là Tiềm năng." />
      {error && <InlineAlert className="mb-4">{error}</InlineAlert>}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[1680px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Mã</th>
              <th className="px-3 py-2 font-medium">Khách</th>
              <th className="px-3 py-2 font-medium">Công ty</th>
              <th className="px-3 py-2 font-medium">Số điện thoại</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Mess</th>
              <th className="px-3 py-2 font-medium">Nguồn</th>
              <th className="px-3 py-2 font-medium">Giai đoạn</th>
              <th className="px-3 py-2 font-medium">Loại khách</th>
              <th className="px-3 py-2 font-medium">Đối tượng</th>
              <th className="px-3 py-2 font-medium">Hàng hóa</th>
              <th className="px-3 py-2 font-medium">Số lượng</th>
              <th className="px-3 py-2 font-medium">Địa chỉ</th>
              <th className="px-3 py-2 font-medium">Ghi chú sale</th>
              <th className="px-3 py-2 font-medium">Kênh chăm sóc</th>
              <th className="px-3 py-2 font-medium">Phân loại</th>
              <th className="px-3 py-2 font-medium">Quy cách</th>
              <th className="px-3 py-2 font-medium">Trọng lượng</th>
              <th className="px-3 py-2 font-medium">Phân loại logistics</th>
              <th className="px-3 py-2 font-medium">Địa chỉ gửi</th>
              <th className="px-3 py-2 font-medium">Địa chỉ nhận</th>
              <th className="px-3 py-2 font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={22} className="px-3 py-8 text-center text-muted-foreground">Chưa có khách hàng tiềm năng.</td></tr>}
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-3 py-3 font-medium">{row.leadCode}</td>
                <td className="px-3 py-3">{row.fullName}</td>
                <td className="px-3 py-3">{row.companyName || "—"}</td>
                <td className="px-3 py-3">{row.phone || "—"}</td>
                <td className="px-3 py-3">{row.email || "—"}</td>
                <td className="px-3 py-3">{row.messCode ?? "—"}</td>
                <td className="px-3 py-3"><BrandTag brand={row.brand} /></td>
                <td className="px-3 py-3">{labelOf(potentialOptions, row.potential)}</td>
                <td className="px-3 py-3">{labelOf(customerKindOptions, row.customerKind)}</td>
                <td className="px-3 py-3">{labelOf(customerTypeOptions, row.customerType)}</td>
                <td className="px-3 py-3">{row.productInterest || "—"}</td>
                <td className="px-3 py-3">{row.quantityNote || "—"}</td>
                <td className="px-3 py-3">{row.address || "—"}</td>
                <td className="max-w-48 truncate px-3 py-3" title={row.saleNote ?? undefined}>{row.saleNote || "—"}</td>
                <td className="px-3 py-3">{row.careChannel || "—"}</td>
                <td className="px-3 py-3">{row.classification || "—"}</td>
                <td className="px-3 py-3">{row.packSpec || "—"}</td>
                <td className="px-3 py-3">{row.weightKg == null ? "—" : `${row.weightKg} kg`}</td>
                <td className="px-3 py-3">{row.logisticsClass || "—"}</td>
                <td className="px-3 py-3">{row.shipFromAddress || "—"}</td>
                <td className="px-3 py-3">{row.shipToAddress || "—"}</td>
                <td className="px-3 py-3">
                  {canWrite && (
                    <div className="flex gap-1">
                      <Button size="icon-sm" variant="ghost" aria-label={`Sửa ${row.leadCode}`} onClick={() => open(row)}><Pencil /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Xóa ${row.leadCode}`} onClick={() => setRemoving(row)}><Trash2 /></Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={draft !== null} onOpenChange={(openDialog) => { if (!openDialog) { setDraft(null); setEditing(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sửa khách hàng tiềm năng</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1">
              {formError && <InlineAlert>{formError}</InlineAlert>}
              <Field label="Tên khách" htmlFor="pot-name" required>
                <Input id="pot-name" value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} />
              </Field>
              <Field label="Công ty" htmlFor="pot-company">
                <Input id="pot-company" value={draft.companyName} onChange={(event) => setDraft({ ...draft, companyName: event.target.value })} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Số điện thoại" htmlFor="pot-phone"><Input id="pot-phone" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></Field>
                <Field label="Email" htmlFor="pot-email"><Input id="pot-email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></Field>
              </div>
              <Field label="Nguồn" htmlFor="pot-brand">
                <NativeSelect id="pot-brand" value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value as Draft["brand"] })}>
                  <option value="">Chưa chọn</option>
                  {brandOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Giai đoạn" htmlFor="pot-stage" required>
                <NativeSelect id="pot-stage" value={draft.potential} onChange={(event) => setDraft({ ...draft, potential: event.target.value as Draft["potential"] })}>
                  {potentialOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Loại khách" htmlFor="pot-kind">
                <NativeSelect id="pot-kind" value={draft.customerKind} onChange={(event) => setDraft({ ...draft, customerKind: event.target.value as Draft["customerKind"] })}>
                  <option value="">Chưa chọn</option>
                  {customerKindOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Đối tượng" htmlFor="pot-type">
                <NativeSelect id="pot-type" value={draft.customerType} onChange={(event) => setDraft({ ...draft, customerType: event.target.value as Draft["customerType"] })}>
                  <option value="">Chưa chọn</option>
                  {customerTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Hàng hóa" htmlFor="pot-goods"><Input id="pot-goods" value={draft.productInterest} onChange={(event) => setDraft({ ...draft, productInterest: event.target.value })} /></Field>
              <Field label="Số lượng" htmlFor="pot-qty"><Input id="pot-qty" value={draft.quantityNote} onChange={(event) => setDraft({ ...draft, quantityNote: event.target.value })} /></Field>
              <Field label="Địa chỉ" htmlFor="pot-address"><Input id="pot-address" value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></Field>
              <Field label="Ghi chú sale" htmlFor="pot-note"><Input id="pot-note" value={draft.saleNote} onChange={(event) => setDraft({ ...draft, saleNote: event.target.value })} /></Field>
              <Field label="Kênh chăm sóc" htmlFor="pot-care"><Input id="pot-care" value={draft.careChannel} onChange={(event) => setDraft({ ...draft, careChannel: event.target.value })} /></Field>
              <Field label="Phân loại" htmlFor="pot-class">
                <NativeSelect id="pot-class" value={draft.classification} onChange={(event) => setDraft({ ...draft, classification: event.target.value as Draft["classification"] })}>
                  <option value="">Chưa chọn</option>
                  {classificationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Quy cách đóng gói" htmlFor="pot-pack"><Input id="pot-pack" value={draft.packSpec} onChange={(event) => setDraft({ ...draft, packSpec: event.target.value })} /></Field>
              <Field label="Trọng lượng (kg)" htmlFor="pot-weight"><Input id="pot-weight" inputMode="decimal" value={draft.weightKg} onChange={(event) => setDraft({ ...draft, weightKg: event.target.value })} /></Field>
              <Field label="Phân loại logistics" htmlFor="pot-logistics"><Input id="pot-logistics" value={draft.logisticsClass} onChange={(event) => setDraft({ ...draft, logisticsClass: event.target.value })} /></Field>
              <Field label="Địa chỉ gửi" htmlFor="pot-from"><Input id="pot-from" value={draft.shipFromAddress} onChange={(event) => setDraft({ ...draft, shipFromAddress: event.target.value })} /></Field>
              <Field label="Địa chỉ nhận" htmlFor="pot-to"><Input id="pot-to" value={draft.shipToAddress} onChange={(event) => setDraft({ ...draft, shipToAddress: event.target.value })} /></Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDraft(null); setEditing(null); }}>Hủy</Button>
            <Button disabled={pending} onClick={save}>{pending ? "Đang lưu…" : "Lưu"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(openDialog) => { if (!openDialog) setRemoving(null); }}
        destructive
        title="Xóa khách hàng tiềm năng?"
        description={removing ? `${removing.leadCode} sẽ được gỡ. Mess nguồn có thể chuyển lại.` : ""}
        confirmLabel="Xóa"
        onConfirm={remove}
      />
    </>
  );
}
