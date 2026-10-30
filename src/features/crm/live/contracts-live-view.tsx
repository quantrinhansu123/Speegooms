"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { accountingContractSchema, contractPaymentFlags, opsContractSchema, opsStatusOptions, saleContractPaymentSchema, type CrmLane, type QuoteCurrency } from "@speego/shared";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/features/auth/session-provider";
import {
  clearOpenContractParams,
  OPEN_CONTRACT_EVENT,
  readOpenContractFromUrl,
  type OpenContractDetail,
} from "@/features/notifications/open-contract";
import { useNotificationRefresh } from "@/features/notifications/notifications-changed";
import { FOCUS_ROW_CLASS } from "@/features/notifications/use-focus-row";
import { ApiError, api } from "@/lib/api";
import { clipboardImageFiles } from "@/lib/clipboard-image";
import { uploadImageFiles } from "@/lib/upload-image";
import { formatMoney, formatMoneyGrouped, formatMoneyInput, parseMoneyInput } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/role";
import { crmPath, LaneSwitch, useCrmLane } from "./lane";
import { dateRangeError, FilterSelect, ListSearchBar, searchParams, useAppliedSearch } from "./list-search-bar";
import { RowMenu } from "./row-menu";
import { labelOf } from "./types";

export type ContractPaymentLine = {
  amount: number;
  paidOn: string | null;
  note: string;
  images: string[];
};

export type ContractConfirmationLine = {
  amount: number;
  note: string;
  images: string[];
};

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
  payments: ContractPaymentLine[];
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
  confirmations: ContractConfirmationLine[];
  images: string[];
  createdAt: string;
  updatedAt: string;
};

type PaymentDraft = { amount: string; paidOn: string; note: string; images: string[] };
type ConfirmationDraft = { amount: string; note: string; images: string[] };

function emptyPaymentDraft(): PaymentDraft {
  return { amount: "", paidOn: "", note: "", images: [] };
}

function emptyConfirmationDraft(): ConfirmationDraft {
  return { amount: "", note: "", images: [] };
}

function confirmationDraftsFrom(contract: ContractRecord): ConfirmationDraft[] {
  if (contract.confirmations?.length) {
    return contract.confirmations.map((line) => ({
      amount: formatMoneyGrouped(line.amount),
      note: line.note ?? "",
      images: line.images ?? [],
    }));
  }
  if (contract.confirmedAmount != null && contract.confirmedAmount > 0) {
    return [{ amount: formatMoneyGrouped(contract.confirmedAmount), note: "", images: contract.images.slice() }];
  }
  return [emptyConfirmationDraft()];
}

function paymentDraftsFrom(contract: ContractRecord): PaymentDraft[] {
  if (contract.payments?.length) {
    return contract.payments.map((line) => ({
      amount: formatMoneyGrouped(line.amount),
      paidOn: line.paidOn ?? "",
      note: line.note ?? "",
      images: line.images ?? [],
    }));
  }
  if (contract.paidAmount > 0) {
    return [{ amount: formatMoneyGrouped(contract.paidAmount), paidOn: "", note: "", images: contract.images.slice() }];
  }
  return [emptyPaymentDraft()];
}

function billImagesOf(row: ContractRecord): string[] {
  const fromPayments = (row.payments ?? []).flatMap((line) => line.images ?? []);
  return fromPayments.length > 0 ? fromPayments : row.images;
}

