"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Database, RotateCcw } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Forbidden } from "@/components/shared/forbidden";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { canAccess } from "@/config/roles";
import { useOps } from "./hooks";
import { resetOps } from "./store";

/** Cổng vào Vận hành: kiểm quyền theo vai trò, nạp dữ liệu demo (CRM + Vận hành), giải thích nguồn dữ liệu. */
export function OpsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, user, can } = useOps();
  const [confirmReset, setConfirmReset] = useState(false);

  if (!canAccess(user.role, pathname)) return <Forbidden />;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-surface px-4 py-2.5 text-sm text-muted-foreground">
        <Database aria-hidden className="size-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1">
          <strong className="font-medium text-foreground">Dữ liệu demo.</strong> Lưu trong localStorage của trình duyệt này, không đồng bộ giữa người dùng hay thiết bị. Đơn hàng, cọc và khách hàng đọc từ dữ liệu CRM.
          {!can() && " Vai trò của bạn chỉ xem, không có quyền thao tác trong Vận hành."}
        </p>
        <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)}>
          <RotateCcw /> Đặt lại dữ liệu Vận hành
        </Button>
      </div>
      {ready ? children : <TableSkeleton rows={8} columns={5} />}
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Đặt lại dữ liệu Vận hành?"
        description="Mọi nhà cung cấp, báo giá, PO, lô hàng và chứng từ bạn đã thêm hoặc sửa sẽ bị xóa và nạp lại dữ liệu mẫu. Dữ liệu CRM không bị ảnh hưởng."
        confirmLabel="Đặt lại"
        destructive
        onConfirm={() => void resetOps()}
      />
    </>
  );
}
