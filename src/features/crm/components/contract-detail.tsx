"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Circle, Lock, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { InlineAlert } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { approvalMeta, simulatedApprovals } from "@/config/crm";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { canHandOver, canRequestDeposit } from "@/services/crm/rules";
import { useCrm } from "../hooks";
import { ChainTrace } from "./chain-trace";
import { ContractBadge, DepositBadge } from "./meta-badges";
import { DepositRequestDialog } from "./deposit-request-dialog";
import { OrderInquiryCard } from "@/features/fulfillment/components/inquiries-view";

type StepState = "done" | "current" | "locked";

function Stepper({ steps }: { steps: { label: string; state: StepState; note?: string }[] }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-5">
      {steps.map((s, i) => (
        <li key={s.label} className={cn("rounded-lg border p-3 text-sm", s.state === "done" && "border-success/40 bg-success-soft", s.state === "current" && "border-primary bg-accent", s.state === "locked" && "bg-muted/50 text-muted-foreground")}>
          <p className="flex items-center gap-1.5 font-medium">
            {s.state === "done" ? <Check aria-hidden className="size-4 text-success" /> : s.state === "locked" ? <Lock aria-hidden className="size-4" /> : <Circle aria-hidden className="size-4 text-primary" />}
            {i + 1}. {s.label}
          </p>
          {s.note && <p className="mt-1 text-xs">{s.note}</p>}
          <span className="sr-only">{s.state === "done" ? "Đã xong" : s.state === "current" ? "Đang ở bước này" : "Chưa mở"}</span>
        </li>
      ))}
    </ol>
  );
}

