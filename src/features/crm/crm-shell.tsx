"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Database, RotateCcw } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Forbidden } from "@/components/shared/forbidden";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { canAccess, roleConfig } from "@/config/roles";
import { routeLabels } from "@/config/crm";
import { useCrm } from "./hooks";
import { resetCrm } from "./store";

/** Cổng vào CRM: kiểm quyền theo vai trò, nạp dữ liệu demo, giải thích nguồn dữ liệu. */
export function CrmShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, user, scope } = useCrm();
  const [confirmReset, setConfirmReset] = useState(false);

  if (!canAccess(user.role, pathname)) return <Forbidden />;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-surface px-4 py-2.5 text-sm text-muted-foreground">
        <Database aria-hidden className="size-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1">
          <strong className="font-medium text-foreground">Dữ liệu demo.</strong> Lưu trong localStorage của trình duyệt này: giữ khi tải lại trang,
          không đồng bộ giữa người dùng hay thiết bị.
          {scope && ` Bạn đang xem phạm vi ${routeLabels[scope]} (${roleConfig[user.role].label}).`}
        </p>
        <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)}>
          <RotateCcw /> Đặt lại dữ liệu demo
        </Button>
      </div>
      {ready ? children : <TableSkeleton rows={8} columns={5} />}
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Đặt lại dữ liệu demo?"
        description="Mọi lead, RFQ, báo giá, hợp đồng bạn đã thêm hoặc sửa sẽ bị xóa và nạp lại dữ liệu mẫu ban đầu."
        confirmLabel="Đặt lại"
        destructive
        onConfirm={() => void resetCrm()}
      />
    </>
  );
}
