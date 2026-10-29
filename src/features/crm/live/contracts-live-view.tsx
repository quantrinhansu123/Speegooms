"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Pencil, Send, Trash2 } from "lucide-react";
import { accountingContractSchema, contractPaymentFlags, contractShipToOptions, createContractSchema, opsContractSchema, opsStatusOptions, quoteCurrencies, type CrmLane, type QuoteCurrency } from "@speego/shared";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/features/auth/session-provider";
import { ApiError, api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Role } from "@/types/role";
import { crmPath, LaneSwitch, useCrmLane } from "./lane";
import { dateRangeError, FilterSelect, ListSearchBar, searchParams, useAppliedSearch } from "./list-search-bar";
import { RowMenu } from "./row-menu";
import { labelOf } from "./types";

export type ContractRecord = {
  id: string;
  code: string;
  lane: CrmLane;
  quoteId: string;
  quoteCode: string;
  customerName: string;
  saleName: string | null;
  shipTo: string | null;
  product: string | null;
  quantity: number | null;
  currency: QuoteCurrency;
  productValue: number;
  shippingCost: number;
  totalValue: number;
  paidAmount: number;
  balance: number;
  signedOn: string | null;
  opsStatus: string;
  tracking: string;
  note1: string;
  note2: string;
  chinaWarehouseOn: string | null;
  containerOn: string | null;
  arrivalOn: string | null;
  deliveryOn: string | null;
  sentToAccountingAt: string | null;
  sentToOpsAt: string | null;
  confirmedBackAt: string | null;
  confirmedAmount: number | null;
  accountingStatus: string | null;
  images: string[];
  createdAt: string;
};

const accountingStatusOptions = [
  ["DA_HOAN_THANH_COC", "Đã hoàn thành cọc"],
  ["DA_HOAN_THANH_THANH_TOAN", "Đã hoàn thành thanh toán"],
  ["CHUA_HOAN_THANH_COC", "Chưa hoàn thành cọc"],
  ["CHUA_HOAN_THANH_THANH_TOAN", "Chưa hoàn thành thanh toán"],
] as const;

const opsRoles: Role[] = ["admin", "van-hanh"];
const accountingRoles: Role[] = ["admin", "ke-toan"];
const saleRoles: Role[] = ["admin", "sale-vn", "sale-global"];

function money(value: number | null, currency: QuoteCurrency): string {
  return value == null ? "—" : formatMoney(value, currency);
}

function shownStamp(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

function handoffLines(mode: "sale" | "ops" | "accounting", row: ContractRecord): string[] {
  if (mode === "ops") {
    return [
      row.sentToOpsAt ? `Sale gửi lại ${shownStamp(row.sentToOpsAt)}` : "",
      row.confirmedBackAt ? `Kế toán gửi lại ${shownStamp(row.confirmedBackAt)}` : "",
    ].filter(Boolean);
  }
  if (mode === "accounting") {
    return row.sentToAccountingAt ? [`Vận hành gửi lại ${shownStamp(row.sentToAccountingAt)}`] : [];
  }
  return row.confirmedBackAt ? [`Kế toán gửi lại ${shownStamp(row.confirmedBackAt)}`] : [];
}

function shownDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return value.length <= 10 ? value.split("-").reverse().join("/") : date.toLocaleDateString("vi-VN");
}

function FlagCell({ active, tone, label }: { active: boolean; tone: "success" | "danger"; label: string }) {
  if (!active) return <span className="text-muted-foreground">—</span>;
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 280;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Không đọc được ảnh");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const url = canvas.toDataURL("image/jpeg", 0.72);
  if (url.length > 90_000) throw new Error("Ảnh quá lớn, hãy chọn ảnh nhỏ hơn");
  return url;
}

