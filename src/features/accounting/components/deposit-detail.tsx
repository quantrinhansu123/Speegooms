"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { InlineAlert } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { ChainTrace } from "@/features/crm/components/chain-trace";
import { DepositBadge } from "@/features/crm/components/meta-badges";
import { formatDate, formatMoney } from "@/lib/format";
import { matchStatement } from "@/services/accounting/rules";
import { useAccounting } from "../hooks";
import { canPerform } from "@/config/permissions";

/**
 * Xác nhận "Đã cọc": dùng thao tác của CRM store (chỉ Kế toán), nên trạng thái cọc thay đổi đồng thời
 * ở CRM, Vận hành (mở khóa đặt xưởng) và Kế toán.
 */
export function DepositDetail({ orderId }: { orderId: string }) {
  const { crm, acc, crmActions, staffName, user } = useAccounting();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "danger" | "success"; text: string }>();

  const c = crm.contracts.find((x) => x.orderId === orderId);
  if (!c) return <div className="rounded-xl border bg-card"><EmptyState title="Không tìm thấy hợp đồng" /></div>;

  const customer = crm.customers.find((x) => x.customerId === c.customerId);
  const d = c.deposit;
  const match = matchStatement(c, acc.statementLines);
  const isAccountant = canPerform(user.role, "deposit.confirm");
  const run = (r: { ok: boolean; error?: string }, success?: string) => setMsg(r.ok ? (success ? { tone: "success", text: success } : undefined) : { tone: "danger", text: r.error ?? "Không thực hiện được" });

  return (
    <>
      <Link href="/ke-toan/doi-soat" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Cọc cần đối soát
      </Link>
      <div className="mb-6 rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight text-primary">{c.orderId}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Hợp đồng {c.contractNo} · {customer?.name} · giá trị {formatMoney(c.value, c.currency)}</p>
            <div className="mt-3"><DepositBadge value={d.status} /></div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Số tiền cọc yêu cầu</p>
            <p className="tabular text-2xl font-semibold text-primary">{formatMoney(d.amount, c.currency)}</p>
          </div>
        </div>
        <ChainTrace className="mt-4" messId={c.messId} rfqId={c.rfqId} orderId={c.orderId} customerId={c.customerId} />
      </div>

      {msg && <InlineAlert tone={msg.tone} className="mb-4">{msg.text}</InlineAlert>}

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Yêu cầu từ Sale">
          <dl className="divide-y text-sm">
            {[
              ["Yêu cầu ngày", d.requestedAt ? formatDate(d.requestedAt) : "—"],
              ["Người yêu cầu", staffName(d.requestedBy ?? "")],
              ["Kênh nhận tiền", d.channel === "khac" ? "Kênh khác (ngoại lệ)" : "Tài khoản công ty"],
              ["Mã / tên bill", <span key="b" className="font-mono text-xs">{d.billRef ?? "—"}</span>],
              ["Ghi chú", d.note ?? "—"],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-4 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
            ))}
          </dl>
          {d.channel === "khac" && <InlineAlert tone="warning" className="mt-3 text-xs">Kênh ngoài tài khoản công ty là ngoại lệ cần phê duyệt; quy trình ngoại lệ chưa được thiết kế.</InlineAlert>}
          <p className="mt-3 text-xs text-muted-foreground"><Link href={`/crm/hop-dong/${c.orderId}`} className="text-primary hover:underline">Mở hợp đồng bên CRM</Link></p>
        </SectionCard>

        <SectionCard title="Đối chiếu sao kê (demo)" description="Sao kê là dữ liệu mẫu, không kết nối ngân hàng">
          {match.line ? (
            <>
              <dl className="divide-y text-sm">
                <div className="flex justify-between gap-4 py-1.5"><dt className="text-muted-foreground">Dòng sao kê</dt><dd className="font-mono text-xs font-medium">{match.line.lineId}</dd></div>
                <div className="flex justify-between gap-4 py-1.5"><dt className="text-muted-foreground">Ngày</dt><dd className="font-medium">{formatDate(match.line.date)}</dd></div>
                <div className="flex justify-between gap-4 py-1.5"><dt className="text-muted-foreground">Số tiền</dt><dd className="font-medium">{formatMoney(match.line.amount, "VND")}</dd></div>
                <div className="flex justify-between gap-4 py-1.5"><dt className="text-muted-foreground">Nội dung</dt><dd className="text-right font-medium">{match.line.description}</dd></div>
              </dl>
              {match.exact ? (
                <InlineAlert tone="success" className="mt-3 flex items-center gap-2 text-xs"><CheckCircle2 aria-hidden className="size-4" /> Khớp số tiền với yêu cầu cọc.</InlineAlert>
              ) : (
                <InlineAlert className="mt-3 text-xs">Lệch {formatMoney(match.diff ?? 0, "VND")} so với số tiền yêu cầu.</InlineAlert>
              )}
            </>
          ) : (
            <InlineAlert tone="warning" className="text-xs">Chưa thấy dòng sao kê tương ứng. Chỉ xác nhận khi đã đối chiếu được tiền về tài khoản công ty.</InlineAlert>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Xác nhận Đã cọc" description="Chỉ vai trò Kế toán thao tác được. Xác nhận sẽ mở khóa đặt xưởng bên Vận hành." className="mt-6">
        {d.status === "da-coc" && (
          <p className="text-sm">Đã xác nhận ngày {d.confirmedAt && formatDate(d.confirmedAt)} bởi {staffName(d.confirmedBy ?? "")}.</p>
        )}
        {d.status === "khong-khop" && <InlineAlert className="mb-3">Đã báo không khớp: {d.mismatchNote}. Chờ Sale kiểm tra bill và gửi lại yêu cầu.</InlineAlert>}
        {d.status === "chua-yeu-cau" && <p className="text-sm text-muted-foreground">Sale chưa gửi yêu cầu xác nhận cọc.</p>}
        {d.status === "cho-ke-toan" &&
          (isAccountant ? (
            <div className="space-y-3">
              <Textarea aria-label="Điểm không khớp" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi rõ điểm không khớp nếu từ chối (số tiền, người chuyển, ngày…)" />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => run(crmActions.confirmDeposit(orderId), "Đã xác nhận Đã cọc. Vận hành được phép đặt xưởng cho đơn này")}>Xác nhận “Đã cọc”</Button>
                <Button variant="destructive" onClick={() => run(crmActions.markDepositMismatch(orderId, note))}>Không khớp</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Đang chờ Kế toán. Vai trò hiện tại chỉ xem, không có nút xác nhận “Đã cọc”.</p>
          ))}
      </SectionCard>
    </>
  );
}
