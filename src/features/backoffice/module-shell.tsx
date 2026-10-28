"use client";

import { usePathname } from "next/navigation";
import { Forbidden } from "@/components/shared/forbidden";
import { InlineAlert } from "@/components/shared/form-fields";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { canAccess } from "@/config/roles";
import { useBackoffice } from "./hooks";

export function ModuleShell({ children }: { children: React.ReactNode }) {
  const { ready, user } = useBackoffice();
  const pathname = usePathname();
  if (!canAccess(user.role, pathname)) return <Forbidden />;
  return <>
    <InlineAlert tone="info" className="mb-6">
      <strong>Dữ liệu demo.</strong> Lưu trong localStorage của trình duyệt này; không đồng bộ tài khoản/thiết bị. Không kết nối dịch vụ ngoài. Ngày mô phỏng: 28/10/2026.
      {" "}<strong>UI đề xuất, chưa chốt nghiệp vụ:</strong> phân quyền thao tác, SLA, quy trình duyệt, đền bù, hồ sơ và onboarding chỉ để tham khảo; không phát sinh thanh toán hay phê duyệt thực tế.
    </InlineAlert>
    {!ready && <TableSkeleton rows={6} columns={5} />}
    <div hidden={!ready}>{children}</div>
  </>;
}
