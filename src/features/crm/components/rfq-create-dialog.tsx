"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { CRM_TODAY } from "@/config/crm";
import { addDays } from "@/features/dashboard/metrics";
import type { Lead } from "@/types/crm";
import { useCrm } from "../hooks";
import type { NewRfqInput } from "../store";
import { RfqForm } from "./rfq-form";

/** Tạo RFQ từ lead Hot. Gợi ý trường từ 6 thông tin đã hỏi, Sale kiểm tra lại. */
export function RfqCreateDialog({
  open,
  onOpenChange,
  presetMessId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  presetMessId?: string;
  onCreated: (rfqId: string) => void;
}) {
  const { data, actions } = useCrm();
  const [messId, setMessId] = useState(presetMessId ?? "");
  const [error, setError] = useState<string>();

  const hotLeads = useMemo(() => data.leads.filter((l) => l.temperature === "hot" && l.careStatus !== "mat"), [data.leads]);
  const lead: Lead | undefined = data.leads.find((l) => l.messId === messId);

  const defaults: NewRfqInput = useMemo(
    () => ({
      goodsName: lead?.profile.f1?.value ?? lead?.needSummary ?? "",
      quantity: 1,
      unit: "cái",
      originPoint: "",
      destination: lead?.profile.f4?.value ?? "",
      transportMode: "sea-lcl",
      targetDate: addDays(CRM_TODAY, 45),
      specialRequirements: "",
      sensitiveGoods: false,
    }),
    [lead],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tạo RFQ từ lead</DialogTitle>
          <DialogDescription>Mỗi RFQ giữ mess_id của lead và customer_id của khách. Một lead có thể có nhiều RFQ (cần xác minh quy trình).</DialogDescription>
        </DialogHeader>
        {!presetMessId && (
          <Field label="Lead Hot" htmlFor="rc-lead" required hint="Chỉ lead Hot, chưa mất khách mới tạo được RFQ.">
            <NativeSelect id="rc-lead" value={messId} onChange={(e) => setMessId(e.target.value)}>
              <option value="">Chọn lead</option>
              {hotLeads.map((l) => (
                <option key={l.messId} value={l.messId}>
                  {l.contactName} · {l.company} · {l.messId}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        {error && <InlineAlert>{error}</InlineAlert>}
        {lead ? (
          <RfqForm
            key={lead.messId}
            defaultValues={defaults}
            submitLabel="Tạo mới"
            onCancel={() => onOpenChange(false)}
            onSubmit={(v) => {
              const res = actions.createRfqFromLead(lead.messId, v);
              if (res.ok && res.id) {
                onOpenChange(false);
                onCreated(res.id);
              } else if (!res.ok) setError(res.error);
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Chọn lead để điền yêu cầu báo giá.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