export function ContractsLiveView({
  lane: fixedLane,
  mode,
}: {
  lane?: CrmLane;
  mode: "sale" | "ops" | "accounting";
}) {
  const user = useSession();
  const { lane, canPick, setLane } = useCrmLane(fixedLane);
  const canOps = mode === "ops" && opsRoles.includes(user.role);
  const canAccounting = mode === "accounting" && accountingRoles.includes(user.role);
  const canSale = mode === "sale" && saleRoles.includes(user.role);
  const canResend = canSale || canOps || (mode === "accounting" && user.role === "ke-toan");
  const canDelete = mode === "accounting" && user.role === "ke-toan";
  const [rows, setRows] = useState<ContractRecord[]>([]);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [selected, setSelected] = useState<ContractRecord | null>(null);
  const [removing, setRemoving] = useState<ContractRecord | null>(null);
  const filters = useAppliedSearch({ q: "", from: "", to: "", opsStatus: "", accountingStatus: "" });
  const opsStatusFilterOptions = opsStatusOptions.map((status) => [status, status] as const);

  const load = useCallback(async () => {
    const rangeError = dateRangeError(filters.applied.from, filters.applied.to);
    if (rangeError) {
      setError(rangeError);
      return;
    }
    setError(undefined);
    try {
      const path = crmPath(`/api/crm/contracts?view=${mode}`, lane);
      const sent = mode === "accounting" ? "&sent=1" : "";
      const query = searchParams(filters.applied, {
        opsStatus: filters.applied.opsStatus,
        accountingStatus: filters.applied.accountingStatus,
      });
      const body = await api<{ contracts: ContractRecord[] }>(`${path}${sent}${query}`);
      setRows(body.contracts);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không tải được hợp đồng");
    }
  }, [filters.applied, lane, mode]);

  useEffect(() => { load(); }, [load]);

  const resend = async (row: ContractRecord) => {
    const to = mode === "sale" ? "ops" : mode === "ops" ? "accounting" : "parties";
    const message = mode === "sale"
      ? `Đã gửi lại hợp đồng ${row.code} cho Vận hành.`
      : mode === "ops"
        ? `Đã gửi lại hợp đồng ${row.code} cho Kế toán.`
        : `Đã gửi lại hợp đồng ${row.code} cho Sale và Vận hành.`;
    setError(undefined);
    try {
      const body = await api<{ contract: ContractRecord }>(`${crmPath(`/api/crm/contracts/${row.id}/resend`, lane)}&to=${to}`, { method: "POST" });
      setSelected((current) => current?.id === body.contract.id ? body.contract : current);
      setNotice(message);
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không gửi lại được hợp đồng");
    }
  };

  const remove = async () => {
    if (!removing) return;
    const target = removing;
    setRemoving(null);
    try {
      await api(crmPath(`/api/crm/contracts/${target.id}`, lane), { method: "DELETE" });
      setSelected((current) => current?.id === target.id ? null : current);
      setNotice(`Đã xóa hợp đồng ${target.code}.`);
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không xóa được hợp đồng");
    }
  };

  return (
    <>
      <PageHeader
        title="Hợp đồng"
        description={
          mode === "accounting"
            ? "Hợp đồng vận hành đã gửi sang kế toán."
            : lane === "vn" ? "Hợp đồng tuyến Việt Nam." : "Hợp đồng tuyến Global."
        }
        actions={canPick ? <LaneSwitch lane={lane} onChange={setLane} /> : null}
      />
      {notice && <InlineAlert tone="success" className="mb-4">{notice}</InlineAlert>}
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
        dateLabel="Từ ngày ký"
      >
        <FilterSelect id="contract-ops-status" label="Trạng thái vận hành" value={filters.draft.opsStatus} onChange={(value) => filters.set("opsStatus", value)} options={opsStatusFilterOptions} />
        <FilterSelect id="contract-accounting-status" label="Trạng thái kế toán" value={filters.draft.accountingStatus} onChange={(value) => filters.set("accountingStatus", value)} options={accountingStatusOptions} />
      </ListSearchBar>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[1480px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Mã</th>
              <th className="px-3 py-2 font-medium">Báo giá</th>
              <th className="px-3 py-2 font-medium">Khách</th>
              <th className="px-3 py-2 font-medium">Sản phẩm</th>
              <th className="px-3 py-2 font-medium">Tổng giá trị</th>
              <th className="px-3 py-2 font-medium">Còn lại</th>
              <th className="px-3 py-2 font-medium">Dục thanh toán để giao hàng</th>
              <th className="px-3 py-2 font-medium">Đủ điều kiện đi hàng</th>
              <th className="px-3 py-2 font-medium">Đủ điều kiện giao hàng</th>
              <th className="px-3 py-2 font-medium">Vận hành</th>
              <th className="px-3 py-2 font-medium">Kế toán</th>
              <th className="px-3 py-2 font-medium">Gửi lại</th>
              <th className="px-3 py-2 font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">{filters.active ? "Không có kết quả." : "Chưa có hợp đồng."}</td></tr>
            )}
            {rows.map((row) => {
              const flags = contractPaymentFlags({
                totalValue: row.totalValue,
                confirmedAmount: row.confirmedAmount,
                deliveryOn: row.deliveryOn,
              });
              return (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-3 py-3 font-medium">{row.code}</td>
                <td className="px-3 py-3">{row.quoteCode || "—"}</td>
                <td className="px-3 py-3">{row.customerName}</td>
                <td className="max-w-48 truncate px-3 py-3" title={row.product ?? undefined}>{row.product || "—"}</td>
                <td className="px-3 py-3">{money(row.totalValue, row.currency)}</td>
                <td className="px-3 py-3">{money(row.balance, row.currency)}</td>
                <td className="max-w-56 px-3 py-3">
                  <FlagCell active={flags.urgePayment} tone="danger" label={flags.urgePaymentLabel} />
                </td>
                <td className="px-3 py-3">
                  <FlagCell active={flags.eligibleToShip} tone="success" label={flags.eligibleToShipLabel} />
                </td>
                <td className="px-3 py-3">
                  <FlagCell active={flags.eligibleToDeliver} tone="success" label={flags.eligibleToDeliverLabel} />
                </td>
                <td className="px-3 py-3">{row.opsStatus || "—"}</td>
                <td className="px-3 py-3">
                  {mode !== "accounting" && !row.sentToAccountingAt
                    ? "Chưa gửi"
                    : mode !== "accounting" && !row.confirmedBackAt
                      ? "—"
                      : labelOf(accountingStatusOptions, row.accountingStatus)}
                </td>
                <td className="px-3 py-3">
                  {handoffLines(mode, row).length === 0 ? "—" : handoffLines(mode, row).map((line) => <p key={line}>{line}</p>)}
                </td>
                <td className="px-3 py-3">
                  <RowMenu
                    label={`Thao tác ${row.code}`}
                    items={[
                      {
                        key: "open",
                        label: canSale || canOps || canAccounting ? "Cập nhật" : "Xem",
                        icon: canSale || canOps || canAccounting ? <Pencil /> : <Eye />,
                        onClick: () => { setNotice(undefined); setSelected(row); },
                      },
                      ...(canResend ? [{
                        key: "resend",
                        label: "Gửi lại",
                        icon: <Send />,
                        onClick: () => { void resend(row); },
                      }] : []),
                      ...(canDelete ? [{
                        key: "delete",
                        label: "Xóa",
                        icon: <Trash2 />,
                        destructive: true,
                        onClick: () => setRemoving(row),
                      }] : []),
                    ]}
                  />
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        destructive
        title="Xóa hợp đồng?"
        description={removing ? `${removing.code} sẽ bị xóa. Báo giá ${removing.quoteCode || ""} trở lại trạng thái chưa tạo hợp đồng.` : ""}
        confirmLabel="Xóa"
        onConfirm={() => { void remove(); }}
      />
      {selected && (
        <ContractDialog
          key={selected.id}
          contract={selected}
          canSale={canSale}
          canOps={canOps}
          canAccounting={canAccounting}
          canResend={canResend}
          onClose={() => setSelected(null)}
          onResend={resend}
          onSaved={(contract, message) => {
            setSelected(contract);
            setNotice(message);
            load();
          }}
        />
      )}
    </>
  );
}

function numberValue(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function ContractDialog({
  contract,
  canSale,
  canOps,
  canAccounting,
  canResend,
  onClose,
  onSaved,
  onResend,
}: {
  contract: ContractRecord;
  canSale: boolean;
  canOps: boolean;
  canAccounting: boolean;
  canResend: boolean;
  onClose: () => void;
  onSaved: (contract: ContractRecord, message: string) => void;
  onResend: (contract: ContractRecord) => Promise<void>;
}) {
  const [currency, setCurrency] = useState<QuoteCurrency>(contract.currency);
  const [customerName, setCustomerName] = useState(contract.customerName);
  const [saleName, setSaleName] = useState(contract.saleName ?? "");
  const [shipTo, setShipTo] = useState(
    (contractShipToOptions as readonly string[]).includes(contract.shipTo ?? "") ? (contract.shipTo ?? "") : "",
  );
  const [product, setProduct] = useState(contract.product ?? "");
  const [quantity, setQuantity] = useState(contract.quantity == null ? "" : String(contract.quantity));
  const [productValueText, setProductValueText] = useState(String(contract.productValue));
  const [shippingCost, setShippingCost] = useState(String(contract.shippingCost));
  const [totalValue, setTotalValue] = useState(String(contract.totalValue));
  const [paidAmount, setPaidAmount] = useState(String(contract.paidAmount));
  const [signedOn, setSignedOn] = useState(contract.signedOn ?? "");
  const [opsStatus, setOpsStatus] = useState(contract.opsStatus);
  const [tracking, setTracking] = useState(contract.tracking);
  const [note1, setNote1] = useState(contract.note1);
  const [note2, setNote2] = useState(contract.note2);
  const [chinaWarehouseOn, setChinaWarehouseOn] = useState(contract.chinaWarehouseOn ?? "");
  const [containerOn, setContainerOn] = useState(contract.containerOn ?? "");
  const [arrivalOn, setArrivalOn] = useState(contract.arrivalOn ?? "");
  const [deliveryOn, setDeliveryOn] = useState(contract.deliveryOn ?? "");
  const [confirmedAmount, setConfirmedAmount] = useState(contract.confirmedAmount == null ? "" : String(contract.confirmedAmount));
  const [accountingStatus, setAccountingStatus] = useState(contract.accountingStatus ?? "");
  const [images, setImages] = useState(contract.images);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const paymentFlags = contractPaymentFlags({
    totalValue: numberValue(totalValue) ?? contract.totalValue,
    confirmedAmount: confirmedAmount.trim() ? numberValue(confirmedAmount) : null,
    deliveryOn: deliveryOn || null,
  });

  const saveCommercial = async (resendAfter: boolean) => {
    const parsed = createContractSchema.safeParse({
      currency,
      customerName,
      saleName,
      shipTo,
      product,
      quantity: numberValue(quantity),
      productValue: numberValue(productValueText) ?? Number.NaN,
      shippingCost: numberValue(shippingCost) ?? 0,
      totalValue: numberValue(totalValue) ?? Number.NaN,
      paidAmount: numberValue(paidAmount) ?? 0,
      signedOn,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Thông tin hợp đồng chưa đúng");
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      const body = await api<{ contract: ContractRecord }>(crmPath(`/api/crm/contracts/${contract.id}/commercial`, contract.lane), {
        method: "PATCH",
        body: JSON.stringify(parsed.data),
      });
      if (resendAfter) await onResend(body.contract);
      else onSaved(body.contract, "Đã lưu hợp đồng.");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không lưu được hợp đồng");
    } finally {
      setPending(false);
    }
  };

  const saveOps = async (resendAfter: boolean) => {
    const parsed = opsContractSchema.safeParse({
      opsStatus, tracking, note1, note2, chinaWarehouseOn, containerOn, arrivalOn, deliveryOn,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Thông tin vận hành chưa đúng");
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      const body = await api<{ contract: ContractRecord }>(crmPath(`/api/crm/contracts/${contract.id}/ops`, contract.lane), {
        method: "PATCH",
        body: JSON.stringify(parsed.data),
      });
      if (resendAfter) await onResend(body.contract);
      else onSaved(body.contract, "Đã lưu hợp đồng.");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không lưu được hợp đồng");
    } finally {
      setPending(false);
    }
  };

  const saveAccounting = async (resendAfter: boolean) => {
    const amount = confirmedAmount.trim() ? Number(confirmedAmount) : Number.NaN;
    const parsed = accountingContractSchema.safeParse({
      confirmedAmount: amount,
      accountingStatus,
      images,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Thông tin kế toán chưa đúng");
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      const body = await api<{ contract: ContractRecord }>(crmPath(`/api/crm/contracts/${contract.id}/accounting`, contract.lane), {
        method: "PATCH",
        body: JSON.stringify(parsed.data),
      });
      if (resendAfter) await onResend(body.contract);
      else onSaved(body.contract, "Đã lưu xác nhận của Kế toán.");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không lưu được xác nhận");
    } finally {
      setPending(false);
    }
  };

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(undefined);
    try {
      const next = [...images];
      for (const file of files) {
        if (next.length >= 10) throw new Error("Tối đa 10 ảnh");
        next.push(await compressImage(file));
      }
      setImages(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không đọc được ảnh");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{contract.code} · {contract.customerName}</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1">
          {error && <InlineAlert>{error}</InlineAlert>}
          <p className="text-sm text-muted-foreground">
            Lưu chỉ giữ thông tin ở bên đang sửa. Gửi lại mới chuyển thông tin sang bên nhận, và gửi kèm trạng thái. Trạng thái vận hành cập nhật cho các bên ngay khi lưu.
          </p>
          <section className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
            <h3 className="font-medium sm:col-span-2">Thông tin hợp đồng</h3>
            <p className="sm:col-span-2"><span className="text-muted-foreground">Báo giá: </span>{contract.quoteCode || "—"}</p>
            {canSale ? (
              <>
                <Field label="Tên khách hàng" htmlFor="contract-customer" required>
                  <Input id="contract-customer" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
                </Field>
                <Field label="Nhân viên bán" htmlFor="contract-sale">
                  <Input id="contract-sale" value={saleName} onChange={(event) => setSaleName(event.target.value)} />
                </Field>
                <Field label="Vận chuyển đến" htmlFor="contract-ship" className="sm:col-span-2">
                  <NativeSelect
                    id="contract-ship"
                    value={(contractShipToOptions as readonly string[]).includes(shipTo) ? shipTo : ""}
                    onChange={(event) => setShipTo(event.target.value)}
                  >
                    <option value="">Chọn tuyến vận chuyển</option>
                    {contractShipToOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Sản phẩm" htmlFor="contract-product" className="sm:col-span-2">
                  <Input id="contract-product" value={product} onChange={(event) => setProduct(event.target.value)} />
                </Field>
                <Field label="Số lượng" htmlFor="contract-qty">
                  <Input id="contract-qty" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                </Field>
                <Field label="Ngày ký" htmlFor="contract-signed">
                  <Input id="contract-signed" type="date" value={signedOn} onChange={(event) => setSignedOn(event.target.value)} />
                </Field>
                <Field label="Loại tiền" htmlFor="contract-currency" hint="Áp dụng cho mọi số tiền của hợp đồng">
                  <NativeSelect id="contract-currency" value={currency} onChange={(event) => setCurrency(event.target.value as QuoteCurrency)}>
                    {quoteCurrencies.map((code) => <option key={code} value={code}>{code}{code === "VND" ? " (nội tệ)" : ""}</option>)}
                  </NativeSelect>
                </Field>
                <Field label="Giá trị sản phẩm" htmlFor="contract-product-value">
                  <Input id="contract-product-value" inputMode="decimal" value={productValueText} onChange={(event) => setProductValueText(event.target.value)} />
                </Field>
                <Field label="Chi phí vận chuyển" htmlFor="contract-shipping">
                  <Input id="contract-shipping" inputMode="decimal" value={shippingCost} onChange={(event) => setShippingCost(event.target.value)} />
                </Field>
                <Field label="Tổng giá trị" htmlFor="contract-total">
                  <Input id="contract-total" inputMode="decimal" value={totalValue} onChange={(event) => setTotalValue(event.target.value)} />
                </Field>
                <Field label="Số tiền đã thanh toán" htmlFor="contract-paid">
                  <Input id="contract-paid" inputMode="decimal" value={paidAmount} onChange={(event) => setPaidAmount(event.target.value)} />
                </Field>
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="button" variant="outline" disabled={pending} onClick={() => { void saveCommercial(false); }}>Lưu</Button>
                  {canResend && <Button type="button" disabled={pending} onClick={() => { void saveCommercial(true); }}>Gửi lại</Button>}
                </div>
              </>
            ) : (
              <>
                <p><span className="text-muted-foreground">Nhân viên bán: </span>{contract.saleName || "—"}</p>
                <p className="sm:col-span-2"><span className="text-muted-foreground">Vận chuyển đến: </span>{contract.shipTo || "—"}</p>
                <p className="sm:col-span-2"><span className="text-muted-foreground">Sản phẩm: </span>{contract.product || "—"}</p>
                <p><span className="text-muted-foreground">Số lượng: </span>{contract.quantity ?? "—"}</p>
                <p><span className="text-muted-foreground">Ngày ký: </span>{shownDate(contract.signedOn)}</p>
                <p><span className="text-muted-foreground">Giá trị sản phẩm: </span>{money(contract.productValue, contract.currency)}</p>
                <p><span className="text-muted-foreground">Chi phí vận chuyển: </span>{money(contract.shippingCost, contract.currency)}</p>
                <p><span className="text-muted-foreground">Tổng giá trị: </span>{money(contract.totalValue, contract.currency)}</p>
                <p><span className="text-muted-foreground">Đã thanh toán: </span>{money(contract.paidAmount, contract.currency)}</p>
                <p><span className="text-muted-foreground">Còn lại: </span>{money(contract.balance, contract.currency)}</p>
              </>
            )}
          </section>

          <section className="grid gap-3 rounded-xl border p-3 sm:grid-cols-3">
            <div>
              <p className="mb-1 text-sm font-medium">Dục thanh toán để giao hàng</p>
              <FlagCell active={paymentFlags.urgePayment} tone="danger" label={paymentFlags.urgePaymentLabel} />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Đủ điều kiện đi hàng</p>
              <FlagCell active={paymentFlags.eligibleToShip} tone="success" label={paymentFlags.eligibleToShipLabel} />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Đủ điều kiện giao hàng</p>
              <FlagCell active={paymentFlags.eligibleToDeliver} tone="success" label={paymentFlags.eligibleToDeliverLabel} />
            </div>
          </section>

          <section className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
            <h3 className="font-medium sm:col-span-2">Vận hành</h3>
            <Field label="Trạng thái" htmlFor="ops-status">
              <NativeSelect id="ops-status" value={opsStatus} disabled={!canOps} onChange={(event) => setOpsStatus(event.target.value)}>
                <option value="">Chọn trạng thái</option>
                {opsStatus && !opsStatusOptions.includes(opsStatus as (typeof opsStatusOptions)[number]) && (
                  <option value={opsStatus}>{opsStatus}</option>
                )}
                {opsStatusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Tracking" htmlFor="ops-tracking">
              <Input id="ops-tracking" value={tracking} disabled={!canOps} onChange={(event) => setTracking(event.target.value)} />
            </Field>
            <Field label="Note 1" htmlFor="ops-note-1" className="sm:col-span-2">
              <Textarea id="ops-note-1" value={note1} disabled={!canOps} onChange={(event) => setNote1(event.target.value)} />
            </Field>
            <Field label="Note 2" htmlFor="ops-note-2" className="sm:col-span-2">
              <Textarea id="ops-note-2" value={note2} disabled={!canOps} onChange={(event) => setNote2(event.target.value)} />
            </Field>
            <Field label="Ngày nhập kho TQ" htmlFor="ops-china">
              <Input id="ops-china" type="date" value={chinaWarehouseOn} disabled={!canOps} onChange={(event) => setChinaWarehouseOn(event.target.value)} />
            </Field>
            <Field label="Ngày xuất container" htmlFor="ops-container">
              <Input id="ops-container" type="date" value={containerOn} disabled={!canOps} onChange={(event) => setContainerOn(event.target.value)} />
            </Field>
            <Field label="Ngày cập cảng đến" htmlFor="ops-arrival">
              <Input id="ops-arrival" type="date" value={arrivalOn} disabled={!canOps} onChange={(event) => setArrivalOn(event.target.value)} />
            </Field>
            <Field label="Ngày giao hàng dự kiến" htmlFor="ops-delivery">
              <Input id="ops-delivery" type="date" value={deliveryOn} disabled={!canOps} onChange={(event) => setDeliveryOn(event.target.value)} />
            </Field>
            {canOps && (
              <div className="flex gap-2 sm:col-span-2">
                <Button type="button" variant="outline" disabled={pending} onClick={() => { void saveOps(false); }}>{pending ? "Đang lưu…" : "Lưu"}</Button>
                {canResend && <Button type="button" disabled={pending} onClick={() => { void saveOps(true); }}>Gửi lại</Button>}
              </div>
            )}
          </section>

          <section className="grid gap-3 rounded-xl border p-3">
            <h3 className="font-medium">Kế toán</h3>
            {!contract.sentToAccountingAt && <p className="text-sm text-muted-foreground">Vận hành chưa gửi hợp đồng này.</p>}
            {contract.sentToAccountingAt && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Kế toán xác nhận số tiền" htmlFor="acc-amount">
                    <Input id="acc-amount" inputMode="decimal" value={confirmedAmount} disabled={!canAccounting} onChange={(event) => setConfirmedAmount(event.target.value)} />
                  </Field>
                  <Field label="Kế toán xác nhận trạng thái" htmlFor="acc-status">
                    <NativeSelect id="acc-status" value={accountingStatus} disabled={!canAccounting} onChange={(event) => setAccountingStatus(event.target.value)}>
                      <option value="">Chọn trạng thái</option>
                      {accountingStatusOptions.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </NativeSelect>
                  </Field>
                </div>
                <div className="grid gap-2">
                  <p className="text-sm font-medium">Ảnh về TK</p>
                  <div className="flex flex-wrap gap-2">
                    {images.map((image, index) => (
                      <div key={`${index}-${image.slice(0, 24)}`} className="relative">
                        <img src={image} alt={`Ảnh tài khoản ${index + 1}`} className="h-20 w-20 rounded-md border object-cover" />
                        {canAccounting && (
                          <button type="button" className="absolute right-1 top-1 rounded bg-card px-1 text-xs" onClick={() => setImages(images.filter((_, imageIndex) => imageIndex !== index))}>
                            Xóa
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {canAccounting && (
                    <Input type="file" accept="image/*" multiple onChange={(event) => { addImages(event.target.files); event.target.value = ""; }} />
                  )}
                </div>
                {canAccounting && (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" disabled={pending} onClick={() => { void saveAccounting(false); }}>{pending ? "Đang lưu…" : "Lưu xác nhận"}</Button>
                    {canResend && <Button type="button" disabled={pending} onClick={() => { void saveAccounting(true); }}>Gửi lại</Button>}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
