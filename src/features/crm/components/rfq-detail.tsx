"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { InlineAlert } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { originLabels, routeLabels } from "@/config/crm";
import { formatDate } from "@/lib/format";
import type { PriceRequestState } from "@/types/crm";
import { useCrm } from "../hooks";
import { ChainTrace } from "./chain-trace";
import { QuoteBadge, RfqBadge } from "./meta-badges";
import { RfqForm } from "./rfq-form";

const priceState: Record<PriceRequestState, { label: string; tone: "neutral" | "warning" | "success" }> = {
  "chua-gui": { label: "Chưa gửi", tone: "neutral" },
  "cho-gia": { label: "Đang chờ giá", tone: "warning" },
  "da-co-gia": { label: "Đã có giá", tone: "success" },
};

export function RfqDetail({ rfqId }: { rfqId: string }) {
  const { data, all, actions, can } = useCrm();
  const router = useRouter();
  const rfq = data.rfqs.find((r) => r.rfqId === rfqId);
  const [targets, setTargets] = useState({ sourcing: true, logistics: true });
  const [notice, setNotice] = useState<{ tone: "danger" | "success"; text: string }>();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!rfq) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState title="Không tìm thấy RFQ" description="RFQ không tồn tại hoặc không thuộc phạm vi tuyến của bạn." />
      </div>
    );
  }

  const customer = all.customers.find((c) => c.customerId === rfq.customerId);
  const quotes = all.quotations.filter((q) => q.rfqId === rfqId);
  const contract = all.contracts.find((c) => c.rfqId === rfqId && c.status !== "huy");
  const closed = rfq.status === "da-chot" || rfq.status === "da-huy";
  const writable = can("rfq.write") && !closed;
  const activeQuote = quotes.some((q) => q.status !== "tu-choi");
  const canCreateQuote = can("quote.write") && rfq.status === "da-co-gia" && !activeQuote;
  const run = (r: { ok: boolean; error?: string }, success?: string) =>
    setNotice(r.ok ? (success ? { tone: "success", text: success } : undefined) : { tone: "danger", text: r.error ?? "Không thực hiện được" });

  return (
    <>
      <Link href="/crm/rfq" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Danh sách RFQ
      </Link>
      <div className="mb-6 rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight text-primary">{rfq.rfqId}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              <Link href={`/crm/khach-hang/${rfq.customerId}`} className="hover:underline">
                {customer?.name ?? rfq.customerId}
              </Link>{" "}
              · tạo {formatDate(rfq.createdAt)} · {routeLabels[rfq.route]}
            </p>
            <div className="mt-3">
              <RfqBadge value={rfq.status} />
            </div>
          </div>
          {writable && (
            <Button variant="destructive" size="lg" onClick={() => setCancelOpen(true)}>
              Hủy RFQ
            </Button>
          )}
        </div>
        <ChainTrace className="mt-4" messId={rfq.messId} rfqId={rfq.rfqId} orderId={contract?.orderId} customerId={rfq.customerId} />
      </div>

      {notice && (
        <InlineAlert tone={notice.tone} className="mb-4">
          {notice.text}
        </InlineAlert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Yêu cầu hàng hóa" description={`Xuất xứ: ${originLabels[rfq.goodsOrigin]} (theo lead)${rfq.sensitiveGoods ? " · Hàng nhạy cảm" : ""}`} className="lg:col-span-2">
          <RfqForm
            key={`${rfq.rfqId}-${rfq.status}`}
            defaultValues={{
              goodsName: rfq.goodsName,
              quantity: rfq.quantity,
              unit: rfq.unit,
              originPoint: rfq.originPoint,
              destination: rfq.destination,
              transportMode: rfq.transportMode,
              targetDate: rfq.targetDate,
              specialRequirements: rfq.specialRequirements,
              sensitiveGoods: rfq.sensitiveGoods,
            }}
            disabled={!writable}
            submitLabel="Lưu yêu cầu"
            onSubmit={(v) => {
              run(actions.updateRfq(rfqId, v));
              setSaved(true);
            }}
          />
          {saved && (
            <p role="status" className="mt-2 text-right text-sm text-success">
              Đã lưu
            </p>
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Bàn giao yêu cầu giá" description="Sourcing báo giá hàng, Logistics báo cước">
            <ul className="space-y-3">
              {(
                [
                  ["sourcing", "Sourcing – giá hàng"],
                  ["logistics", "Logistics – giá cước"],
                ] as const
              ).map(([key, label]) => (
                <li key={key} className="flex items-center justify-between gap-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--brand-navy)]"
                      checked={targets[key]}
                      disabled={!writable}
                      onChange={(e) => setTargets({ ...targets, [key]: e.target.checked })}
                    />
                    {label}
                  </label>
                  <StatusBadge tone={priceState[rfq.priceRequest[key]].tone}>{priceState[rfq.priceRequest[key]].label}</StatusBadge>
                </li>
              ))}
            </ul>
            {rfq.priceRequest.sentAt && <p className="mt-2 text-xs text-muted-foreground">Gửi ngày {formatDate(rfq.priceRequest.sentAt)}</p>}
            {writable && (
              <div className="mt-4 space-y-2">
                <Button className="w-full" onClick={() => run(actions.sendPriceRequest(rfqId, targets), "Đã bàn giao yêu cầu giá")}>
                  <Send /> {rfq.priceRequest.sentAt ? "Gửi lại yêu cầu giá" : "Gửi yêu cầu giá"}
                </Button>
                {rfq.status === "cho-gia" && (
                  <Button variant="outline" className="w-full" onClick={() => run(actions.simulatePriceReturn(rfqId), "Vận hành đã trả giá (mô phỏng)")}>
                    Mô phỏng Vận hành trả giá
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">Module Vận hành chưa có, nút mô phỏng chỉ để demo luồng tới bước báo giá.</p>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Báo giá">
            {quotes.length === 0 ? (
              <p className="mb-3 text-sm text-muted-foreground">Chưa có báo giá.</p>
            ) : (
              <ul className="mb-3 space-y-2">
                {quotes.map((q) => (
                  <li key={q.quoteId} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/crm/bao-gia/${q.quoteId}`} className="font-mono text-primary hover:underline">
                      {q.quoteId}
                    </Link>
                    <QuoteBadge value={q.status} />
                  </li>
                ))}
              </ul>
            )}
            {can("quote.write") && (
              <>
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={!canCreateQuote}
                  onClick={() => {
                    const r = actions.createQuotation(rfqId);
                    if (r.ok && r.id) router.push(`/crm/bao-gia/${r.id}`);
                    else run(r);
                  }}
                >
                  <FileText /> Soạn báo giá
                </Button>
                {!canCreateQuote && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {rfq.status !== "da-co-gia" && !activeQuote ? "Cần có giá hàng/cước từ Vận hành trước khi soạn báo giá." : activeQuote ? "RFQ đã có báo giá đang xử lý." : ""}
                  </p>
                )}
              </>
            )}
          </SectionCard>
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Hủy RFQ này?"
        description="RFQ chuyển sang trạng thái đã hủy và không thể sửa tiếp. Lead vẫn giữ nguyên."
        confirmLabel="Hủy RFQ"
        destructive
        onConfirm={() => run(actions.cancelRfq(rfqId))}
      />
    </>
  );
}
