"use client";

import { X, RefreshCw, Save } from "lucide-react";
import { ArrowText } from "@/components/shared/arrow-text";

import { useEffect, useRef, useState } from "react";
import { InlineAlert } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Các form mock dùng chung phản hồi lỗi và giữ nguyên dữ liệu khi lưu thất bại. */
export function FormDialog({ title, description, onClose, onSave, children, submitLabel = "Tạo mới" }: {
  title: string; description: string; onClose: () => void;
  onSave: (data: FormData) => string | null; children: React.ReactNode; submitLabel?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
      <DialogHeader className="px-5 pt-5 pr-12 pb-3"><DialogTitle>{title}</DialogTitle><DialogDescription><ArrowText>{description}</ArrowText></DialogDescription></DialogHeader>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => {
        e.preventDefault();
        const message = onSave(new FormData(e.currentTarget));
        setError(message);
        if (!message) onClose();
      }}>
        {/* chỉ phần nhập liệu cuộn; thanh cuộn ẩn nhưng vẫn cuộn bằng chuột/phím/cảm ứng */}
        <div className="no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-2">
          {children}
          {error && <div tabIndex={-1} ref={errorRef}><InlineAlert>{error}</InlineAlert></div>}
        </div>
        <DialogFooter className="m-0 px-5"><Button type="button" variant="outline" onClick={onClose}><X /> Hủy</Button><Button type="submit">{submitLabel === "Cập nhật" ? <RefreshCw aria-hidden /> : submitLabel === "Đóng" ? <X aria-hidden /> : <Save aria-hidden />}{submitLabel}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
