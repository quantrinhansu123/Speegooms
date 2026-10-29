import { Hammer } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Forbidden } from "@/components/shared/forbidden";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { findTitle } from "@/config/navigation";
import { canAccess } from "@/config/roles";
import { getSession } from "@/lib/session";

async function ModuleContent({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const href = `/${slug.join("/")}`;
  if (href === "/crm" || href === "/fulfillment") notFound();
  const title = findTitle(href);
  if (!title) notFound();

  const user = await getSession();
  if (!user || !canAccess(user.role, href)) return <Forbidden />;

  return (
    <>
      <PageHeader title={title} description="Module đang được thiết kế, sẽ triển khai ở giai đoạn tiếp theo." />
      <div className="rounded-xl border bg-card">
        <EmptyState
          icon={Hammer}
          title="Chưa có nội dung"
          description="Khung điều hướng đã sẵn sàng. Nghiệp vụ của module này chưa được triển khai."
        />
      </div>
    </>
  );
}

/** Trang giữ chỗ cho mọi module trong sidebar, thay bằng route thật khi làm giai đoạn sau. */
export default function ModulePlaceholder({ params }: { params: Promise<{ slug: string[] }> }) {
  return (
    <Suspense fallback={<TableSkeleton rows={8} columns={5} />}>
      <ModuleContent params={params} />
    </Suspense>
  );
}
