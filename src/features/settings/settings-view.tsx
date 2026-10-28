"use client";

import { useState, useTransition } from "react";
import { LogOut, RotateCcw } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { InlineAlert } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { roleConfig, navigationForRole } from "@/config/roles";
import { logoutAction } from "@/features/auth/actions";
import { useSession } from "@/features/auth/session-provider";
import { resetAccounting } from "@/features/accounting/store";
import { resetBackoffice } from "@/features/backoffice/store";
import { resetCrm } from "@/features/crm/store";
import { resetFulfillment } from "@/features/fulfillment/store";
import { resetOps } from "@/features/operations/store";

const initials = (name: string) => name.split(" ").slice(-2).map((w) => w[0]).join("").toUpperCase();

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-sm font-medium">{children}</dd></div>;
}

/** Cài đặt cá nhân: hồ sơ tài khoản, phạm vi truy cập theo vai trò, đặt lại dữ liệu demo và đăng xuất. */
export function SettingsView() {
  const user = useSession();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string }>();
  const [pending, startTransition] = useTransition();
  const groups = navigationForRole(user.role);

  const resetAll = () => startTransition(async () => {
    try {
      // Thứ tự: CRM trước, các module đọc chéo sau
      await resetCrm();
      await resetOps();
      await resetAccounting();
      await resetFulfillment();
      await resetBackoffice();
      setMessage({ tone: "success", text: "Đã nạp lại dữ liệu demo gốc cho toàn bộ module." });
    } catch {
      setMessage({ tone: "danger", text: "Không đặt lại được dữ liệu demo. Vui lòng thử lại." });
    }
  });

  return <>
    <PageHeader title="Cài đặt" description="Thông tin tài khoản, phạm vi truy cập theo vai trò và dữ liệu demo." />
    <div className="grid gap-6 xl:grid-cols-2">
      <SectionCard title="Tài khoản">
        <div className="mb-4 flex items-center gap-4">
          <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{initials(user.name)}</span>
          <div>
            <p className="font-semibold">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <dl className="divide-y border-t">
          <Row label="Vai trò">{roleConfig[user.role].label}</Row>
          <Row label="Phòng ban">{user.department}</Row>
          <Row label="Chức danh">{user.title}</Row>
        </dl>
        <form action={logoutAction} className="mt-4">
          <Button type="submit" variant="outline"><LogOut /> Đăng xuất</Button>
        </form>
      </SectionCard>

      <SectionCard title="Phạm vi truy cập" description="Phân quyền ở giao diện demo, không thay thế phân quyền phía máy chủ.">
        <ul className="space-y-4">
          {groups.map((g) => <li key={g.label}>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.label}</p>
            <div className="flex flex-wrap gap-2">
              {g.items.map((i) => <span key={i.href} className="rounded-full border bg-muted/40 px-3 py-1 text-sm">{i.title}</span>)}
            </div>
          </li>)}
        </ul>
      </SectionCard>
    </div>

    <SectionCard className="mt-6" title="Dữ liệu demo" description="Mọi thay đổi trong bản demo được lưu trên trình duyệt này. Đặt lại sẽ nạp lại dữ liệu gốc.">
      {message && <InlineAlert tone={message.tone} className="mb-4">{message.text}</InlineAlert>}
      <Button variant="outline" disabled={pending} onClick={() => setConfirming(true)}><RotateCcw /> Đặt lại dữ liệu demo</Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        destructive
        title="Đặt lại dữ liệu demo?"
        description="Mọi lead, RFQ, hợp đồng, đơn hàng và hồ sơ bạn đã thêm hoặc sửa sẽ bị thay bằng dữ liệu gốc. Không hoàn tác được."
        confirmLabel="Đặt lại"
        onConfirm={resetAll}
      />
    </SectionCard>
  </>;
}
