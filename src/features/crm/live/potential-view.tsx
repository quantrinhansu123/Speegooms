"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Pencil, Trash2 } from "lucide-react";
import { canEditQuoteDesk, industryCategoryOptions, updatePotentialSchema, type CrmLane, type UpdatePotentialInput, type UpdateQuoteInput } from "@speego/shared";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/features/auth/session-provider";
import { ApiError, api } from "@/lib/api";
import type { Role } from "@/types/role";
import { useExcelImport } from "./excel-import";
import { LeadCreate } from "./lead-create";
import { crmPath, LaneSwitch, useCrmLane } from "./lane";
import { dateRangeError, FilterSelect, ListSearchBar, searchParams, useAppliedSearch } from "./list-search-bar";
import { RowMenu } from "./row-menu";
import { QuoteEditor, quoteFieldsFromPotential } from "./quote-editor";
import { QuoteTracking } from "./quote-tracking";
import { missingQuoteFields } from "./potential-quote-validation";
import { RequirementImageSlider } from "./requirement-image-slider";
import { TableHScroll } from "./table-h-scroll";
import { CareChannelBadge, CustomerKindBadge, CustomerTypeBadge, LogisticsClassBadge, PotentialStatusBadge, QuoteStatusBadge } from "./status-badges";
import { brandOptions, careChannelOptions, classificationOptions, customerKindOptions, customerTypeOptions, labelOf, potentialOptions, type PotentialRecord, type QuoteRecord } from "./types";

const writeRoles: Role[] = ["admin", "sale-vn", "sale-global"];
const sourceOptions = [
  ["ADS", "ADS"],
  ["GG", "GG"],
  ["OG", "OG"],
  ["AF", "AF"],
  ["REFERRAL", "Referral"],
  ["OUTBOUND", "Outbound"],
  ["OTHER", "Khác"],
] as const;

