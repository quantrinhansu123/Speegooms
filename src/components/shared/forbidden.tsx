import Link from "next/link";
import { LayoutDashboard, ShieldOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "./empty-state";

export function Forbidden() {
  return (
    <div className="rounded-xl border bg-card">
      <EmptyState
        headingLevel={1}
        icon={ShieldOff}
        title="Bạn chưa có quyền truy cập"
        description="Vai trò hiện tại không được cấp quyền vào mục này. Liên hệ quản trị viên nếu cần mở quyền."
        action={
          <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <LayoutDashboard /> Về tổng quan
          </Link>
        }
      />
    </div>
  );
}
