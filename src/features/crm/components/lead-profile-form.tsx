"use client";

import { useState } from "react";
import { AlertTriangle, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineAlert } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { leadProfileApproved, leadProfileFields } from "@/config/crm";
import { addDays } from "@/features/dashboard/metrics";
import { CRM_TODAY } from "@/config/crm";
import type { Lead } from "@/types/crm";
import { useCrm } from "../hooks";

type Draft = Record<string, { value: string; recontactOn: string }>;

const toDraft = (lead: Lead): Draft =>
  Object.fromEntries(
    leadProfileFields.map((f) => [f.id, { value: lead.profile[f.id]?.value ?? "", recontactOn: lead.profile[f.id]?.recontactOn ?? "" }]),
  );

/**
 * Form "6 thông tin" dựng từ cấu hình (config/crm.ts). Ô bỏ trống được ghi là thiếu kèm ngày hỏi lại, không tự điền.
 * Tiêu chí "đủ thông tin" chưa được duyệt nên form chỉ đếm số ô đã có, không khẳng định chất lượng.
 */
export function LeadProfileForm({ lead }: { lead: Lead }) {
  const { actions, can } = useCrm();
  const writable = can("lead.write");
  const [draft, setDraft] = useState<Draft>(() => toDraft(lead));
  const [saved, setSaved] = useState(false);
  const filled = leadProfileFields.filter((f) => draft[f.id].value.trim()).length;

  const save = () => {
    const profile: Lead["profile"] = {};
    for (const f of leadProfileFields) {
      const { value, recontactOn } = draft[f.id];
      profile[f.id] = value.trim() ? { value: value.trim() } : { missing: true, recontactOn: recontactOn || addDays(CRM_TODAY, 1) };
    }
    if (actions.saveProfile(lead.messId, profile).ok) setSaved(true);
  };

  return (
    <SectionCard
      title="Thông tin cần hỏi (6 thông tin)"
      description={`Đã có ${filled}/${leadProfileFields.length}`}
      action={
        <div className="h-2 w-28 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={leadProfileFields.length} aria-valuenow={filled} aria-label="Số thông tin đã có">
          <div className="h-full bg-primary" style={{ width: `${(filled / leadProfileFields.length) * 100}%` }} />
        </div>
      }
    >
      {!leadProfileApproved && (
        <InlineAlert tone="warning" className="mb-4 flex items-start gap-2">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            Danh sách 6 thông tin là <strong>cấu hình tạm</strong>. Tài liệu nghiệp vụ chưa chốt tiêu chí chi tiết (câu Q20), cần Marketing và Ban GĐ xác nhận. Chỉnh tại
            <code className="mx-1 rounded bg-surface px-1">config/crm.ts</code>.
          </span>
        </InlineAlert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {leadProfileFields.map((f, i) => {
          const d = draft[f.id];
          const missing = !d.value.trim();
          return (
            <div key={f.id} className="space-y-1.5">
              <label htmlFor={`pf-${f.id}`} className="flex items-center justify-between gap-2 text-sm font-medium">
                <span>
                  {i + 1}. {f.label}
                </span>
                {missing ? <span className="text-xs font-normal text-warning">Thiếu</span> : <Check aria-label="Đã có" className="size-4 text-success" />}
              </label>
              <Input
                id={`pf-${f.id}`}
                value={d.value}
                disabled={!writable}
                placeholder={f.placeholder}
                onChange={(e) => {
                  setSaved(false);
                  setDraft({ ...draft, [f.id]: { ...d, value: e.target.value } });
                }}
              />
              {missing && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <label htmlFor={`pr-${f.id}`}>Hỏi lại ngày</label>
                  <input
                    id={`pr-${f.id}`}
                    type="date"
                    value={d.recontactOn}
                    disabled={!writable}
                    onChange={(e) => {
                      setSaved(false);
                      setDraft({ ...draft, [f.id]: { ...d, recontactOn: e.target.value } });
                    }}
                    className="h-7 rounded-md border border-input bg-surface px-2 text-xs"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {writable && (
        <div className="mt-4 flex items-center justify-end gap-3">
          {saved && (
            <span role="status" className="text-sm text-success">
              Đã lưu
            </span>
          )}
          <Button onClick={save}><RefreshCw aria-hidden /> Lưu thông tin</Button>
        </div>
      )}
    </SectionCard>
  );
}
