import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";

const HRM_URL = "https://hrmspeego.vercel.app/";

export default function Page() {
  return (
    <div className="flex h-full min-h-[32rem] flex-col">
      <PageHeader
        title="Hành chính nhân sự"
        description="Quản lý nhân sự, chấm công và nghỉ phép. Đăng nhập bằng tài khoản HRM của anh/chị."
        actions={
          <a href={HRM_URL} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
            <ExternalLink aria-hidden /> Mở HRM ở tab riêng
          </a>
        }
      />
      <iframe
        src={HRM_URL}
        title="SpeeGo HRM — Hành chính nhân sự"
        allow="geolocation"
        className="min-h-0 w-full flex-1 rounded-lg border bg-white"
      />
    </div>
  );
}
