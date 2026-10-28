"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";

/** Cột Thao tác: icon Sửa/Xóa. onDelete trả về thông báo lỗi (hoặc null nếu xóa được). */
export function RowActions({ name, onEdit, onDelete }: {
  name: string;
  onEdit?: () => void;
  onDelete?: () => string | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-1">
      {onEdit && (
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Sửa ${name}`} title="Sửa" onClick={onEdit}>
          <Pencil aria-hidden />
        </Button>
      )}
      {onDelete && (
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Xóa ${name}`} title="Xóa" className="text-danger hover:bg-danger-soft hover:text-danger" onClick={() => { setError(null); setConfirming(true); }}>
          <Trash2 aria-hidden />
        </Button>
      )}
      {error && <span role="alert" className="ml-1 text-xs text-danger">{error}</span>}
      {onDelete && (
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          destructive
          title={`Xóa ${name}?`}
          description="Bản ghi sẽ bị xóa khỏi dữ liệu demo. Thao tác này không hoàn tác được."
          confirmLabel="Xóa"
          onConfirm={() => setError(onDelete())}
        />
      )}
    </div>
  );
}
