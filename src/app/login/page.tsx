import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { LoginForm, type DemoAccount } from "@/features/auth/login-form";
import users from "@/mocks/users.json";

export const metadata: Metadata = { title: "Đăng nhập" };

const flow = ["Lead", "RFQ", "Đơn hàng", "Giao hàng"];

export default function LoginPage() {
  const accounts = users.map((u) => ({ role: u.role, email: u.email })) as DemoAccount[];

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <main className="flex flex-col justify-center bg-surface px-6 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <Image src="/logo.png" alt="SpeeGo Logistics" width={170} height={51} priority className="h-11 w-auto" />
          <h1 className="mt-10 text-3xl font-semibold tracking-tight text-primary">Đăng nhập</h1>
          <p className="mt-2 mb-8 text-sm text-muted-foreground">
            Hệ thống quản trị nội bộ SpeeGo. Dùng tài khoản công ty để tiếp tục.
          </p>
          <LoginForm accounts={accounts} />
        </div>
      </main>

      <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute top-0 right-0 h-1.5 w-full bg-brand-orange" />
        <p className="flex items-center gap-2 text-sm font-medium text-white/80">
          <ShieldCheck aria-hidden className="size-4" /> SpeeGo Management Platform
        </p>
        <div>
          <h2 className="max-w-md text-4xl leading-tight font-semibold tracking-tight">
            Một đơn hàng, một luồng rõ ràng từ lead đến giao hàng.
          </h2>
          <p className="mt-4 max-w-md text-base text-white/75">
            Theo dõi lead, RFQ, đơn hàng, công nợ và công việc của từng phòng trong cùng một nơi.
          </p>
          <ol className="mt-10 flex flex-wrap items-center gap-2 text-sm font-medium">
            {flow.map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                <span className="rounded-md border border-white/25 bg-white/10 px-3 py-1.5">{step}</span>
                {i < flow.length - 1 && <ArrowRight aria-hidden className="size-4 text-brand-orange" />}
              </li>
            ))}
          </ol>
        </div>
        <p className="text-xs text-white/60">Phiên bản demo · dữ liệu giả lập</p>
      </aside>
    </div>
  );
}