function BrandTag({ brand }: { brand: string | null }) {
  const item = brandOptions.find((option) => option[0] === brand);
  if (!item) return <span className="text-muted-foreground">—</span>;
  return <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${item[2]}`}>{item[1]}</span>;
}

function PotentialQuoteStatus({ row }: { row: PotentialRecord }) {
  const status = (value: string | null) => value
    ? <QuoteStatusBadge value={value} />
    : <span className="text-muted-foreground">Chưa tạo báo giá</span>;
  if (row.customerKind === "LOGISTICS") return status(row.logisticsQuoteStatus);
  if (row.customerKind === "SOURCING" && row.quoteWorkflow === "COMBINED") return (
    <div className="grid gap-1">
      <span>Sourcing: {status(row.sourcingQuoteStatus)}</span>
      <span>Logistics: {status(row.logisticsQuoteStatus)}</span>
    </div>
  );
  return status(row.sourcingQuoteStatus);
}

function MessLinkedCell({ value, linkMess, className }: { value: string | null; linkMess: string | null; className?: string }) {
  const text = value?.trim() || "";
  if (!text) return <span className={className}>—</span>;
  if (linkMess && /^https?:\/\//i.test(linkMess)) {
    return (
      <a href={linkMess} target="_blank" rel="noreferrer" className={`text-primary hover:underline ${className ?? ""}`} title={text}>
        {text}
      </a>
    );
  }
  return <span className={className} title={text}>{text}</span>;
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
  packageDimensions: string;
  weightKg: string;
  logisticsClass: "" | NonNullable<UpdatePotentialInput["logisticsClass"]>;
  shippingMode: "" | NonNullable<UpdatePotentialInput["shippingMode"]>;
  shipFromAddress: string;
  shipToAddress: string;
  requirements: string;
  requirementImages: string[];
  convertReason: string;
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
    customerKind: row.customerKind === "SOURCING" || row.customerKind === "LOGISTICS" ? row.customerKind : "",
    customerType: row.customerType === "INDIVIDUAL" || row.customerType === "PRINCIPAL" || row.customerType === "ENTERPRISE" ? row.customerType : "",
    brand: brandOptions.some((item) => item[0] === row.brand) ? row.brand as Draft["brand"] : "",
    careChannel: careChannelOptions.some((item) => item[0] === row.careChannel) ? row.careChannel as Draft["careChannel"] : "",
    classification: row.classification === "LCL" || row.classification === "FCL" ? row.classification : "",
    packSpec: row.packSpec ?? "",
    packageDimensions: row.packageDimensions ?? "",
    weightKg: row.weightKg == null ? "" : String(row.weightKg),
    logisticsClass: row.logisticsClass === "LCL" || row.logisticsClass === "FCL" ? row.logisticsClass : "",
    shippingMode: row.shippingMode ?? "",
    shipFromAddress: row.shipFromAddress ?? "",
    shipToAddress: row.shipToAddress ?? "",
    requirements: row.requirements ?? "",
    requirementImages: row.requirementImages ?? [],
    convertReason: row.convertReason ?? "",
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
  const [orderQuote, setOrderQuote] = useState<QuoteRecord | null>(null);
  const [orderDesk, setOrderDesk] = useState<"sourcing" | "logistics">("logistics");
  const [orderPending, setOrderPending] = useState(false);
  const [orderError, setOrderError] = useState<string>();
  const canPrice = canEditQuoteDesk(user.role, "logistics");
  const filters = useAppliedSearch({ q: "", from: "", to: "", source: "", potential: "", customerKind: "", customerType: "" });

  const load = useCallback(() => {
    const rangeError = dateRangeError(filters.applied.from, filters.applied.to);
    if (rangeError) {
      setError(rangeError);
      return;
    }
    setError(undefined);
    const query = searchParams(filters.applied, {
      source: filters.applied.source,
      potential: filters.applied.potential,
      customerKind: filters.applied.customerKind,
      customerType: filters.applied.customerType,
    });
    api<{ potentials: PotentialRecord[] }>(`${crmPath("/api/crm/potentials", lane)}${query}`)
      .then((body) => setRows(body.potentials))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tải được khách hàng tiềm năng"));
  }, [filters.applied, lane]);

  const excel = useExcelImport({ kind: "potentials", lane, allLanes: canPick, enabled: canWrite, onDone: load });

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
    if (!draft.customerKind) {
      setFormError("Chọn loại khách");
      return;
    }
    const missing = missingQuoteFields({ ...draft, shippingMode: draft.shippingMode || null });
    if (missing.length > 0) {
      setFormError(`Cần nhập đủ thông tin trước khi lưu: ${missing.join(", ")}.`);
      return;
    }
    const parsed = updatePotentialSchema.safeParse({
      ...draft,
      customerKind: draft.customerKind || undefined,
      customerType: draft.customerType || undefined,
      brand: draft.brand || undefined,
      careChannel: draft.careChannel || undefined,
      classification: draft.classification || undefined,
      // Giữ số liệu lấy từ đơn hàng tự cập nhật nếu Sale không sửa trực tiếp hồ sơ.
      packageDimensions: draft.packageDimensions === (editing.packageDimensions ?? "") ? undefined : draft.packageDimensions,
      weightKg: draft.weightKg === (editing.weightKg ?? "") ? undefined : draft.weightKg,
      logisticsClass: draft.logisticsClass || undefined,
      shippingMode: draft.shippingMode || undefined,
      shipFromAddress: draft.shipFromAddress || undefined,
      shipToAddress: draft.shipToAddress || undefined,
      requirements: draft.requirements || undefined,
      requirementImages: draft.requirementImages,
      convertReason: draft.convertReason || undefined,
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

  const openOrderQuote = (row: PotentialRecord) => {
    setError(undefined);
    setNotice(undefined);
    setOrderError(undefined);
    const request = canWrite
      ? api<{ quote: QuoteRecord; desk?: "sourcing" | "logistics" }>(crmPath(`/api/crm/potentials/${row.id}/quotes`, lane), { method: "POST" })
      : api<{ quote: QuoteRecord }>(crmPath(`/api/crm/potentials/${row.id}/logistics-quote`, lane));
    void request
      .then((body) => {
        const desk = "desk" in body && (body.desk === "sourcing" || body.desk === "logistics") ? body.desk : "logistics";
        setOrderDesk(desk);
        setOrderQuote(body.quote);
        load();
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không mở được báo giá"));
  };

  const requestQuote = (row: PotentialRecord) => {
    if (!row.customerKind) {
      setError(undefined);
      open(row);
      setFormError("Chọn loại khách trước khi báo giá");
      return;
    }
    const missing = missingQuoteFields(row);
    if (missing.length > 0) {
      setError(undefined);
      open(row);
      setFormError(`Cần nhập đủ thông tin trước khi báo giá: ${missing.join(", ")}.`);
      return;
    }
    openOrderQuote(row);
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
        setNotice(orderContent && canPrice ? "Đã lưu báo giá" : orderContent ? "Đã lưu thông tin đơn hàng" : "Đã lưu chi phí logistics");
        load();
        return true;
      })
      .catch((err: unknown) => {
        setOrderError(err instanceof ApiError ? err.message : orderContent ? "Không lưu được thông tin đơn hàng" : "Không lưu được giá logistics");
        return false;
      })
      .finally(() => setOrderPending(false));
  };

  const saveOrderLead = (input: UpdatePotentialInput) => {
    if (!orderQuote) return Promise.resolve(null);
    return api<{ potential: PotentialRecord }>(crmPath(`/api/crm/potentials/${orderQuote.potentialId}`, lane), {
      method: "PATCH",
      body: JSON.stringify(input),
    })
      .then((body) => {
        const patch = quoteFieldsFromPotential(input, body.potential.requirementImages ?? input.requirementImages ?? []);
        setOrderQuote((current) => (current ? { ...current, ...patch } : current));
        return patch;
      })
      .catch((err: unknown) => {
        setOrderError(err instanceof ApiError ? err.message : "Không lưu được thông tin khách");
        return null;
      });
  };

  const handoffOrder = (desk: "sourcing" | "logistics") => {
    if (!orderQuote) return Promise.resolve(false);
    setOrderPending(true);
    setOrderError(undefined);
    const path = desk === "sourcing" ? "handoff-sourcing" : "handoff-logistics";
    const done = desk === "sourcing" ? "Đã chuyển thông tin đơn hàng cho Sourcing" : "Đã chuyển thông tin đơn hàng cho Logistics";
    const failed = desk === "sourcing" ? "Không chuyển được cho Sourcing" : "Không chuyển được cho Logistics";
    return api<{ quote: QuoteRecord }>(crmPath(`/api/crm/quotes/${orderQuote.id}/${path}`, lane), { method: "POST" })
      .then(() => {
        setNotice(done);
        setOrderQuote(null);
        load();
        return true;
      })
      .catch((err: unknown) => {
        setOrderError(err instanceof ApiError ? err.message : failed);
        return false;
      })
      .finally(() => setOrderPending(false));
  };

  const remove = () => {
    if (!removing) return;
    const id = removing.id;
    setRemoving(null);
    void api(crmPath(`/api/crm/potentials/${id}`, lane), { method: "DELETE" })
      .then(load)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không xóa được"));
  };

  return (
    <>
      <PageHeader
        title="Khách hàng tiềm năng"
        description={lane === "vn" ? "Khách tiềm năng tuyến Việt Nam, chuyển từ mess cùng tuyến." : "Khách tiềm năng tuyến Global, chuyển từ mess cùng tuyến."}
        actions={
          <>
            {canPick ? <LaneSwitch lane={lane} onChange={setLane} /> : null}
            {excel.buttons}
            {canWrite && <LeadCreate lane={lane} error={error} setError={setError} setNotice={setNotice} onDone={load} />}
          </>
        }
      />
      {notice && <InlineAlert tone="success" className="mb-4">{notice}</InlineAlert>}
      {error && <InlineAlert className="mb-4">{error}</InlineAlert>}
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
        dateLabel="Từ ngày tạo"
      >
        <FilterSelect id="lead-source" label="Nguồn" value={filters.draft.source} onChange={(value) => filters.set("source", value)} options={sourceOptions} />
        <FilterSelect id="lead-potential" label="Giai đoạn" value={filters.draft.potential} onChange={(value) => filters.set("potential", value)} options={potentialOptions} />
        <FilterSelect id="lead-kind" label="Loại khách" value={filters.draft.customerKind} onChange={(value) => filters.set("customerKind", value)} options={customerKindOptions} />
        <FilterSelect id="lead-type" label="Đối tượng" value={filters.draft.customerType} onChange={(value) => filters.set("customerType", value)} options={customerTypeOptions} />
      </ListSearchBar>
      <TableHScroll stickyIdentity>
        <table className="w-max min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="whitespace-nowrap px-3 py-2 font-medium">Mã</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Khách</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Công ty</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Số điện thoại</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Email</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Mess</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Nguồn</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Giai đoạn</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Tình trạng báo giá</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Loại khách</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Đối tượng</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Hàng hóa</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Ngành hàng</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Số lượng</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Địa chỉ</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Ghi chú sale</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Kênh chăm sóc</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Phân loại</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Quy cách</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Kích thước kiện hàng</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Trọng lượng</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Phân loại logistics</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Địa chỉ gửi</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Địa chỉ nhận</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={25} className="px-3 py-8 text-center text-muted-foreground">{filters.active ? "Không có kết quả." : "Chưa có khách hàng tiềm năng."}</td></tr>}
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-3 py-3 font-medium"><QuoteTracking variant="code" code={row.leadCode} potentialId={row.id} lane={lane} /></td>
                <td className="px-3 py-3" title={row.fullName ?? undefined}>{row.fullName}</td>
                <td className="px-3 py-3">{row.companyName || "—"}</td>
                <td className="px-3 py-3">{row.phone || "—"}</td>
                <td className="px-3 py-3">{row.email || "—"}</td>
                <td className="px-3 py-3">{row.messCode ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-3"><BrandTag brand={row.brand} /></td>
                <td className="px-3 py-3"><PotentialStatusBadge value={row.potential} /></td>
                <td className="whitespace-nowrap px-3 py-3"><PotentialQuoteStatus row={row} /></td>
                <td className="px-3 py-3"><CustomerKindBadge value={row.customerKind} /></td>
                <td className="px-3 py-3"><CustomerTypeBadge value={row.customerType} /></td>
                <td className="max-w-48 truncate px-3 py-3"><MessLinkedCell value={row.productInterest} linkMess={row.linkMess} className="truncate" /></td>
                <td className="max-w-56 truncate px-3 py-3" title={labelOf(industryCategoryOptions, row.industry)}>{labelOf(industryCategoryOptions, row.industry)}</td>
                <td className="px-3 py-3">{row.quantityNote || "—"}</td>
                <td className="max-w-48 truncate px-3 py-3"><MessLinkedCell value={row.address} linkMess={row.linkMess} className="truncate" /></td>
                <td className="max-w-48 truncate px-3 py-3"><MessLinkedCell value={row.saleNote} linkMess={row.linkMess} className="truncate" /></td>
                <td className="px-3 py-3"><CareChannelBadge value={row.careChannel} /></td>
                <td className="px-3 py-3"><LogisticsClassBadge value={row.classification} /></td>
                <td className="max-w-48 truncate px-3 py-3" title={row.packSpec ?? undefined}>{row.packSpec || "—"}</td>
                <td className="max-w-48 truncate px-3 py-3" title={row.packageDimensions ?? undefined}>{row.packageDimensions || "—"}</td>
                <td className="max-w-48 truncate px-3 py-3" title={row.weightKg ?? undefined}>{row.weightKg || "—"}</td>
                <td className="max-w-48 truncate px-3 py-3">{row.shippingMode === "AIR" ? "Đường bay" : row.shippingMode === "SEA" ? `Đường biển ${row.logisticsClass || ""}`.trim() : row.logisticsClass || "—"}</td>
                <td className="max-w-48 truncate px-3 py-3" title={row.shipFromAddress ?? undefined}>{row.shipFromAddress || "—"}</td>
                <td className="max-w-48 truncate px-3 py-3" title={row.shipToAddress ?? undefined}>{row.shipToAddress || "—"}</td>
                <td className="px-3 py-3">
                  <RowMenu
                    label={`Thao tác ${row.leadCode}`}
                    items={canWrite ? [
                      { key: "quote", label: "Báo giá", icon: <FileText />, onClick: () => requestQuote(row) },
                      { key: "edit", label: "Sửa", icon: <Pencil />, onClick: () => open(row) },
                      { key: "delete", label: "Xóa", icon: <Trash2 />, destructive: true, onClick: () => setRemoving(row) },
                    ] : canPrice && row.customerKind === "LOGISTICS" ? [
                      { key: "prices", label: "Nhập giá", icon: <FileText />, onClick: () => openOrderQuote(row) },
                    ] : []}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableHScroll>

      <Dialog open={draft !== null} onOpenChange={(openDialog) => { if (!openDialog) { setDraft(null); setEditing(null); } }}>
        <DialogContent className="flex max-h-[92dvh] w-full flex-col gap-4 overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Sửa khách hàng tiềm năng</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid max-h-[min(68vh,720px)] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              {formError && <div className="sm:col-span-2"><InlineAlert>{formError}</InlineAlert></div>}
              <Field label="Tên khách" htmlFor="pot-name" required>
                <Input id="pot-name" value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} />
              </Field>
              <Field label="Công ty" htmlFor="pot-company">
                <Input id="pot-company" value={draft.companyName} onChange={(event) => setDraft({ ...draft, companyName: event.target.value })} />
              </Field>
              <Field label="Số điện thoại" htmlFor="pot-phone" required>
                <Input id="pot-phone" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} />
              </Field>
              <Field label="Email" htmlFor="pot-email">
                <Input id="pot-email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
              </Field>
              <Field label="Nguồn" htmlFor="pot-brand" required>
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
              <Field label="Loại khách" htmlFor="pot-kind" required>
                <NativeSelect id="pot-kind" value={draft.customerKind} onChange={(event) => setDraft({ ...draft, customerKind: event.target.value as Draft["customerKind"] })}>
                  <option value="">Chưa chọn</option>
                  {customerKindOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Đối tượng" htmlFor="pot-type" required>
                <NativeSelect id="pot-type" value={draft.customerType} onChange={(event) => setDraft({ ...draft, customerType: event.target.value as Draft["customerType"] })}>
                  <option value="">Chưa chọn</option>
                  {customerTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field
                label="Hàng hóa"
                htmlFor="pot-goods"
                required
                hint={editing?.linkMess ? "Link từ mess" : editing?.messCode ? `Từ mess ${editing.messCode}` : undefined}
              >
                <Input id="pot-goods" value={draft.productInterest} onChange={(event) => setDraft({ ...draft, productInterest: event.target.value })} />
              </Field>
              <Field label="Số lượng" htmlFor="pot-qty" required>
                <Input id="pot-qty" value={draft.quantityNote} onChange={(event) => setDraft({ ...draft, quantityNote: event.target.value })} />
              </Field>
              <Field
                label="Địa chỉ"
                htmlFor="pot-address"
                required
                hint={editing?.linkMess ? "Link từ mess" : undefined}
              >
                <Input id="pot-address" value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} />
              </Field>
              <Field
                label="Ghi chú sale"
                htmlFor="pot-note"
                required
                hint={editing?.linkMess ? "Link từ mess" : editing?.messCode ? `Từ mess ${editing.messCode}` : undefined}
              >
                <Input id="pot-note" value={draft.saleNote} onChange={(event) => setDraft({ ...draft, saleNote: event.target.value })} />
              </Field>
              <Field
                label="Kênh chăm sóc"
                htmlFor="pot-care"
                required
                hint={editing?.linkMess ? "Link từ mess" : undefined}
              >
                <NativeSelect id="pot-care" value={draft.careChannel} onChange={(event) => setDraft({ ...draft, careChannel: event.target.value as Draft["careChannel"] })}>
                  <option value="">Chưa chọn</option>
                  {careChannelOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Phân loại" htmlFor="pot-class">
                <NativeSelect id="pot-class" value={draft.classification} onChange={(event) => setDraft({ ...draft, classification: event.target.value as Draft["classification"] })}>
                  <option value="">Chưa chọn</option>
                  {classificationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              {editing?.linkMess && /^https?:\/\//i.test(editing.linkMess) && (
                <p className="text-sm sm:col-span-2">
                  <a href={editing.linkMess} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    Mở link mess
                  </a>
                </p>
              )}
              {draft.customerKind !== "LOGISTICS" && (
                <Field label="Quy cách đóng gói đã lưu (Logistics nhập tại báo giá)" htmlFor="pot-pack" className="sm:col-span-2">
                  <Textarea id="pot-pack" rows={3} value={draft.packSpec} readOnly />
                </Field>
              )}
              <Field label="Phương thức vận chuyển" htmlFor="pot-shipping-mode" required={draft.customerKind === "LOGISTICS"}>
                <NativeSelect id="pot-shipping-mode" value={draft.shippingMode} onChange={(event) => setDraft({ ...draft, shippingMode: event.target.value as Draft["shippingMode"], logisticsClass: "", classification: "" })}>
                  <option value="">Chưa chọn</option><option value="AIR">Đường bay</option><option value="SEA">Đường biển</option>
                </NativeSelect>
              </Field>
              <Field label="Kích thước kiện hàng (KH logistics)" htmlFor="pot-dimensions" required={draft.customerKind === "LOGISTICS" && draft.logisticsClass !== "FCL"}>
                <Input id="pot-dimensions" value={draft.packageDimensions} placeholder="Dài × rộng × cao, đơn vị cm" onChange={(event) => setDraft({ ...draft, packageDimensions: event.target.value })} />
              </Field>
              <Field label="Trọng lượng (KH logistics)" htmlFor="pot-weight" required={draft.customerKind === "LOGISTICS"}>
                <Input id="pot-weight" value={draft.weightKg} placeholder="Ví dụ: khoảng 20 kg/kiện" onChange={(event) => setDraft({ ...draft, weightKg: event.target.value })} />
              </Field>
              {draft.shippingMode === "SEA" && <Field label="Phân loại (KH logistics)" htmlFor="pot-logistics" required={draft.customerKind === "LOGISTICS"}>
                <NativeSelect id="pot-logistics" value={draft.logisticsClass} onChange={(event) => setDraft({ ...draft, logisticsClass: event.target.value as Draft["logisticsClass"], classification: event.target.value as Draft["classification"] })}>
                  <option value="">Chưa chọn</option>
                  {classificationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>}
              <Field label="Địa chỉ gửi hàng (KH logistics)" htmlFor="pot-from">
                <Textarea id="pot-from" rows={3} value={draft.shipFromAddress} onChange={(event) => setDraft({ ...draft, shipFromAddress: event.target.value })} />
              </Field>
              <Field label="Địa chỉ nhận hàng (KH logistics)" htmlFor="pot-to" required={draft.customerKind === "LOGISTICS"}>
                <Textarea id="pot-to" rows={3} value={draft.shipToAddress} onChange={(event) => setDraft({ ...draft, shipToAddress: event.target.value })} />
              </Field>
              <Field label="Yêu cầu của khách" htmlFor="pot-requirements" className="sm:col-span-2" required={draft.customerKind === "LOGISTICS"}>
                <Textarea id="pot-requirements" rows={4} value={draft.requirements} onChange={(event) => setDraft({ ...draft, requirements: event.target.value })} />
              </Field>
              <Field label="Lý do chuyển" htmlFor="pot-convert-reason" className="sm:col-span-2" required={draft.customerKind === "LOGISTICS"}>
                <Textarea id="pot-convert-reason" rows={2} value={draft.convertReason} onChange={(event) => setDraft({ ...draft, convertReason: event.target.value })} />
              </Field>
              {draft.requirementImages.length > 0 && (
                <div className="sm:col-span-2">
                  <RequirementImageSlider key={editing?.id} images={draft.requirementImages} />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDraft(null); setEditing(null); }}>Hủy</Button>
            <Button disabled={pending} onClick={save}>{pending ? "Đang lưu…" : "Lưu"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {orderQuote && (
        <QuoteEditor
          key={orderQuote.id}
          quote={orderQuote}
          templates={[]}
          editMode={canPrice ? "full" : canWrite ? "content" : "none"}
          desk={orderDesk}
          saleOrder={canWrite}
          pending={orderPending}
          error={orderError}
          onClose={() => setOrderQuote(null)}
          onSave={(input) => saveOrderPart(input, canWrite)}
          onSaveSale={canWrite ? saveOrderLead : undefined}
          onHandoffLogistics={canWrite && orderQuote.customerKind === "LOGISTICS" ? () => handoffOrder("logistics") : undefined}
          onHandoffSourcing={canWrite && orderQuote.customerKind === "SOURCING" ? () => handoffOrder("sourcing") : undefined}
        />
      )}

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
