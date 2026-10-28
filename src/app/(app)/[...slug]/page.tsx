import { Hammer } from "lucide-react";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { Forbidden } from "@/components/shared/forbidden";
import { PageHeader } from "@/components/shared/page-header";
import { allHrefs, findTitle } from "@/config/navigation";
import { implementedRoutes } from "@/config/modules";
import { canAccess } from "@/config/roles";
import { getSession } from "@/lib/session";

export function generateStaticParams() {
  return allHrefs.filter((h) => !implementedRoutes.includes(h)).map((h) => ({ slug: h.slice(1).split("/") }));
}

/** Trang giữ chỗ cho mọi module trong sidebar, thay bằng route thật khi làm giai đoạn sau. */
export default async function ModulePlaceholder({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const href = `/${slug.join("/")}`;
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
