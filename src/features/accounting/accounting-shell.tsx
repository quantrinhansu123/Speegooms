"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Database, RotateCcw } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Forbidden } from "@/components/shared/forbidden";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { accountingDisclaimer } from "@/config/accounting";
import { canAccess } from "@/config/roles";
import { useAccounting } from "./hooks";
import { resetAccounting } from "./store";

/** Cổng vào Kế toán: kiểm quyền, nạp dữ liệu demo, nhắc rõ không có thanh toán thật. */
export function AccountingShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, user } = useAccounting();
  const [confirmReset, setConfirmReset] = useState(false);

  if (!canAccess(user.role, pathname)) return <Forbidden />;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-surface px-4 py-2.5 text-sm text-muted-foreground">
        <Database aria-hidden className="size-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1">
          <strong className="font-medium text-foreground">Dữ liệu demo.</strong> {accountingDisclaimer} Lưu trong localStorage của trình duyệt này. Cọc, hợp đồng đọc từ CRM; PO, lô hàng đọc từ Vận hành.
        </p>
        <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)}>
          <RotateCcw /> Đặt lại dữ liệu Kế toán
        </Button>
      </div>
      {ready ? children : <TableSkeleton rows={8} columns={5} />}
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Đặt lại dữ liệu Kế toán?"
        description="Mọi đề nghị thanh toán, khoản thu, đối soát và quyết toán bạn đã thêm hoặc sửa sẽ bị xóa và nạp lại dữ liệu mẫu. Trạng thái cọc nằm ở CRM nên không bị ảnh hưởng."
        confirmLabel="Đặt lại"
        destructive
        onConfirm={() => void resetAccounting()}
      />
    </>
  );
}
