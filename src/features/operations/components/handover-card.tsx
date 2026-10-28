"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { InlineAlert } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { handoverItems } from "@/config/operations";
import { formatDate } from "@/lib/format";
import type { OrderView } from "@/services/ops/rules";
import { useOps } from "../hooks";

/**
 * Checklist bàn giao Sale → Vận hành theo phiếu bàn giao trong tài liệu.
 * Vận hành tích từng mục; đủ thì nhận, thiếu thì trả lại Sale kèm lý do (không bắt đầu). Chỉ nhận khi đã có "Đã cọc".
 */
export function HandoverCard({ view }: { view: OrderView }) {
  const { actions, can, staffName } = useOps();
  const { handover } = view.state;
  const orderId = view.contract.orderId;
  const [items, setItems] = useState<Record<string, boolean>>(handover.items);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "danger" | "success"; text: string }>();
  const done = handover.status === "da-nhan";
  const editable = can() && !done;
  const checked = handoverItems.filter((i) => items[i.id]).length;
  const depositOk = view.contract.deposit.status === "da-coc";
  const run = (r: { ok: boolean; error?: string }, success?: string) => setMsg(r.ok ? (success ? { tone: "success", text: success } : undefined) : { tone: "danger", text: r.error ?? "Không thực hiện được" });

  return (
    <SectionCard
      title="Bàn giao Sale → Vận hành"
      description={`${checked}/${handoverItems.length} mục đã có`}
      action={<StatusBadge tone={done ? "success" : handover.status === "tra-lai" ? "danger" : "warning"}>{done ? "Đã nhận" : handover.status === "tra-lai" ? "Đã trả lại Sale" : "Chờ xác nhận"}</StatusBadge>}
    >
      {!depositOk && <InlineAlert tone="warning" className="mb-3 text-xs">Chưa có xác nhận Đã cọc của Kế toán nên chưa nhận bàn giao hay đặt xưởng.</InlineAlert>}
      {handover.status === "tra-lai" && handover.note && <InlineAlert className="mb-3 text-xs">Đã trả lại Sale: {handover.note}</InlineAlert>}
      <ul className="space-y-1.5">
        {handoverItems.map((i) => (
          <li key={i.id}>
            <label className="flex items-center gap-2.5 rounded-md px-1 py-1 text-sm hover:bg-muted/60">
              <input type="checkbox" className="size-4 accent-[var(--brand-navy)]" checked={!!items[i.id]} disabled={!editable} onChange={(e) => setItems({ ...items, [i.id]: e.target.checked })} />
              <span className={items[i.id] ? "" : "text-muted-foreground"}>{i.label}</span>
              {!items[i.id] && <span className="ml-auto text-xs text-warning">Thiếu</span>}
            </label>
          </li>
        ))}
      </ul>
      {msg && <InlineAlert tone={msg.tone} className="mt-3">{msg.text}</InlineAlert>}
      {editable && (
        <div className="mt-4 space-y-2 border-t pt-4">
          <Textarea aria-label="Lý do trả lại Sale" rows={2} placeholder="Nếu trả lại Sale: ghi rõ còn thiếu gì" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => run(actions.saveHandoverItems(orderId, items), "Đã lưu checklist")}>Lưu checklist</Button>
            <Button onClick={() => run(actions.reviewHandover(orderId, items, "accept", ""), "Đã nhận bàn giao")}><Check /> Xác nhận đủ, nhận bàn giao</Button>
            <Button variant="destructive" onClick={() => run(actions.reviewHandover(orderId, items, "return", note))}>Trả lại Sale</Button>
          </div>
        </div>
      )}
      {handover.reviewedAt && <p className="mt-3 text-xs text-muted-foreground">Vận hành xử lý ngày {formatDate(handover.reviewedAt)}{handover.reviewedBy ? ` · ${staffName(handover.reviewedBy)}` : ""}</p>}
    </SectionCard>
  );
}
