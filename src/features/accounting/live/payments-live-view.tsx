"use client";

import { useEffect, useState } from "react";
import { Plus, Save, X } from "lucide-react";
import {
  createPaymentRequestSchema,
  paymentPayeeKindLabels,
  paymentPayeeKinds,
  paymentPurposeLabels,
  paymentPurposes,
  paymentStatusLabels,
  paymentStatuses,
} from "@speego/shared";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { MoneyInput } from "@/components/shared/money-input";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { canPerform } from "@/config/permissions";
import { useSession } from "@/features/auth/session-provider";
import { FilterSelect, ListSearchBar, useAppliedSearch } from "@/features/crm/live/list-search-bar";
import { TableHScroll } from "@/features/crm/live/table-h-scroll";
import { ApiError, api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { StatusTone } from "@/types/status";
import { useListData } from "./list-query";

export type PaymentRecord = {
  id: string;
  code: string;
  orderCode: string;
  customerName: string | null;
  payeeKind: keyof typeof paymentPayeeKindLabels;
  purpose: keyof typeof paymentPurposeLabels;
  payeeCode: string | null;
  payeeName: string | null;
  refCode: string | null;
  content: string;
  amount: number;
  currency: string;
  note: string | null;
  status: keyof typeof paymentStatusLabels;
  enteredBy: string | null;
  enteredAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  paidBy: string | null;
  paidAt: string | null;
};

type OrderOption = { code: string; customerName: string; accountingStatus: string };

const statusTone: Record<PaymentRecord["status"], StatusTone> = {
  NHAP: "neutral",
  CHO_DUYET: "warning",
  DA_DUYET: "info",
  DA_CHI: "success",
  TU_CHOI: "danger",
  HUY: "neutral",
};

const kindOptions = paymentPayeeKinds.map((value) => [value, paymentPayeeKindLabels[value]] as const);
const purposeOptions = paymentPurposes.map((value) => [value, paymentPurposeLabels[value]] as const);
const statusOptions = paymentStatuses.map((value) => [value, paymentStatusLabels[value]] as const);

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("vi-VN") : "—");

function CreatePaymentDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (payment: PaymentRecord) => void }) {
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [orderCode, setOrderCode] = useState("");
  const [payeeKind, setPayeeKind] = useState<PaymentRecord["payeeKind"]>("NHA_CUNG_CAP");
  const [purpose, setPurpose] = useState<PaymentRecord["purpose"]>("DAT_COC_XUONG");
  const [payeeName, setPayeeName] = useState("");
  const [payeeCode, setPayeeCode] = useState("");
  const [refCode, setRefCode] = useState("");
  const [content, setContent] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<{ orders: OrderOption[] }>("/api/ke-toan/payment-orders")
      .then((body) => { if (!cancelled) setOrders(body.orders); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof ApiError ? cause.message : "Không tải được danh sách đơn hàng"); })
      .finally(() => { if (!cancelled) setLoadingOrders(false); });
    return () => { cancelled = true; };
  }, []);

  const submit = async () => {
    const parsed = createPaymentRequestSchema.safeParse({
      orderCode,
      payeeKind,
      purpose,
      payeeName,
      payeeCode,
      refCode,
      content,
      amount: amount ?? 0,
      currency: "VND",
      note,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const body = await api<{ payment: PaymentRecord }>("/api/ke-toan/payments", { method: "POST", body: JSON.stringify(parsed.data) });
      onCreated(body.payment);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không tạo được đề nghị");
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nhập đề nghị thanh toán</DialogTitle>
          <DialogDescription>Bước 1/3 (Nhập). Sau đó gửi duyệt, rồi Kế toán ghi nhận chi. Chỉ ghi nhận trạng thái, không chuyển tiền thật.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Đơn hàng" htmlFor="pay-order" required className="sm:col-span-2" hint="Chỉ lập đề nghị chi cho đơn đã có xác nhận Đã cọc của Kế toán.">
            <NativeSelect id="pay-order" value={orderCode} onChange={(event) => setOrderCode(event.target.value)} disabled={loadingOrders}>
              <option value="">{loadingOrders ? "Đang tải…" : orders.length === 0 ? "Chưa có đơn đã cọc" : "Chọn đơn hàng"}</option>
              {orders.map((order) => (
                <option key={order.code} value={order.code}>{order.code} · {order.customerName}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Đối tượng nhận" htmlFor="pay-kind" required>
            <NativeSelect id="pay-kind" value={payeeKind} onChange={(event) => {
              const next = event.target.value as PaymentRecord["payeeKind"];
              setPayeeKind(next);
              setPurpose(next === "NHA_CUNG_CAP" ? "DAT_COC_XUONG" : "CUOC_VAN_CHUYEN");
            }}>
              {kindOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Mục đích" htmlFor="pay-purpose" required>
            <NativeSelect id="pay-purpose" value={purpose} onChange={(event) => setPurpose(event.target.value as PaymentRecord["purpose"])}>
              {purposeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Người nhận" htmlFor="pay-payee" required>
            <Input id="pay-payee" value={payeeName} maxLength={200} onChange={(event) => setPayeeName(event.target.value)} placeholder={payeeKind === "NHA_CUNG_CAP" ? "Tên nhà cung cấp" : "Tên đối tác vận chuyển"} />
          </Field>
          <Field label="Mã người nhận" htmlFor="pay-payee-code">
            <Input id="pay-payee-code" value={payeeCode} maxLength={64} onChange={(event) => setPayeeCode(event.target.value)} />
          </Field>
          <Field label="Mã tham chiếu" htmlFor="pay-ref" className="sm:col-span-2" hint="Mã đơn mua hoặc mã lô hàng.">
            <Input id="pay-ref" value={refCode} maxLength={64} onChange={(event) => setRefCode(event.target.value)} />
          </Field>
          <Field label="Nội dung thanh toán" htmlFor="pay-content" required className="sm:col-span-2">
            <Textarea id="pay-content" value={content} maxLength={500} rows={3} onChange={(event) => setContent(event.target.value)} placeholder="Ví dụ: Đặt cọc đợt 1 cho xưởng, đơn HD-0001" />
          </Field>
          <Field label="Số tiền (VND)" htmlFor="pay-amount" required>
            <MoneyInput id="pay-amount" value={amount} onValueChange={setAmount} fractionDigits={0} />
          </Field>
          <Field label="Ghi chú" htmlFor="pay-note">
            <Input id="pay-note" value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />
          </Field>
        </div>
        {error && <InlineAlert>{error}</InlineAlert>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}><X /> Hủy</Button>
          <Button onClick={submit} disabled={saving || !orderCode}><Save aria-hidden /> {saving ? "Đang lưu…" : "Tạo mới"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Đề nghị thanh toán lấy từ API: tìm theo mã, đơn, người nhận, tham chiếu, khách, nội dung thanh toán. */
export function PaymentsLiveView() {
  const user = useSession();
  const canCreate = canPerform(user.role, "pay.create");
  const filters = useAppliedSearch({ q: "", from: "", to: "", status: "", payeeKind: "", purpose: "" });
  const { rows, loading, error, reload } = useListData<PaymentRecord>("/api/ke-toan/payments", "payments", filters.applied, "Không tải được đề nghị thanh toán");
  const [notice, setNotice] = useState<string>();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="Đề nghị thanh toán"
        description="Nhà cung cấp và đối tác vận chuyển. Ba bước tách nhau: nhập (Vận hành hoặc Kế toán), duyệt (theo cấp), chi (Kế toán). Chỉ ghi nhận trạng thái."
        actions={canCreate && <Button size="lg" onClick={() => setCreating(true)}><Plus aria-hidden /> Tạo mới</Button>}
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
        dateLabel="Từ ngày nhập"
        searchPlaceholder="Mã đề nghị, đơn hàng, người nhận, tham chiếu, khách, nội dung thanh toán…"
      >
        <FilterSelect id="pay-filter-status" label="Trạng thái" value={filters.draft.status} onChange={(value) => filters.set("status", value)} options={statusOptions} />
        <FilterSelect id="pay-filter-kind" label="Đối tượng nhận" value={filters.draft.payeeKind} onChange={(value) => filters.set("payeeKind", value)} options={kindOptions} />
        <FilterSelect id="pay-filter-purpose" label="Mục đích" value={filters.draft.purpose} onChange={(value) => filters.set("purpose", value)} options={purposeOptions} />
      </ListSearchBar>
      <TableHScroll className="-mx-1 overscroll-x-contain">
        <table className="w-max min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Đề nghị</th>
              <th className="px-3 py-2 font-medium">Đơn hàng</th>
              <th className="px-3 py-2 font-medium">Người nhận</th>
              <th className="min-w-56 px-3 py-2 font-medium">Nội dung thanh toán</th>
              <th className="px-3 py-2 text-right font-medium">Số tiền</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
              <th className="px-3 py-2 font-medium">Nhập</th>
              <th className="px-3 py-2 font-medium">Duyệt</th>
              <th className="px-3 py-2 font-medium">Chi</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Đang tải…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">{filters.active ? "Không có kết quả." : "Chưa có đề nghị thanh toán."}</td></tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-b align-top last:border-0">
                <td className="px-3 py-3 font-mono text-xs font-medium whitespace-nowrap">{row.code}</td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="font-mono text-xs">{row.orderCode}</span>
                  {row.customerName && <p className="max-w-40 truncate text-xs text-muted-foreground" title={row.customerName}>{row.customerName}</p>}
                </td>
                <td className="px-3 py-3">
                  <p className="max-w-52 truncate font-medium" title={row.payeeName ?? undefined}>{row.payeeName || "—"}</p>
                  <p className="text-xs text-muted-foreground">{paymentPayeeKindLabels[row.payeeKind]} · {paymentPurposeLabels[row.purpose]}</p>
                  {row.refCode && <p className="font-mono text-xs text-muted-foreground">{row.refCode}</p>}
                </td>
                <td className="min-w-56 max-w-80 px-3 py-3 whitespace-pre-line" title={row.content}>{row.content}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap">{formatMoney(row.amount, row.currency)}</td>
                <td className="px-3 py-3 whitespace-nowrap"><StatusBadge tone={statusTone[row.status]}>{paymentStatusLabels[row.status]}</StatusBadge></td>
                <td className="px-3 py-3 text-xs whitespace-nowrap">{row.enteredBy ?? "—"}<br /><span className="text-muted-foreground">{day(row.enteredAt)}</span></td>
                <td className="px-3 py-3 text-xs whitespace-nowrap">{row.approvedBy ? <>{row.approvedBy}<br /><span className="text-muted-foreground">{day(row.approvedAt)}</span></> : "—"}</td>
                <td className="px-3 py-3 text-xs whitespace-nowrap">{row.paidBy ? <>{row.paidBy}<br /><span className="text-muted-foreground">{day(row.paidAt)}</span></> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableHScroll>
      {creating && (
        <CreatePaymentDialog
          onClose={() => setCreating(false)}
          onCreated={(payment) => {
            setCreating(false);
            setNotice(`Đã tạo đề nghị ${payment.code}.`);
            reload();
          }}
        />
      )}
    </>
  );
}