export function ContractDetail({ orderId }: { orderId: string }) {
  const { data, all, actions, can, staffName } = useCrm();
  const contract = data.contracts.find((c) => c.orderId === orderId);
  const [depositOpen, setDepositOpen] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "danger" | "success"; text: string }>();

  if (!contract) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState title="Không tìm thấy hợp đồng" description="Hợp đồng không tồn tại hoặc không thuộc phạm vi của bạn." />
      </div>
    );
  }

  const customer = all.customers.find((c) => c.customerId === contract.customerId);
  const d = contract.deposit;
  const needsBoard = contract.boardApproval !== "khong-can";
  const run = (r: { ok: boolean; error?: string }, success?: string) =>
    setMsg(r.ok ? (success ? { tone: "success", text: success } : undefined) : { tone: "danger", text: r.error ?? "Không thực hiện được" });

  const signed = contract.status === "da-ky";
  const boardOk = !needsBoard || contract.boardApproval === "da-duyet";
  const depositConfirmed = d.status === "da-coc";
  const steps: { label: string; state: StepState; note?: string }[] = [
    { label: "Soạn và ký hợp đồng", state: signed ? "done" : "current" },
    { label: "Ban GĐ duyệt (nếu vượt ngưỡng)", state: !needsBoard ? "done" : boardOk ? "done" : "current", note: needsBoard ? approvalMeta[contract.boardApproval] : "Không cần" },
    { label: "Yêu cầu xác nhận cọc", state: d.status !== "chua-yeu-cau" && d.status !== "khong-khop" ? "done" : signed && boardOk ? "current" : "locked" },
    { label: "Kế toán xác nhận Đã cọc", state: depositConfirmed ? "done" : d.status === "cho-ke-toan" || d.status === "khong-khop" ? "current" : "locked", note: "Chỉ Kế toán" },
    { label: "Bàn giao Vận hành, đặt xưởng", state: contract.handover.status === "da-ban-giao" ? "done" : depositConfirmed ? "current" : "locked", note: depositConfirmed ? undefined : "Khóa tới khi Đã cọc" },
  ];

  return (
    <>
      <Link href="/crm/hop-dong" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Danh sách hợp đồng
      </Link>
      <div className="mb-6 rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight text-primary">{contract.orderId}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Hợp đồng {contract.contractNo} ·{" "}
              <Link href={`/crm/khach-hang/${contract.customerId}`} className="hover:underline">
                {customer?.name ?? contract.customerId}
              </Link>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ContractBadge value={contract.status} />
              <DepositBadge value={d.status} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Giá trị hợp đồng</p>
            <p className="tabular text-2xl font-semibold text-primary">{formatMoney(contract.value, contract.currency)}</p>
          </div>
        </div>
        <ChainTrace className="mt-4" messId={contract.messId} rfqId={contract.rfqId} orderId={contract.orderId} customerId={contract.customerId} />
      </div>

      {msg && (
        <InlineAlert tone={msg.tone} className="mb-4">
          {msg.text}
        </InlineAlert>
      )}

      <div className="mb-6">
        <Stepper steps={steps} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Thông tin hợp đồng">
          <dl className="divide-y text-sm">
            {[
              ["Báo giá", <Link key="q" href={`/crm/bao-gia/${contract.quoteId}`} className="font-mono text-primary hover:underline">{contract.quoteId}</Link>],
              ["RFQ", <Link key="r" href={`/crm/rfq/${contract.rfqId}`} className="font-mono text-primary hover:underline">{contract.rfqId}</Link>],
              ["Ngày tạo", formatDate(contract.createdAt)],
              ["Ngày ký", contract.signedAt ? formatDate(contract.signedAt) : "Chưa ký"],
              ["Phụ trách", staffName(contract.ownerId)],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-4 py-1.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {contract.status === "soan-thao" && can("contract.write") && (
            <div className="mt-4 space-y-2">
              <Button className="w-full" onClick={() => run(actions.signContract(orderId), "Hợp đồng đã ký")}>
                <Check /> Đánh dấu đã ký
              </Button>
              {needsBoard && !boardOk && (
                <p className="text-xs text-muted-foreground">Hợp đồng vượt ngưỡng mô phỏng {formatMoney(simulatedApprovals.contractBoardVnd, "VND")}, cần Ban GĐ duyệt trước khi ký.</p>
              )}
            </div>
          )}
          {contract.boardApproval === "cho-duyet" && can("board.approve") && (
            <div className="mt-4 flex gap-2">
              <Button onClick={() => run(actions.boardReview(orderId, true), "Ban GĐ đã duyệt (mô phỏng)")}><Check /> Duyệt (Ban GĐ)</Button>
              <Button variant="destructive" onClick={() => run(actions.boardReview(orderId, false))}><X /> Từ chối</Button>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Cọc" description="Kế toán đối soát sao kê rồi xác nhận" className="lg:col-span-2">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Số tiền cọc</dt><dd className="tabular font-medium">{formatMoney(d.amount, contract.currency)}</dd></div>
            <div><dt className="text-muted-foreground">Trạng thái</dt><dd className="mt-0.5"><DepositBadge value={d.status} /></dd></div>
            {d.requestedAt && <div><dt className="text-muted-foreground">Yêu cầu ngày</dt><dd className="font-medium">{formatDate(d.requestedAt)} · {staffName(d.requestedBy ?? "")}</dd></div>}
            {d.channel && <div><dt className="text-muted-foreground">Kênh nhận tiền</dt><dd className="font-medium">{d.channel === "khac" ? "Kênh khác (ngoại lệ)" : "Tài khoản công ty"}</dd></div>}
            {d.billRef && <div><dt className="text-muted-foreground">Bill</dt><dd className="font-mono text-xs font-medium">{d.billRef}</dd></div>}
            {d.confirmedAt && <div><dt className="text-muted-foreground">Kế toán xác nhận</dt><dd className="font-medium">{formatDate(d.confirmedAt)} · {staffName(d.confirmedBy ?? "")}</dd></div>}
          </dl>
          {d.note && <p className="mt-3 text-sm text-muted-foreground">Ghi chú Sale: {d.note}</p>}
          {d.channel === "khac" && (
            <InlineAlert tone="warning" className="mt-3 text-xs">
              Kênh nhận tiền ngoài tài khoản công ty là ngoại lệ cần phê duyệt (quy trình chưa thiết kế).
            </InlineAlert>
          )}
          {d.status === "khong-khop" && d.mismatchNote && (
            <InlineAlert className="mt-3">Kế toán báo không khớp: {d.mismatchNote}. Sale kiểm tra bill rồi gửi lại yêu cầu.</InlineAlert>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
            {canRequestDeposit(contract) && can("deposit.request") && (
              <Button onClick={() => setDepositOpen(true)}><Send /> {d.status === "khong-khop" ? "Gửi lại yêu cầu xác nhận cọc" : "Tạo yêu cầu xác nhận cọc"}</Button>
            )}
            {d.status === "cho-ke-toan" &&
              (can("deposit.confirm") ? (
                <div className="w-full space-y-2">
                  <Textarea aria-label="Điểm không khớp" rows={2} placeholder="Ghi rõ điểm không khớp nếu từ chối (số tiền, người chuyển, ngày…)" value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="flex gap-2">
                    <Button onClick={() => run(actions.confirmDeposit(orderId), "Đã xác nhận Đã cọc")}><Check /> Xác nhận “Đã cọc”</Button>
                    <Button variant="destructive" onClick={() => run(actions.markDepositMismatch(orderId, note))}><X /> Không khớp</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Đang chờ Kế toán đối soát. Chỉ vai trò Kế toán được xác nhận “Đã cọc”.</p>
              ))}
            {d.status === "chua-yeu-cau" && !canRequestDeposit(contract) && contract.status !== "huy" && (
              <p className="text-sm text-muted-foreground">Cần ký hợp đồng{needsBoard ? " và được Ban GĐ duyệt" : ""} trước khi yêu cầu xác nhận cọc.</p>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Bàn giao đặt xưởng" description="Cổng kiểm soát: không đặt xưởng khi chưa Đã cọc" className="mt-6">
        {contract.handover.status === "da-ban-giao" ? (
          <p className="text-sm">
            Đã bàn giao sang Vận hành ngày {contract.handover.at ? formatDate(contract.handover.at) : "—"}. Đặt xưởng, vận chuyển và kho thuộc giai đoạn sau, chưa có trong bản demo này.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <Button
              disabled={!canHandOver(contract) || !can("deposit.request")}
              onClick={() => run(actions.handOverToOperations(orderId), "Đã bàn giao sang Vận hành (mô phỏng)")}
            >
              {depositConfirmed ? null : <Lock />} Bàn giao sang Vận hành
            </Button>
            <p className="text-sm text-muted-foreground">
              {depositConfirmed ? "Đã có xác nhận cọc của Kế toán, Sale có thể bàn giao sang Vận hành." : "Chưa có xác nhận Đã cọc của Kế toán nên chưa được chuyển sang bước đặt xưởng."}
            </p>
          </div>
        )}
      </SectionCard>

      {contract.status === "da-ky" && <OrderInquiryCard orderId={orderId} />}

      {depositOpen && <DepositRequestDialog contract={contract} open onOpenChange={(o) => !o && setDepositOpen(false)} />}
    </>
  );
}
