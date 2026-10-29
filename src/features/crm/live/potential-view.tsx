"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Pencil, Trash2, RefreshCw } from "lucide-react";
import { updatePotentialSchema, type CrmLane, type UpdatePotentialInput } from "@speego/shared";
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
import type { Role } from "@/types/role";
import { crmPath, LaneSwitch, useCrmLane } from "./lane";
import { RowMenu } from "./row-menu";
import { brandOptions, careChannelOptions, classificationOptions, customerKindOptions, customerTypeOptions, labelOf, potentialOptions, type PotentialRecord } from "./types";

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
  careChannel: "" | NonNullable<UpdatePotentialInput["careChannel"]>;
  classification: "" | NonNullable<UpdatePotentialInput["classification"]>;
  packSpec: string;
  weightKg: string;
  logisticsClass: "" | NonNullable<UpdatePotentialInput["logisticsClass"]>;
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
    careChannel: careChannelOptions.some((item) => item[0] === row.careChannel) ? row.careChannel as Draft["careChannel"] : "",
    classification: row.classification === "LCL" || row.classification === "FCL" ? row.classification : "",
    packSpec: row.packSpec ?? "",
    weightKg: row.weightKg == null ? "" : String(row.weightKg),
    logisticsClass: row.logisticsClass === "LCL" || row.logisticsClass === "FCL" ? row.logisticsClass : "",
    shipFromAddress: row.shipFromAddress ?? "",
    shipToAddress: row.shipToAddress ?? "",
  };
}