function readSeenMap(userId: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(`speego.contract-seen.${userId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([id, at]) => (typeof at === "string" ? [[id, at]] : [])),
    );
  } catch {
    return {};
  }
}

function writeSeenMap(userId: string, map: Record<string, string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`speego.contract-seen.${userId}`, JSON.stringify(map));
}

/** Lần đầu mở trang: đánh dấu các hợp đồng hiện có đã xem để không tô vàng cả danh sách cũ. */
function seedSeenIfNeeded(userId: string, rows: ContractRecord[]): Record<string, string> {
  if (typeof window === "undefined") return {};
  const flagKey = `speego.contract-seen.${userId}.seeded`;
  const current = readSeenMap(userId);
  if (window.localStorage.getItem(flagKey)) return current;
  const now = new Date().toISOString();
  const next = { ...current };
  for (const row of rows) {
    if (!next[row.id]) next[row.id] = row.updatedAt || row.createdAt || now;
  }
  writeSeenMap(userId, next);
  window.localStorage.setItem(flagKey, "1");
  return next;
}

function activityAt(row: ContractRecord): string {
  return [row.updatedAt, row.createdAt, row.confirmedBackAt, row.sentToOpsAt, row.sentToAccountingAt]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? row.createdAt;
}

function isUnreadContract(row: ContractRecord, seen: Record<string, string>): boolean {
  const last = seen[row.id];
  if (!last) return true;
  return activityAt(row) > last;
}

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
  return <StatusBadge tone={tone} className="max-w-full whitespace-normal text-left leading-snug">{label}</StatusBadge>;
}

function opsStatusTone(status: string | null | undefined): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (status) {
    case "Hoàn thành":
      return "success";
    case "Hủy đơn":
      return "danger";
    case "Đang sản xuất":
    case "Đang vận chuyển":
    case "Đợi check cọc":
      return "warning";
    case "Hợp đồng":
    case "Đặt cọc":
    case "Hàng mẫu":
      return "info";
    default:
      return "neutral";
  }
}

function accountingStatusTone(status: string | null | undefined, pendingSend: boolean): "success" | "warning" | "danger" | "info" | "neutral" {
  if (pendingSend) return "warning";
  switch (status) {
    case "DA_HOAN_THANH_COC":
    case "DA_HOAN_THANH_THANH_TOAN":
      return "success";
    case "CHUA_HOAN_THANH_COC":
    case "CHUA_HOAN_THANH_THANH_TOAN":
      return "danger";
    default:
      return "neutral";
  }
}

const contractImageOptions = { maxEdge: 280, quality: 0.72, maxChars: 90_000 } as const;

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
  const canResend = canSale || canOps || canAccounting;
  const canDelete = mode === "accounting" && user.role === "ke-toan";
  const [rows, setRows] = useState<ContractRecord[]>([]);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [selected, setSelected] = useState<ContractRecord | null>(null);
  const [removing, setRemoving] = useState<ContractRecord | null>(null);
  const [billPreview, setBillPreview] = useState<{ code: string; images: string[] } | null>(null);
  const [seen, setSeen] = useState<Record<string, string>>(() => readSeenMap(user.id));
  const [listLoading, setListLoading] = useState(true);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusLane, setFocusLane] = useState<CrmLane | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const filters = useAppliedSearch({ q: "", from: "", to: "", opsStatus: "", accountingStatus: "" });
  const opsStatusFilterOptions = opsStatusOptions.map((status) => [status, status] as const);

  useEffect(() => {
    setSeen(readSeenMap(user.id));
  }, [user.id]);

  const requestOpenContract = useCallback((detail: OpenContractDetail) => {
    if (detail.refType && detail.refType !== "contract") return;
    setFocusId(detail.id);
    setHighlightId(null);
    if (detail.lane && canPick) {
      if (detail.lane !== lane) setListLoading(true);
      setFocusLane(detail.lane);
      setLane(detail.lane);
      return;
    }
    setFocusLane(null);
  }, [canPick, lane, setLane]);

  useEffect(() => {
    const fromUrl = readOpenContractFromUrl();
    if (fromUrl) requestOpenContract(fromUrl);
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenContractDetail>).detail;
      if (detail?.id) requestOpenContract(detail);
    };
    window.addEventListener(OPEN_CONTRACT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CONTRACT_EVENT, onOpen);
  }, [requestOpenContract]);

  const markSeen = useCallback((row: ContractRecord) => {
    const at = new Date().toISOString();
    setSeen((current) => {
      const next = { ...current, [row.id]: at };
      writeSeenMap(user.id, next);
      return next;
    });
  }, [user.id]);

  const load = useCallback(async () => {
    const rangeError = dateRangeError(filters.applied.from, filters.applied.to);
    if (rangeError) {
      setError(rangeError);
      setListLoading(false);
      return;
    }
    setError(undefined);
    setListLoading(true);
    try {
      const path = crmPath(`/api/crm/contracts?view=${mode}`, lane);
      const sent = mode === "accounting" ? "&sent=1" : "";
      const query = searchParams(filters.applied, {
        opsStatus: filters.applied.opsStatus,
        accountingStatus: filters.applied.accountingStatus,
      });
      const body = await api<{ contracts: ContractRecord[] }>(`${path}${sent}${query}`);
      setRows(body.contracts);
      if (mode === "sale") setSeen(seedSeenIfNeeded(user.id, body.contracts));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không tải được hợp đồng");
    } finally {
      setListLoading(false);
    }
  }, [filters.applied, lane, mode, user.id]);

  useEffect(() => { load(); }, [load]);
  useNotificationRefresh(load);

  useEffect(() => {
    if (!focusId || listLoading) return;
    if (focusLane && lane !== focusLane) return;
    const row = rows.find((item) => item.id === focusId);
    if (row) {
      setNotice(undefined);
      markSeen(row);
      setHighlightId(row.id);
      setSelected(row);
      setFocusId(null);
      setFocusLane(null);
      clearOpenContractParams();
      return;
    }
    setError("Không tìm thấy hợp đồng được thông báo trong danh sách hiện tại.");
    setFocusId(null);
    setFocusLane(null);
    clearOpenContractParams();
  }, [focusId, focusLane, lane, listLoading, markSeen, rows]);

  useEffect(() => {
    if (!highlightId) return;
    const scroll = () => {
      document.querySelector(`[data-row-id="${CSS.escape(highlightId)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    const start = window.setTimeout(scroll, 40);
    const clear = window.setTimeout(() => setHighlightId(null), 8000);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(clear);
    };
  }, [highlightId]);

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
        searchPlaceholder="Tìm mọi trường: mã, khách, sản phẩm, trạng thái, tracking, ghi chú…"
      >
        <FilterSelect id="contract-ops-status" label="Trạng thái vận hành" value={filters.draft.opsStatus} onChange={(value) => filters.set("opsStatus", value)} options={opsStatusFilterOptions} />
        <FilterSelect id="contract-accounting-status" label="Trạng thái kế toán" value={filters.draft.accountingStatus} onChange={(value) => filters.set("accountingStatus", value)} options={accountingStatusOptions} />
      </ListSearchBar>
      {mode === "sale" && (
        <p className="mb-3 text-xs text-muted-foreground">Dòng tô vàng: hợp đồng mới hoặc vừa có thông tin cập nhật — mở xem để bỏ tô.</p>
      )}
      <div className="-mx-1 overflow-x-auto overscroll-x-contain rounded-xl border bg-card [&_th]:whitespace-nowrap">
        <table className="w-max min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium whitespace-nowrap">Mã</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Báo giá</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Khách</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Sản phẩm</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Tổng giá trị</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Đã thanh toán</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Ảnh bill</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Còn lại</th>
              <th className="min-w-40 px-3 py-2 font-medium whitespace-nowrap">Dục thanh toán để giao hàng</th>
              <th className="min-w-36 px-3 py-2 font-medium whitespace-nowrap">Đủ điều kiện đi hàng</th>
              <th className="min-w-36 px-3 py-2 font-medium whitespace-nowrap">Đủ điều kiện giao hàng</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Vận hành</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Kế toán</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Gửi lại</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={15} className="px-3 py-8 text-center text-muted-foreground">{filters.active ? "Không có kết quả." : "Chưa có hợp đồng."}</td></tr>
            )}
            {rows.map((row) => {
              const flags = contractPaymentFlags({
                totalValue: row.totalValue,
                confirmedAmount: row.confirmedAmount,
                paidAmount: row.paidAmount,
                balance: row.balance,
                deliveryOn: row.deliveryOn,
                accountingStatus: row.accountingStatus,
                opsStatus: row.opsStatus,
              });
              const unread = mode === "sale" && isUnreadContract(row, seen);
              return (
              <tr
                key={row.id}
                data-row-id={row.id}
                className={cn(
                  "border-b last:border-0 align-top",
                  highlightId === row.id ? FOCUS_ROW_CLASS : unread && "bg-amber-50",
                )}
              >
                <td className="px-3 py-3 font-medium whitespace-nowrap">{row.code}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.quoteCode || "—"}</td>
                <td className="px-3 py-3 whitespace-nowrap" title={row.customerName}>{row.customerName}</td>
                <td className="max-w-48 truncate px-3 py-3" title={row.product ?? undefined}>{row.product || "—"}</td>
                <td className="px-3 py-3 whitespace-nowrap">{money(row.totalValue, row.currency)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{money(row.paidAmount, row.currency)}</td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {(() => {
                    const bills = billImagesOf(row);
                    if (bills.length === 0) return "—";
                    return (
                      <button
                        type="button"
                        className="text-sm font-medium text-primary hover:underline"
                        onClick={() => setBillPreview({ code: row.code, images: bills })}
                      >
                        {bills.length} bill
                      </button>
                    );
                  })()}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">{money(row.balance, row.currency)}</td>
                <td className="min-w-40 px-3 py-3">
                  <FlagCell active={flags.urgePayment} tone="danger" label={flags.urgePaymentLabel} />
                </td>
                <td className="min-w-36 px-3 py-3">
                  <FlagCell active={flags.eligibleToShip} tone="success" label={flags.eligibleToShipLabel} />
                </td>
                <td className="min-w-36 px-3 py-3">
                  <FlagCell active={flags.eligibleToDeliver} tone="success" label={flags.eligibleToDeliverLabel} />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {row.opsStatus
                    ? <StatusBadge tone={opsStatusTone(row.opsStatus)}>{row.opsStatus}</StatusBadge>
                    : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {(() => {
                    const pendingSend = mode !== "accounting" && !row.sentToAccountingAt;
                    const label = pendingSend
                      ? "Chưa gửi"
                      : labelOf(accountingStatusOptions, row.accountingStatus);
                    if (!label) return <span className="text-muted-foreground">—</span>;
                    return (
                      <StatusBadge tone={accountingStatusTone(row.accountingStatus, pendingSend)}>
                        {label}
                      </StatusBadge>
                    );
                  })()}
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
                        onClick: () => {
                          setNotice(undefined);
                          markSeen(row);
                          setSelected(row);
                        },
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
      <Dialog open={billPreview !== null} onOpenChange={(open) => { if (!open) setBillPreview(null); }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Ảnh bill{billPreview ? ` · ${billPreview.code} (${billPreview.images.length})` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
            {billPreview?.images.map((image, index) => (
              <a key={`${billPreview.code}-preview-${index}`} href={image} target="_blank" rel="noreferrer" className="block">
                <img src={image} alt={`Bill ${index + 1}`} className="h-40 w-full rounded-md border object-cover" />
              </a>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBillPreview(null)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
            markSeen(contract);
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
  return parseMoneyInput(value);
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
  const [payments, setPayments] = useState<PaymentDraft[]>(() => paymentDraftsFrom(contract));
  const [opsStatus, setOpsStatus] = useState(contract.opsStatus);
  const [tracking, setTracking] = useState(contract.tracking);
  const [note1, setNote1] = useState(contract.note1);
  const [note2, setNote2] = useState(contract.note2);
  const [chinaWarehouseOn, setChinaWarehouseOn] = useState(contract.chinaWarehouseOn ?? "");
  const [containerOn, setContainerOn] = useState(contract.containerOn ?? "");
  const [arrivalOn, setArrivalOn] = useState(contract.arrivalOn ?? "");
  const [deliveryOn, setDeliveryOn] = useState(contract.deliveryOn ?? "");
  const [confirmations, setConfirmations] = useState<ConfirmationDraft[]>(() => confirmationDraftsFrom(contract));
  const [accountingStatus, setAccountingStatus] = useState(contract.accountingStatus ?? "");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const paidValue = payments.reduce((sum, line) => sum + (numberValue(line.amount) ?? 0), 0);
  const confirmedValue = confirmations.reduce((sum, line) => sum + (numberValue(line.amount) ?? 0), 0);
  const balanceValue = Math.max(0, contract.totalValue - paidValue);
  const paymentFlags = contractPaymentFlags({
    totalValue: contract.totalValue,
    confirmedAmount: confirmedValue,
    paidAmount: paidValue,
    balance: balanceValue,
    deliveryOn: deliveryOn || null,
    accountingStatus: accountingStatus || contract.accountingStatus,
    opsStatus,
  });

  const updatePayment = (index: number, patch: Partial<PaymentDraft>) => {
    setPayments((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  };

  const updateConfirmation = (index: number, patch: Partial<ConfirmationDraft>) => {
    setConfirmations((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  };

  const saveCommercial = async (resendAfter: boolean) => {
    const parsed = saleContractPaymentSchema.safeParse({
      payments: payments.map((line) => ({
        amount: numberValue(line.amount) ?? 0,
        paidOn: line.paidOn,
        note: line.note,
        images: line.images,
      })),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Thông tin thanh toán chưa đúng");
      return;
    }
    const totalPaid = parsed.data.payments.reduce((sum, line) => sum + line.amount, 0);
    if (totalPaid > contract.totalValue) {
      setError("Số tiền thanh toán không được lớn hơn tổng giá trị");
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
      else onSaved(body.contract, "Đã lưu thanh toán hợp đồng.");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không lưu được thanh toán");
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
    const parsed = accountingContractSchema.safeParse({
      accountingStatus,
      confirmations: confirmations.map((line) => ({
        amount: numberValue(line.amount) ?? 0,
        note: line.note,
        images: line.images,
      })),
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

  const addConfirmationImages = async (confirmationIndex: number, files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    setError(undefined);
    try {
      const current = confirmations[confirmationIndex];
      if (!current) return;
      const room = 10 - current.images.length;
      if (room <= 0) throw new Error("Tối đa 10 ảnh mỗi lần xác nhận");
      const list = Array.from(files);
      const accepted = list.slice(0, room);
      if (accepted.length < list.length) throw new Error("Tối đa 10 ảnh mỗi lần xác nhận");
      const uploaded = await uploadImageFiles(accepted, contractImageOptions);
      updateConfirmation(confirmationIndex, { images: [...current.images, ...uploaded] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được ảnh");
    }
  };

  const pasteConfirmationImage = async (confirmationIndex: number, event: React.ClipboardEvent) => {
    const files = clipboardImageFiles(event);
    if (files.length === 0) return;
    event.preventDefault();
    await addConfirmationImages(confirmationIndex, files);
  };

  const addPaymentImages = async (paymentIndex: number, files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    setError(undefined);
    try {
      const current = payments[paymentIndex]?.images ?? [];
      const room = 10 - current.length;
      if (room <= 0) throw new Error("Tối đa 10 ảnh mỗi lần thanh toán");
      const list = Array.from(files);
      const accepted = list.slice(0, room);
      if (accepted.length < list.length) throw new Error("Tối đa 10 ảnh mỗi lần thanh toán");
      const uploaded = await uploadImageFiles(accepted, contractImageOptions);
      updatePayment(paymentIndex, { images: [...current, ...uploaded] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được ảnh");
    }
  };

  const pastePaymentImage = async (paymentIndex: number, event: React.ClipboardEvent) => {
    if (!canSale) return;
    const files = clipboardImageFiles(event);
    if (files.length === 0) return;
    event.preventDefault();
    await addPaymentImages(paymentIndex, files);
  };

  const defaultTab = canAccounting && !canSale && !canOps
    ? "ke-toan"
    : canOps && !canSale
      ? "van-hanh"
      : canSale
        ? "thanh-toan"
        : "hop-dong";

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent className="flex max-h-[92dvh] w-full flex-col gap-4 overflow-hidden sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{contract.code} · {contract.customerName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Lưu chỉ giữ thông tin ở bên đang sửa. Gửi lại mới chuyển thông tin sang bên nhận, và gửi kèm trạng thái. Trạng thái vận hành cập nhật cho các bên ngay khi lưu.
        </p>
        {error && <InlineAlert>{error}</InlineAlert>}
        <Tabs defaultValue={defaultTab} className="min-h-0 flex-1 overflow-hidden">
          <TabsList className="h-auto min-h-0 w-full flex-wrap items-center justify-start gap-1.5 rounded-xl border border-foreground/10 bg-muted p-1.5 group-data-horizontal/tabs:h-auto">
            {([
              ["hop-dong", "Hợp đồng"],
              ["thanh-toan", "Thanh toán"],
              ["van-hanh", "Vận hành"],
              ["ke-toan", "Kế toán"],
            ] as const).map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-11 flex-1 items-center justify-center rounded-lg px-3 py-2 text-[15px] font-semibold text-foreground shadow-none after:hidden hover:bg-background/70 hover:text-foreground data-active:bg-primary data-active:text-primary-foreground data-active:shadow-md data-active:hover:bg-primary data-active:hover:text-primary-foreground"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="hop-dong" className="mt-3 max-h-[min(68vh,720px)] space-y-4 overflow-y-auto pr-1">
            <section className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
              <h3 className="font-medium sm:col-span-2">Thông tin hợp đồng</h3>
              <p className="sm:col-span-2"><span className="text-muted-foreground">Báo giá: </span>{contract.quoteCode || "—"}</p>
              <p><span className="text-muted-foreground">Nhân viên bán: </span>{contract.saleName || "—"}</p>
              <p><span className="text-muted-foreground">Loại tiền: </span>{contract.currency}</p>
              <p className="sm:col-span-2"><span className="text-muted-foreground">Vận chuyển đến: </span>{contract.shipTo || "—"}</p>
              <p className="sm:col-span-2"><span className="text-muted-foreground">Sản phẩm: </span>{contract.product || "—"}</p>
              <p><span className="text-muted-foreground">Số lượng: </span>{contract.quantity ?? "—"}</p>
              <p><span className="text-muted-foreground">Ngày ký: </span>{shownDate(contract.signedOn)}</p>
              <p><span className="text-muted-foreground">Giá trị sản phẩm: </span>{money(contract.productValue, contract.currency)}</p>
              <p><span className="text-muted-foreground">Chi phí vận chuyển: </span>{money(contract.shippingCost, contract.currency)}</p>
              <p><span className="text-muted-foreground">Tổng giá trị: </span>{money(contract.totalValue, contract.currency)}</p>
              <p><span className="text-muted-foreground">Còn lại: </span>{money(canSale ? balanceValue : contract.balance, contract.currency)}</p>
              <p><span className="text-muted-foreground">Đã thanh toán: </span>{money(canSale ? paidValue : contract.paidAmount, contract.currency)}</p>
            </section>
            <section className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3">
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
          </TabsContent>

          <TabsContent value="thanh-toan" className="mt-3 max-h-[min(68vh,720px)] space-y-4 overflow-y-auto pr-1">
            {canSale ? (
              <>
                <section className="space-y-3 rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium">Số tiền đã thanh toán</h3>
                    <p className="text-sm text-muted-foreground">Tổng: {money(paidValue, contract.currency)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Mỗi lần khách chuyển khoản là một dòng riêng; ảnh bill gắn theo từng lần.</p>
                  {payments.map((line, index) => (
                    <div key={`pay-${index}`} className="space-y-3 rounded-lg border p-3">
                      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
                        <Field label={`Số tiền lần ${index + 1}`} htmlFor={`contract-paid-${index}`}>
                          <Input
                            id={`contract-paid-${index}`}
                            inputMode="decimal"
                            value={line.amount}
                            onChange={(event) => updatePayment(index, { amount: formatMoneyInput(event.target.value) })}
                          />
                        </Field>
                        <Field label="Ngày chuyển" htmlFor={`contract-paid-on-${index}`}>
                          <Input
                            id={`contract-paid-on-${index}`}
                            type="date"
                            value={line.paidOn}
                            onChange={(event) => updatePayment(index, { paidOn: event.target.value })}
                          />
                        </Field>
                        <Field label="Ghi chú" htmlFor={`contract-paid-note-${index}`}>
                          <Input
                            id={`contract-paid-note-${index}`}
                            value={line.note}
                            onChange={(event) => updatePayment(index, { note: event.target.value })}
                          />
                        </Field>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={payments.length <= 1}
                            onClick={() => setPayments((current) => current.filter((_, lineIndex) => lineIndex !== index))}
                          >
                            Xóa
                          </Button>
                        </div>
                      </div>
                      <div
                        className="rounded-lg border border-dashed p-3"
                        tabIndex={0}
                        onPaste={(event) => { void pastePaymentImage(index, event); }}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">Ảnh bill lần {index + 1}</p>
                          <p className="text-xs text-muted-foreground">{line.images.length}/10 ảnh</p>
                        </div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {line.images.map((image, imageIndex) => (
                            <div key={`${imageIndex}-${image.slice(0, 24)}`} className="relative shrink-0">
                              <img src={image} alt={`Ảnh bill lần ${index + 1}-${imageIndex + 1}`} className="h-20 w-20 rounded-md border object-cover" />
                              <button
                                type="button"
                                className="absolute right-1 top-1 rounded bg-card px-1 text-xs"
                                onClick={() => updatePayment(index, { images: line.images.filter((_, itemIndex) => itemIndex !== imageIndex) })}
                              >
                                Xóa
                              </button>
                            </div>
                          ))}
                          {line.images.length === 0 && (
                            <p className="text-xs text-muted-foreground">Chưa có ảnh — chọn hoặc dán nhiều ảnh cho lần này.</p>
                          )}
                        </div>
                        <Input
                          type="file"
                          accept="image/*"
                          multiple
                          disabled={line.images.length >= 10}
                          onChange={(event) => {
                            void addPaymentImages(index, event.target.files);
                            event.target.value = "";
                          }}
                        />
                        <p className="mt-1 text-xs text-muted-foreground">Có thể chọn nhiều ảnh cùng lúc · Ctrl+V để dán</p>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={payments.length >= 50}
                    onClick={() => setPayments((current) => [...current, emptyPaymentDraft()])}
                  >
                    <Plus className="size-4" /> Thêm lần thanh toán
                  </Button>
                </section>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" disabled={pending} onClick={() => { void saveCommercial(false); }}>Lưu</Button>
                  {canResend && <Button type="button" disabled={pending} onClick={() => { void saveCommercial(true); }}>Gửi lại</Button>}
                </div>
              </>
            ) : (
              <section className="space-y-3 rounded-xl border p-4">
                <h3 className="font-medium">Số tiền đã thanh toán</h3>
                <p><span className="text-muted-foreground">Đã thanh toán: </span>{money(contract.paidAmount, contract.currency)}</p>
                {(contract.payments?.length ?? 0) > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {contract.payments.map((line, index) => (
                      <li key={`view-pay-${index}`} className="space-y-2 rounded-lg border p-3 text-muted-foreground">
                        <p>
                          Lần {index + 1}: {money(line.amount, contract.currency)}
                          {line.paidOn ? ` · ${shownDate(line.paidOn)}` : ""}
                          {line.note ? ` · ${line.note}` : ""}
                        </p>
                        {(line.images?.length ?? 0) > 0 && (
                          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
                            {line.images.map((image, imageIndex) => (
                              <a key={`view-bill-${index}-${imageIndex}`} href={image} target="_blank" rel="noreferrer" className="shrink-0">
                                <img src={image} alt={`Ảnh bill lần ${index + 1}-${imageIndex + 1}`} className="h-16 w-16 rounded border object-cover" />
                              </a>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Chưa có lần thanh toán.</p>
                )}
              </section>
            )}
          </TabsContent>

          <TabsContent value="van-hanh" className="mt-3 max-h-[min(68vh,720px)] overflow-y-auto pr-1">
            <section className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
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
              <Field label="Ngày giao hàng dự kiến" htmlFor="ops-delivery" required={canOps}>
                <Input id="ops-delivery" type="date" value={deliveryOn} disabled={!canOps} required={canOps} onChange={(event) => setDeliveryOn(event.target.value)} />
              </Field>
              {canOps && (
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="button" variant="outline" disabled={pending} onClick={() => { void saveOps(false); }}>{pending ? "Đang lưu…" : "Lưu"}</Button>
                  {canResend && <Button type="button" disabled={pending} onClick={() => { void saveOps(true); }}>Gửi lại</Button>}
                </div>
              )}
            </section>
          </TabsContent>

          <TabsContent value="ke-toan" className="mt-3 max-h-[min(68vh,720px)] overflow-y-auto pr-1">
            <section className="space-y-3 rounded-xl border p-4">
              {!contract.sentToAccountingAt && <p className="text-sm text-muted-foreground">Vận hành chưa gửi hợp đồng này.</p>}
              {contract.sentToAccountingAt && (
                <>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <Field label="Kế toán xác nhận trạng thái" htmlFor="acc-status" className="min-w-56 flex-1">
                      <NativeSelect id="acc-status" value={accountingStatus} disabled={!canAccounting} onChange={(event) => setAccountingStatus(event.target.value)}>
                        <option value="">Chọn trạng thái</option>
                        {accountingStatusOptions.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </NativeSelect>
                    </Field>
                    <p className="text-sm text-muted-foreground">Tổng xác nhận: {money(confirmedValue, contract.currency)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Mỗi lần xác nhận là một dòng riêng; ảnh về TK gắn theo từng lần (có thể nhiều ảnh).</p>
                  {confirmations.map((line, index) => (
                    <div key={`acc-${index}`} className="space-y-3 rounded-lg border p-3">
                      <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
                        <Field label={`Số tiền lần ${index + 1}`} htmlFor={`acc-amount-${index}`}>
                          <Input
                            id={`acc-amount-${index}`}
                            inputMode="decimal"
                            value={line.amount}
                            disabled={!canAccounting}
                            onChange={(event) => updateConfirmation(index, { amount: formatMoneyInput(event.target.value) })}
                          />
                        </Field>
                        <Field label="Ghi chú" htmlFor={`acc-note-${index}`}>
                          <Input
                            id={`acc-note-${index}`}
                            value={line.note}
                            disabled={!canAccounting}
                            onChange={(event) => updateConfirmation(index, { note: event.target.value })}
                          />
                        </Field>
                        {canAccounting && (
                          <div className="flex items-end">
                            <Button
                              type="button"
                              variant="outline"
                              disabled={confirmations.length <= 1}
                              onClick={() => setConfirmations((current) => current.filter((_, lineIndex) => lineIndex !== index))}
                            >
                              Xóa
                            </Button>
                          </div>
                        )}
                      </div>
                      <div
                        className="rounded-lg border border-dashed p-3"
                        tabIndex={canAccounting ? 0 : undefined}
                        onPaste={canAccounting ? (event) => { void pasteConfirmationImage(index, event); } : undefined}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">Ảnh về TK lần {index + 1}</p>
                          <p className="text-xs text-muted-foreground">{line.images.length}/10 ảnh</p>
                        </div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {line.images.map((image, imageIndex) => (
                            <div key={`${imageIndex}-${image.slice(0, 24)}`} className="relative shrink-0">
                              <img src={image} alt={`Ảnh về TK lần ${index + 1}-${imageIndex + 1}`} className="h-20 w-20 rounded-md border object-cover" />
                              {canAccounting && (
                                <button
                                  type="button"
                                  className="absolute right-1 top-1 rounded bg-card px-1 text-xs"
                                  onClick={() => updateConfirmation(index, { images: line.images.filter((_, itemIndex) => itemIndex !== imageIndex) })}
                                >
                                  Xóa
                                </button>
                              )}
                            </div>
                          ))}
                          {line.images.length === 0 && (
                            <p className="text-xs text-muted-foreground">Chưa có ảnh — chọn hoặc dán nhiều ảnh cho lần này.</p>
                          )}
                        </div>
                        {canAccounting && (
                          <>
                            <Input
                              type="file"
                              accept="image/*"
                              multiple
                              disabled={line.images.length >= 10}
                              onChange={(event) => {
                                void addConfirmationImages(index, event.target.files);
                                event.target.value = "";
                              }}
                            />
                            <p className="mt-1 text-xs text-muted-foreground">Có thể chọn nhiều ảnh cùng lúc · Ctrl+V để dán</p>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {canAccounting && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={confirmations.length >= 50}
                        onClick={() => setConfirmations((current) => [...current, emptyConfirmationDraft()])}
                      >
                        <Plus className="size-4" /> Thêm lần thanh toán
                      </Button>
                      <Button type="button" variant="outline" disabled={pending} onClick={() => { void saveAccounting(false); }}>{pending ? "Đang lưu…" : "Lưu xác nhận"}</Button>
                      {canResend && <Button type="button" disabled={pending} onClick={() => { void saveAccounting(true); }}>Gửi lại</Button>}
                    </div>
                  )}
                </>
              )}
            </section>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
