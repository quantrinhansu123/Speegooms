"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { InlineAlert } from "@/components/shared/form-fields";
import { lostReasonLabels } from "@/config/crm";
import type { LostReason } from "@/types/crm";
import { useCrm } from "../hooks";

/** Mất khách bắt buộc có lý do (giá, thời gian, niềm tin, hàng chưa sẵn sàng, khác). */
export function LostReasonDialog({ messId, open, onOpenChange }: { messId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { actions } = useCrm();
  const [reason, setReason] = useState<LostReason>();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();

  const close = (o: boolean) => {
    if (!o) {
      setReason(undefined);
      setNote("");
      setError(undefined);
    }
    onOpenChange(o);
  };

  const submit = () => {
    const res = actions.markLost(messId, reason, note);
    if (res.ok) close(false);
    else setError(res.error);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Đánh dấu mất khách</DialogTitle>
          <DialogDescription>Bắt buộc chọn lý do để Marketing và Sale rút kinh nghiệm.</DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">
            Lý do <span className="text-danger">*</span>
          </legend>
          {(Object.keys(lostReasonLabels) as LostReason[]).map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent">
              <input type="radio" name="lost-reason" checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--brand-navy)]" />
              {lostReasonLabels[r]}
            </label>
          ))}
        </fieldset>
        <div className="space-y-1.5">
          <label htmlFor="lost-note" className="text-sm font-medium">
            Ghi chú {reason === "khac" && <span className="text-danger">*</span>}
          </label>
          <Textarea id="lost-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Khách nói gì, có thể quay lại khi nào…" />
        </div>
        {error && <InlineAlert>{error}</InlineAlert>}
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Hủy
          </Button>
          <Button variant="destructive" onClick={submit}>
            Xác nhận mất khách
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