export function PotentialView({ lane: fixedLane }: { lane?: CrmLane }) {
  const user = useSession();
  const { lane, canPick, setLane } = useCrmLane(fixedLane);
  const canWrite = writeRoles.includes(user.role);
  const [rows, setRows] = useState<PotentialRecord[]>([]);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<PotentialRecord | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState<PotentialRecord | null>(null);
  const [notice, setNotice] = useState<string>();

  const load = useCallback(() => {
    api<{ potentials: PotentialRecord[] }>(crmPath("/api/crm/potentials", lane))
      .then((body) => setRows(body.potentials))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tải được khách hàng tiềm năng"));
  }, [lane]);

  useEffect(() => {
    load();
  }, [load]);

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
      weightKg: draft.weightKg.trim() === "" ? undefined : Number(draft.weightKg),
      logisticsClass: draft.logisticsClass || undefined,
      shipFromAddress: draft.shipFromAddress || undefined,
      shipToAddress: draft.shipToAddress || undefined,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      return;
    }
    setPending(true);
    void api(crmPath(`/api/crm/potentials/${editing.id}`, lane), { method: "PATCH", body: JSON.stringify(parsed.data) })
      .then(() => {
        setEditing(null);
        setDraft(null);
        load();
      })
      .catch((err: unknown) => setFormError(err instanceof ApiError ? err.message : "Không lưu được"))
      .finally(() => setPending(false));
  };

  const requestQuote = (row: PotentialRecord) => {
    setError(undefined);
    setNotice(undefined);
    if (!row.customerKind) {
      setError("Chọn loại khách trước khi báo giá");
      return;
    }
    void api<{ created: boolean; desk: "sourcing" | "logistics" }>(crmPath(`/api/crm/potentials/${row.id}/quotes`, lane), { method: "POST" })
      .then((body) => {
        const desk = body.desk === "logistics" ? "Logistics – Báo giá" : "Sourcing – Báo giá";
        setNotice(body.created ? `Đã tạo bản ghi cho ${desk}` : `Khách này đã có bản ghi ở ${desk}`);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tạo được báo giá"));
  };

  const remove = () => {
    if (!removing) return;
    const id = removing.id;
    setRemoving(null);
    void api(crmPath(`/api/crm/potentials/${id}`, lane), { method: "DELETE" })
      .then(load)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không xóa được"));
  };

  const columns: Column<PotentialRecord>[] = [
    { key: "code", header: "Tiềm năng", sortValue: (row) => row.leadCode, cell: (row) => (<div><p className="font-mono text-xs font-semibold text-primary">{row.leadCode}</p><p className="mt-1 text-xs text-muted-foreground">{row.messCode || "Không có mess"}</p></div>) },
    { key: "customer", header: "Khách hàng / liên hệ", cell: (row) => (<div className="min-w-48"><p className="font-medium">{row.fullName || "Chưa có tên"}</p><p className="text-xs text-muted-foreground">{row.companyName}</p><p className="mt-1 text-xs">{row.phone || "—"}</p><p className="text-xs text-muted-foreground">{row.email}</p></div>) },
    { key: "source", header: "Nguồn / chăm sóc", cell: (row) => (<div><BrandTag brand={row.brand} /><p className="mt-1 text-xs text-muted-foreground">{row.careChannel || "Chưa chọn kênh"}</p></div>) },
    { key: "stage", header: "Giai đoạn", cell: (row) => (<StatusBadge tone={row.potential === "DEPOSITED" ? "success" : row.potential === "CLOSING" ? "warning" : "neutral"}>{labelOf(potentialOptions, row.potential)}</StatusBadge>) },
    { key: "kind", header: "Loại khách", cell: (row) => (<div><p>{labelOf(customerKindOptions, row.customerKind)}</p><p className="text-xs text-muted-foreground">{labelOf(customerTypeOptions, row.customerType)}</p></div>) },
    { key: "goods", header: "Hàng hóa / vận chuyển", cell: (row) => (<div className="max-w-64 whitespace-normal"><p className="font-medium">{row.productInterest || "—"}</p><p className="text-xs text-muted-foreground">{[row.quantityNote, row.packSpec, row.weightKg == null ? "" : `${row.weightKg} kg`, row.classification, row.logisticsClass].filter(Boolean).join(" · ")}</p><p className="mt-1 text-xs text-muted-foreground">{[row.shipFromAddress, row.shipToAddress].filter(Boolean).join(" → ") || row.address}</p></div>) },
    { key: "note", header: "Ghi chú Sale", cell: (row) => (<p className="max-w-56 whitespace-normal">{row.saleNote || "—"}</p>) },
    { key: "actions", header: "Thao tác", className: "w-16", cell: (row) => { return (<RowMenu
                    label={`Thao tác ${row.leadCode}`}
                    items={canWrite ? [
                      { key: "quote", label: "Báo giá", icon: <FileText />, onClick: () => requestQuote(row) },
                      { key: "edit", label: "Sửa", icon: <Pencil />, onClick: () => open(row) },
                      { key: "delete", label: "Xóa", icon: <Trash2 />, destructive: true, onClick: () => setRemoving(row) },
                    ] : []}
                  />); } }
  ];

  return (
    <>
      <PageHeader
        title="Khách hàng tiềm năng"
        description={lane === "vn" ? "Khách tiềm năng tuyến Việt Nam, chuyển từ mess cùng tuyến." : "Khách tiềm năng tuyến Global, chuyển từ mess cùng tuyến."}
        actions={canPick ? <LaneSwitch lane={lane} onChange={setLane} /> : undefined}
      />
      {notice && <InlineAlert tone="success" className="mb-4">{notice}</InlineAlert>}
      {error && <InlineAlert className="mb-4">{error}</InlineAlert>}
      <ListView<PotentialRecord>
        key={lane}
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        searchLabel="Tìm kiếm"
        searchPlaceholder="Mã tiềm năng, tên khách, công ty, liên hệ…"
        searchText={(row) => [row.leadCode, row.fullName ?? "", row.companyName ?? "", row.phone ?? "", row.email ?? "", row.productInterest ?? "", row.messCode ?? ""]}
        dateValue={(row) => row.createdAt}
        dateLabel="Ngày tạo"
        filters={[
          { id: "potential", label: "Giai đoạn", options: potentialOptions.map(([value, label]) => ({ value, label })), match: (row, value) => row.potential === value },
          { id: "customerKind", label: "Loại khách", options: customerKindOptions.map(([value, label]) => ({ value, label })), match: (row, value) => row.customerKind === value },
          { id: "brand", label: "Nguồn", options: brandOptions.map(([value, label]) => ({ value, label })), match: (row, value) => row.brand === value },
          { id: "careChannel", label: "Kênh chăm sóc", options: careChannelOptions.map(([value, label]) => ({ value, label })), match: (row, value) => row.careChannel === value }
        ]}
        sort={(a, b) => b.createdAt.localeCompare(a.createdAt)}
      />

      <Dialog open={draft !== null} onOpenChange={(openDialog) => { if (!openDialog) { setDraft(null); setEditing(null); } }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Sửa khách hàng tiềm năng</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid max-h-[65dvh] gap-4 overflow-y-auto px-1 pb-2 sm:grid-cols-2">
              {formError && <InlineAlert className="sm:col-span-2">{formError}</InlineAlert>}
              <div className="border-b pb-3 pt-2 sm:col-span-2"><h3 className="font-semibold text-foreground">Thông tin khách hàng</h3><p className="mt-1 text-xs text-muted-foreground">Hồ sơ và thông tin liên hệ của khách tiềm năng.</p></div>
              <Field label="Tên khách" htmlFor="pot-name" required>
                <Input id="pot-name" value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} />
              </Field>
              <Field label="Công ty" htmlFor="pot-company">
                <Input id="pot-company" value={draft.companyName} onChange={(event) => setDraft({ ...draft, companyName: event.target.value })} />
              </Field>
              <Field label="Số điện thoại" htmlFor="pot-phone"><Input type="tel" autoComplete="tel" id="pot-phone" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></Field>
              <Field label="Email" htmlFor="pot-email"><Input type="email" autoComplete="email" id="pot-email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></Field>
              <Field className="sm:col-span-2" label="Địa chỉ" htmlFor="pot-address"><Input id="pot-address" value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></Field>
              <div className="border-b pb-3 pt-2 sm:col-span-2"><h3 className="font-semibold text-foreground">Phân loại & chăm sóc</h3><p className="mt-1 text-xs text-muted-foreground">Chọn loại khách trước khi tạo yêu cầu báo giá.</p></div>
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
              <Field label="Kênh chăm sóc" htmlFor="pot-care">
                <NativeSelect id="pot-care" value={draft.careChannel} onChange={(event) => setDraft({ ...draft, careChannel: event.target.value as Draft["careChannel"] })}>
                  <option value="">Chưa chọn</option>
                  {careChannelOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <div className="border-b pb-3 pt-2 sm:col-span-2"><h3 className="font-semibold text-foreground">Hàng hóa & vận chuyển</h3><p className="mt-1 text-xs text-muted-foreground">Thông số hàng hóa, đóng gói và địa chỉ giao nhận.</p></div>
              <Field className="sm:col-span-2" label="Hàng hóa" htmlFor="pot-goods"><Input id="pot-goods" value={draft.productInterest} onChange={(event) => setDraft({ ...draft, productInterest: event.target.value })} /></Field>
              <Field label="Số lượng" htmlFor="pot-qty"><Input id="pot-qty" value={draft.quantityNote} onChange={(event) => setDraft({ ...draft, quantityNote: event.target.value })} /></Field>
              <Field label="Phân loại" htmlFor="pot-class">
                <NativeSelect id="pot-class" value={draft.classification} onChange={(event) => setDraft({ ...draft, classification: event.target.value as Draft["classification"] })}>
                  <option value="">Chưa chọn</option>
                  {classificationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field className="sm:col-span-2" label="Quy cách đóng gói (KH logistics)" htmlFor="pot-pack">
                <Textarea id="pot-pack" rows={3} value={draft.packSpec} onChange={(event) => setDraft({ ...draft, packSpec: event.target.value })} />
              </Field>
              <Field label="Trọng lượng (kg) (KH logistics)" htmlFor="pot-weight">
                <Input id="pot-weight" inputMode="decimal" value={draft.weightKg} onChange={(event) => setDraft({ ...draft, weightKg: event.target.value })} />
              </Field>
              <Field label="Phân loại (KH logistics)" htmlFor="pot-logistics">
                <NativeSelect id="pot-logistics" value={draft.logisticsClass} onChange={(event) => setDraft({ ...draft, logisticsClass: event.target.value as Draft["logisticsClass"] })}>
                  <option value="">Chưa chọn</option>
                  {classificationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Địa chỉ gửi hàng (KH logistics)" htmlFor="pot-from">
                <Textarea id="pot-from" rows={3} value={draft.shipFromAddress} onChange={(event) => setDraft({ ...draft, shipFromAddress: event.target.value })} />
              </Field>
              <Field label="Địa chỉ nhận hàng (KH logistics)" htmlFor="pot-to">
                <Textarea id="pot-to" rows={3} value={draft.shipToAddress} onChange={(event) => setDraft({ ...draft, shipToAddress: event.target.value })} />
              </Field>
              <div className="border-b pb-3 pt-2 sm:col-span-2"><h3 className="font-semibold text-foreground">Ghi chú Sale</h3><p className="mt-1 text-xs text-muted-foreground">Thông tin bổ sung để phối hợp với Vận hành.</p></div>
              <Field className="sm:col-span-2" label="Ghi chú sale" htmlFor="pot-note"><Textarea rows={3} id="pot-note" value={draft.saleNote} onChange={(event) => setDraft({ ...draft, saleNote: event.target.value })} /></Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDraft(null); setEditing(null); }}>Hủy</Button>
            <Button disabled={pending} onClick={save}><RefreshCw aria-hidden />{pending ? "Đang lưu…" : "Lưu"}</Button>
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
