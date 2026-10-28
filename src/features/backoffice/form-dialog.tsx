"use client";

import { useState } from "react";
import { InlineAlert } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Các form mock dùng chung phản hồi lỗi và giữ nguyên dữ liệu khi lưu thất bại. */
export function FormDialog({ title, description, onClose, onSave, children, submitLabel = "Lưu" }: {
  title: string; description: string; onClose: () => void;
  onSave: (data: FormData) => string | null; children: React.ReactNode; submitLabel?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        const message = onSave(new FormData(e.currentTarget));
        setError(message);
        if (!message) onClose();
      }}>
        {children}
        {error && <InlineAlert>{error}</InlineAlert>}
        <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit">{submitLabel}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
