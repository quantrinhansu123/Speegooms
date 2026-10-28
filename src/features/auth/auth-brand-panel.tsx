import Image from "next/image";
import { Megaphone, Scale, Ship, TrendingUp, UsersRound, Wallet, type LucideIcon } from "lucide-react";

const rise = (i: number) => ({ "--i": i }) as React.CSSProperties;

const modules: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Megaphone, title: "Marketing", desc: "Chiến dịch, lead và phản hồi khách hàng" },
  { icon: TrendingUp, title: "Sale", desc: "Lead, RFQ, báo giá và hợp đồng Việt Nam & Global" },
  { icon: Ship, title: "Vận hành", desc: "Đơn hàng, nguồn hàng, PO và theo dõi lô hàng" },
  { icon: Wallet, title: "Kế toán", desc: "Công nợ, đề nghị và duyệt thanh toán" },
  { icon: UsersRound, title: "HCNS", desc: "Nhân sự, phòng ban, chức vụ và phân quyền" },
  { icon: Scale, title: "Pháp chế", desc: "Hợp đồng, tuân thủ và hồ sơ pháp lý" },
];

/** Cột giới thiệu bên trái (chỉ desktop): thương hiệu, thông điệp và các phân hệ chính. */
export function AuthBrandPanel() {
  return (
    <aside
      className="relative isolate hidden flex-col justify-between gap-10 overflow-hidden border-r bg-surface px-14 py-12 lg:flex xl:px-20"
      style={{
        backgroundImage:
          "radial-gradient(60% 45% at 0% 0%, color-mix(in oklab, var(--brand-orange) 16%, transparent), transparent), radial-gradient(45% 40% at 75% 65%, color-mix(in oklab, var(--brand-navy) 7%, transparent), transparent)",
      }}
    >
      {/* logo phóng to làm nền mờ; multiply để nền trắng của ảnh hòa vào gradient */}
      <Image
        src="/logo.png"
        alt=""
        aria-hidden
        width={170}
        height={51}
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 w-[40rem] max-w-none -translate-x-1/2 -translate-y-1/2 -rotate-6 opacity-[0.07] mix-blend-multiply select-none"
      />

      <div className="my-auto">
        <h2
          className="auth-rise text-5xl leading-[1.25] font-semibold tracking-tight text-primary xl:text-6xl"
          style={rise(1)}
        >
          Một nền tảng.
          <br />
          <span className="text-brand-orange-text">Kiểm soát toàn diện.</span>
        </h2>
        <p className="auth-rise mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground" style={rise(2)}>
          Kết nối bán hàng, nguồn hàng và vận hành logistics trên một nền tảng.
        </p>

        <ul className="mt-10 grid gap-x-8 gap-y-5 xl:grid-cols-2">
          {modules.map(({ icon: Icon, title, desc }, i) => (
            <li key={title} className="auth-rise flex items-start gap-4" style={rise(3 + i)}>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-white text-primary shadow-sm">
                <Icon aria-hidden className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground">© SpeeGo Logistics. All rights reserved.</p>
    </aside>
  );
}
