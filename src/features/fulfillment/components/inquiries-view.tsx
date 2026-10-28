"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { Column } from "@/components/shared/data-table";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { ListView } from "@/components/shared/list-view";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { inquiryStatusMeta, packageStatusMeta, deliveryStatusMeta } from "@/config/fulfillment";
import { shipmentStatusMeta } from "@/config/operations";
import { formatDate } from "@/lib/format";
import { orderStages, shipmentStatus } from "@/services/ops/rules";
import type { Inquiry, InquiryStatus } from "@/types/fulfillment";
import { useFulfillment } from "../hooks";
import { InquiryBadge } from "./fulfillment-badges";

/** Tình trạng hiện tại của đơn, đọc trực tiếp từ các module (một cửa trả lời cho Sale). */
function useOrderSnapshot(orderId: string) {
  const { orders, ops, wh } = useFulfillment();
  const view = orders.find((o) => o.contract.orderId === orderId);
  const ships = ops.shipments.filter((s) => s.orderId === orderId);
  const pkgs = wh.packages.filter((p) => p.orderId === orderId);
  const deliveries = wh.deliveries.filter((d) => d.orderId === orderId);
  return { view, ships, pkgs, deliveries };
}

function SnapshotLines({ orderId }: { orderId: string }) {
  const { view, ships, pkgs, deliveries } = useOrderSnapshot(orderId);
  return (
    <ul className="space-y-1 text-sm">
      <li>Giai đoạn đơn: <strong>{view ? orderStages.find((s) => s.key === view.stage)?.label : "—"}</strong></li>
      <li>Lô hàng: {ships.length ? ships.map((s) => `${s.shipmentId} (${shipmentStatusMeta[shipmentStatus(s)].label})`).join(", ") : "chưa có"}</li>
      <li>Kiện trong kho: {pkgs.length ? pkgs.map((p) => `${p.packageId} (${packageStatusMeta[p.status].label})`).join(", ") : "chưa nhập kho"}</li>
      <li>Giao chặng cuối: {deliveries.length ? deliveries.map((d) => `${d.deliveryId} (${deliveryStatusMeta[d.status].label})`).join(", ") : "chưa giao"}</li>
    </ul>
  );
}

