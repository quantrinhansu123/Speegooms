"use client";

import { useEffect, useState } from "react";
import type { AssignmentDesk, AssignmentMember } from "@speego/shared";
import { InlineAlert } from "@/components/shared/form-fields";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSession } from "@/features/auth/session-provider";
import { ApiError, api } from "@/lib/api";

const reasonLabel = { leave: "Off · nghỉ phép đã duyệt hôm nay", manual: "Off · bật tay" } as const;

/** Danh sách nhân sự được chia đơn của một bàn, ai đang off thì bị bỏ qua; Admin / Vận hành chỉnh được mọi người, còn lại chỉnh của mình. */
export function AssignmentDialog({ desk, onClose, onChanged }: { desk: AssignmentDesk; onClose: () => void; onChanged: () => void }) {
  const user = useSession();
  const canEditAll = user.role === "admin" || user.role === "van-hanh";
  const [members, setMembers] = useState<AssignmentMember[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();

  useEffect(() => {
    api<{ members: AssignmentMember[] }>(`/api/chia-don/${desk}/members`)
      .then((body) => setMembers(body.members))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tải được danh sách chia đơn"));
  }, [desk]);

  const toggle = (member: AssignmentMember) => {
    setBusy(member.id);
    setError(undefined);
    // Đang off do nghỉ phép thì nút bật/tắt tay chỉ đổi cờ tay; hết ngày nghỉ sẽ tự nhận đơn lại.
    api<{ members: AssignmentMember[] }>(`/api/chia-don/${desk}/members/${member.id}`, {
      method: "PUT",
      body: JSON.stringify({ off: member.offReason !== "manual" }),
    })
      .then((body) => { setMembers(body.members); onChanged(); })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không đổi được trạng thái"))
      .finally(() => setBusy(undefined));
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chia đơn {desk === "sourcing" ? "Sourcing" : "Logistics"}</DialogTitle>
          <DialogDescription>Đơn mới được chia xoay vòng, ai nhận đơn sẽ có thông báo. Người đang off không được chia đơn.</DialogDescription>
        </DialogHeader>
        {error && <InlineAlert>{error}</InlineAlert>}
        <ul className="divide-y rounded-lg border">
          {members.length === 0 && !error && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Chưa có danh sách nhận đơn.</li>}
          {members.map((member) => {
            const mine = member.id === user.id;
            const editable = canEditAll || mine;
            return (
              <li key={member.id} className="flex items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{member.name}{mine ? " (bạn)" : ""}</p>
                  <div className="mt-1">
                    {member.off
                      ? <StatusBadge tone="warning">{reasonLabel[member.offReason ?? "manual"]}</StatusBadge>
                      : <StatusBadge tone="success">Đang nhận đơn</StatusBadge>}
                  </div>
                </div>
                {editable && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy === member.id || (member.offReason === "leave")}
                    title={member.offReason === "leave" ? "Tự nhận đơn lại khi hết ngày nghỉ phép" : undefined}
                    onClick={() => toggle(member)}
                  >
                    {member.offReason === "manual" ? "Bật nhận đơn" : "Đặt off"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
