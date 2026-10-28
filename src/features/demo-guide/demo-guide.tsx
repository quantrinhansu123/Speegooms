"use client";

import { ArrowText } from "@/components/shared/arrow-text";

import Link from "next/link";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { roleConfig, canAccess } from "@/config/roles";
import { allHrefs, findTitle } from "@/config/navigation";
import { isImplemented } from "@/config/modules";
import { useSession } from "@/features/auth/session-provider";
import { DEMO_PASSWORD } from "@/features/auth/schema";
import users from "@/mocks/users.json";
import type { Role } from "@/types/role";

const steps = [
  { title: "1. Tổng quan điều hành", role: "Ban Giám đốc", href: "/dashboard", text: "Xem KPI và hàng đợi duyệt theo vai trò. Chọn kỳ, đối chiếu Reports; ghi rõ chỉ số trong kỳ và số dư hiện tại." },
  { title: "2. Tiếp nhận lead", role: "Sale Việt Nam / Global", href: "/crm/leads", text: "Tạo lead không trùng số điện thoại, chọn xuất xứ và nguồn; bổ sung đủ 6 thông tin để lên Hot. VN → Sale Việt Nam, CN → Sale Global. Tiêu chí 6 thông tin vẫn là đề xuất chưa duyệt." },
  { title: "3. Tạo RFQ và xin giá", role: "Sale → Vận hành", href: "/crm/rfq", text: "Tạo RFQ từ lead Hot, điền hàng hóa/tuyến/đích/số lượng. Gửi xin giá Sourcing và Logistics. Vận hành tìm NCC, nhập và chọn báo giá; trả đủ hai phần giá." },
  { title: "4. Báo giá khách", role: "Sale / người duyệt demo", href: "/crm/bao-gia", text: "Tạo báo giá từ RFQ có giá. Kiểm tra tiền hàng, cước, phụ phí; nếu vượt ngưỡng giảm giá mô phỏng thì trình duyệt trước khi gửi. Ghi nhận khách chấp nhận." },
  { title: "5. Hợp đồng và cọc", role: "Sale → Kế toán", href: "/crm/hop-dong", text: "Tạo hợp đồng, duyệt Ban GĐ nếu thuộc ngưỡng mô phỏng, ký và yêu cầu cọc có bill tham chiếu. Chỉ tài khoản Kế toán được xác nhận Đã cọc; Admin không được bỏ qua bước này." },
  { title: "6. Bàn giao và PO", role: "Sale → Vận hành", href: "/van-hanh/don-hang", text: "Sale bàn giao sau khi đã cọc. Vận hành kiểm checklist, nhận hoặc trả lại có lý do. Chỉ đặt xưởng khi đã cọc và đủ bàn giao. Tạo PO từ báo giá NCC đã chọn, cập nhật sản xuất và QC." },
  { title: "7. Lô hàng và chứng từ", role: "Vận hành", href: "/van-hanh/logistics", text: "Tạo lô từ PO sẵn sàng, cập nhật mốc đúng thứ tự. Bổ sung và duyệt chứng từ để đạt cổng quyết toán. Tracking chỉ là mẫu/nhập tay." },
  { title: "8. Kho và giao hàng", role: "Vận hành / Fulfillment", href: "/fulfillment", text: "Lô về kho → kiểm đếm nhập kho → tạo lệnh pick → pick đủ → pack → giao đối tác. Xác nhận POD có người nhận và bằng chứng tham chiếu. POD cập nhật mốc giao khi đủ điều kiện; thử nhánh giao thất bại và giao lại." },
  { title: "9. Thu/chi và quyết toán", role: "Kế toán / người duyệt", href: "/ke-toan", text: "Nhập đề nghị chi, duyệt đúng cấp và tách người nhập/duyệt/chi. Đối chiếu, thu phần còn lại; chỉ đóng quyết toán khi đã giao, thu đủ, chi xong và duyệt đủ chứng từ. Chi phí thực tế cần đối chiếu thêm; hiện chưa là cổng bắt buộc. Không có chuyển tiền thật." },
  { title: "10. Báo cáo và module hỗ trợ", role: "Theo quyền từng phòng", href: "/reports", text: "Đối chiếu chuyển đổi và công nợ với đơn vừa làm. Tìm, lọc ngày, sắp xếp, phân trang và xuất CSV. Minh họa khiếu nại/đền bù, HRM và pháp chế; các luồng chưa chốt đều có chú thích đề xuất." },
];