function AnswerDialog({ inquiry, onClose }: { inquiry: Inquiry; onClose: () => void }) {
  const { whActions, staffName } = useFulfillment();
  const [answer, setAnswer] = useState(inquiry.answer ?? "");
  const [error, setError] = useState<string>();
  const done = inquiry.status === "da-tra-loi";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yêu cầu {inquiry.inquiryId}</DialogTitle>
          <DialogDescription>Đơn {inquiry.orderId} · hỏi bởi {staffName(inquiry.askedBy)} ngày {formatDate(inquiry.askedAt)}</DialogDescription>
        </DialogHeader>
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">“{inquiry.question}”</p>
        <div className="rounded-lg border p-3">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase">Tình trạng hiện tại của đơn</p>
          <SnapshotLines orderId={inquiry.orderId} />
        </div>
        {done ? (
          <p className="text-sm">Đã trả lời bởi {staffName(inquiry.answeredBy ?? "")} ngày {inquiry.answeredAt && formatDate(inquiry.answeredAt)}: {inquiry.answer}</p>
        ) : (
          <Field label="Câu trả lời cho Sale" htmlFor="aq-answer" required><Textarea id="aq-answer" rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} /></Field>
        )}
        {error && <InlineAlert>{error}</InlineAlert>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
          {!done && inquiry.status === "moi" && <Button variant="outline" onClick={() => { const r = whActions.takeInquiry(inquiry.inquiryId); if (!r.ok) setError(r.error); else onClose(); }}>Nhận xử lý</Button>}
          {!done && <Button onClick={() => { const r = whActions.answerInquiry(inquiry.inquiryId, answer); if (r.ok) onClose(); else setError(r.error); }}>Gửi trả lời</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InquiriesView() {
  const { wh, crm, canWh, staffName } = useFulfillment();
  const [open, setOpen] = useState<string>();
  const customerOf = new Map(crm.contracts.map((c) => [c.orderId, crm.customers.find((x) => x.customerId === c.customerId)?.name ?? c.customerId]));
  const current = wh.inquiries.find((q) => q.inquiryId === open);

  const columns: Column<Inquiry>[] = [
    { key: "id", header: "Yêu cầu", cell: (q) => <span className="font-mono text-xs font-medium">{q.inquiryId}</span> },
    {
      key: "q",
      header: "Câu hỏi",
      cell: (q) => (
        <div className="min-w-0">
          <p className="max-w-72 truncate font-medium">{q.question}</p>
          <p className="text-xs text-muted-foreground"><Link href={`/van-hanh/don-hang/${q.orderId}`} className="font-mono hover:underline">{q.orderId}</Link> · {customerOf.get(q.orderId)}</p>
        </div>
      ),
    },
    { key: "by", header: "Sale hỏi", cell: (q) => staffName(q.askedBy), className: "hidden lg:table-cell" },
    { key: "date", header: "Ngày hỏi", cell: (q) => <span className="tabular text-muted-foreground">{formatDate(q.askedAt)}</span>, className: "hidden md:table-cell" },
    { key: "pri", header: "Ưu tiên", cell: (q) => (q.priority === "cao" ? <StatusBadge tone="danger">Cao</StatusBadge> : <span className="text-xs text-muted-foreground">Thường</span>), className: "hidden md:table-cell" },
    { key: "status", header: "Trạng thái", cell: (q) => <InquiryBadge value={q.status} /> },
    { key: "who", header: "Xử lý", cell: (q) => (q.assigneeId ? staffName(q.assigneeId) : "—"), className: "hidden xl:table-cell" },
    { key: "act", header: "Thao tác", cell: (q) => <Button size="sm" variant={q.status === "da-tra-loi" ? "outline" : "default"} onClick={() => setOpen(q.inquiryId)}>{q.status === "da-tra-loi" ? "Xem" : canWh() ? "Trả lời" : "Xem"}</Button> },
  ];

  return (
    <>
      <ListView dateLabel="Ngày hỏi" dateValue={(r) => r.askedAt}
        title="Yêu cầu hỏi tình trạng đơn"
        description="Sale hỏi tình trạng đơn/lô hàng; Fulfillment là một cửa trả lời. Sale tạo yêu cầu từ trang chi tiết hợp đồng."
        columns={columns}
        rows={wh.inquiries}
        getRowId={(q) => q.inquiryId}
        searchLabel="Tìm yêu cầu hỏi tình trạng"
        searchPlaceholder="Tìm câu hỏi, đơn hàng, khách…"
        searchText={(q) => [q.inquiryId, q.question, q.orderId, customerOf.get(q.orderId)]}
        filters={[{ id: "status", label: "Mọi trạng thái", options: (Object.keys(inquiryStatusMeta) as InquiryStatus[]).map((s) => ({ value: s, label: inquiryStatusMeta[s].label })), match: (q, v) => q.status === v }]}
        toggles={[{ id: "open", label: "Chỉ chưa trả lời", match: (q) => q.status !== "da-tra-loi" }]}
        sort={(a, b) => (a.status === "da-tra-loi" ? 1 : 0) - (b.status === "da-tra-loi" ? 1 : 0) || (a.priority === "cao" ? 0 : 1) - (b.priority === "cao" ? 0 : 1) || b.askedAt.localeCompare(a.askedAt)}
      />
      {current && <AnswerDialog inquiry={current} onClose={() => setOpen(undefined)} />}
    </>
  );
}

/** Khối dành cho Sale trong chi tiết hợp đồng: hỏi Fulfillment và xem câu trả lời. */
export function OrderInquiryCard({ orderId }: { orderId: string }) {
  const { wh, whActions, canWh, staffName } = useFulfillment();
  const [question, setQuestion] = useState("");
  const [priority, setPriority] = useState<"cao" | "thuong">("thuong");
  const [msg, setMsg] = useState<{ tone: "danger" | "success"; text: string }>();
  const items = wh.inquiries.filter((q) => q.orderId === orderId).sort((a, b) => b.askedAt.localeCompare(a.askedAt));
  const sale = canWh("inquiry.create");

  return (
    <SectionCard title="Hỏi tình trạng với Fulfillment" description="Fulfillment là một cửa trả lời về tình trạng hàng và giao nhận" className="mt-6">
      {sale && (
        <form
          className="mb-4 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const r = whActions.createInquiry(orderId, question, priority);
            setMsg(r.ok ? { tone: "success", text: "Đã gửi yêu cầu cho Fulfillment" } : { tone: "danger", text: r.error });
            if (r.ok) setQuestion("");
          }}
        >
          <Textarea aria-label="Câu hỏi về tình trạng đơn" rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ví dụ: Khi nào giao cho khách?" />
          <div className="flex items-center justify-end gap-2">
            <NativeSelect aria-label="Mức ưu tiên" className="w-36" value={priority} onChange={(e) => setPriority(e.target.value as "cao" | "thuong")}>
              <option value="thuong">Ưu tiên thường</option>
              <option value="cao">Ưu tiên cao</option>
            </NativeSelect>
            <Button type="submit">Gửi câu hỏi</Button>
          </div>
        </form>
      )}
      {msg && <InlineAlert tone={msg.tone} className="mb-3">{msg.text}</InlineAlert>}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có câu hỏi nào cho đơn này.</p>
      ) : (
        <ul className="divide-y">
          {items.map((q) => (
            <li key={q.inquiryId} className="py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{q.question}</p>
                <InquiryBadge value={q.status} />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{staffName(q.askedBy)} · {formatDate(q.askedAt)}</p>
              {q.answer && <p className="mt-1.5 rounded-lg bg-success-soft px-3 py-2 text-success">Trả lời ({staffName(q.answeredBy ?? "")}): {q.answer}</p>}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
