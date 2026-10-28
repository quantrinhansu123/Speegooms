"use client";

import { RotateCw } from "lucide-react";
import { EmptyState } from "./empty-state";
import { Button } from "@/components/ui/button";

export function ErrorState({ message = "Không thể tải dữ liệu. Dữ liệu demo đã lưu không bị xóa.", onRetry }: { message?: string; onRetry?: () => void }) {
  return <div role="alert" className="rounded-xl border bg-card"><EmptyState headingLevel={1} title="Đã có lỗi xảy ra" description={message} action={<Button variant="outline" onClick={onRetry ?? (() => window.location.reload())}><RotateCw /> Thử lại</Button>} /></div>;
}