export function DemoGuide() {
  const user = useSession();
  const pending = [...new Set(allHrefs)].filter((href) => !isImplemented(href));
  return <>
    <PageHeader title="Demo Guide" description="Kịch bản trình diễn SpeeGo Management Platform cho Ban Giám đốc · ngày mô phỏng 28/10/2026." />
    <SectionCard title="Chuẩn bị trước buổi demo" className="mb-6"><ol className="list-decimal space-y-2 pl-5 text-sm"><li>Mở một trình duyệt, dùng menu người dùng <ArrowText>{"→"}</ArrowText> Đăng xuất để đổi vai trò. Dữ liệu localStorage dùng chung trên cùng origin; các thiết bị/port khác nhau có dữ liệu riêng.</li><li>Tại màn Đăng nhập, bấm vai trò để điền sẵn tài khoản. Mật khẩu chung: <code className="rounded bg-muted px-2 py-1">{DEMO_PASSWORD}</code>.</li><li>Dữ liệu đã chỉnh sửa được giữ khi tải lại trang. Giao diện không có nút đặt lại dữ liệu.</li><li>Dùng kỳ 01/07/2026–28/10/2026 để xem đầy đủ seed; dùng tháng 10 để trình diễn dữ liệu mới. Với luồng mới, ghi lại mess_id <ArrowText>{"→"}</ArrowText> rfq_id <ArrowText>{"→"}</ArrowText> quote_id <ArrowText>{"→"}</ArrowText> order_id.</li></ol></SectionCard>
    <SectionCard title="Tài khoản và phạm vi vai trò" description="Phân quyền FE được cấu hình tập trung; nhân sự HRM không tự cấp tài khoản đăng nhập" className="mb-6"><DataTable rows={users} getRowId={(u) => u.id} columns={[
      { key: "name", header: "Tài khoản", cell: (u) => <div><p className="font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></div> },
      { key: "role", header: "Vai trò", cell: (u) => roleConfig[u.role as Role].label },
      { key: "scope", header: "Phạm vi trình diễn", cell: (u) => <p className="min-w-60 max-w-96 whitespace-normal">{({ admin: "Tổng quan; cấu hình demo; không xác nhận cọc/ghi chi thay Kế toán", "ban-gd": "Điều hành; duyệt mô phỏng; xem liên phòng", marketing: "Nguồn lead, chiến dịch, xem phản hồi Sales", "sale-vn": "CRM tuyến Việt Nam; phản hồi lead; tạo khiếu nại", "sale-global": "CRM tuyến Global; phản hồi lead; tạo khiếu nại", "van-hanh": "Sourcing, NCC, PO, logistics, kho, giao hàng, khiếu nại", "ke-toan": "Xác nhận cọc, công nợ, ghi nhận thu/chi và quyết toán", hcns: "Nhân sự, cơ cấu, tuyển dụng, onboarding, chấm công", "phap-che": "Rà soát hồ sơ, ý kiến và trình duyệt pháp lý" })[u.role] ?? u.title}</p> },
    ]} /></SectionCard>
    <div className="mb-6 grid gap-6 lg:grid-cols-2">{steps.map((s) => <SectionCard key={s.title} title={s.title} description={s.role}><p className="mb-4 text-sm"><ArrowText>{s.text}</ArrowText></p>{canAccess(user.role, s.href) ? <Link className="text-sm font-medium text-primary hover:underline" href={s.href}>Mở màn hình <ArrowText>{"→"}</ArrowText></Link> : <StatusBadge>Đổi sang vai trò phù hợp để xem</StatusBadge>}</SectionCard>)}</div>
    <SectionCard title="Các màn còn giữ chỗ" description="Không đưa các mục này vào kịch bản demo hoàn chỉnh. Dashboard theo role đã có tại Tổng quan; trang nhóm phụ chưa có nghiệp vụ riêng." className="mb-6"><ul className="grid gap-2 text-sm sm:grid-cols-2">{pending.map((href) => <li key={href}><strong>{findTitle(href)}</strong><span className="ml-2 break-all text-xs text-muted-foreground">{href}</span></li>)}</ul></SectionCard>
    <SectionCard title="Phần cần chốt trước khi tích hợp thật"><ul className="list-disc space-y-2 pl-5 text-sm"><li>Ngưỡng phê duyệt báo giá, hợp đồng và chi; tiêu chí lead Hot; SLA và trách nhiệm khiếu nại/đền bù; quy trình HRM và pháp chế.</li><li>Tỷ lệ giao đúng hạn hiện là chỉ số đề xuất theo lượt giao có POD và hạn đơn; điểm NCC là mock. Chưa có ROAS/ROI/CPL khi thiếu liên kết chiến dịch.</li><li>API, authentication, RBAC/ABAC, dữ liệu theo tenant/tuyến, audit log, tệp, tiền tệ, transaction/idempotency và xử lý đồng thời do Backend cung cấp. Tài liệu bàn giao trong API_INTEGRATION_GUIDE.md của repository.</li></ul></SectionCard>
  </>;
}
