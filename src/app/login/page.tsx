import type { Metadata } from "next";
import Image from "next/image";
import { AuthBrandPanel } from "@/features/auth/auth-brand-panel";
import { LoginForm, type DemoAccount } from "@/features/auth/login-form";
import users from "@/mocks/users.json";

export const metadata: Metadata = { title: "Đăng nhập" };

const rise = (i: number) => ({ "--i": i }) as React.CSSProperties;

export default function LoginPage() {
  const accounts = users.map((u) => ({ role: u.role, email: u.email })) as DemoAccount[];

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[58fr_42fr]">
      <AuthBrandPanel />

      <main className="flex min-h-dvh flex-col bg-surface px-6 py-8 sm:px-12 lg:min-h-0 lg:px-14 xl:px-20">
        {/* mobile/tablet: logo nằm trên form vì cột giới thiệu bị ẩn */}
        <header className="auth-rise lg:hidden" style={rise(0)}>
          <Image src="/logo.png" alt="SpeeGo Logistics" width={170} height={51} priority className="h-10 w-auto" />
        </header>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="auth-rise text-3xl font-semibold tracking-tight text-primary" style={rise(1)}>
            Đăng nhập
          </h1>
          <p className="auth-rise mt-2 mb-8 text-sm text-muted-foreground" style={rise(2)}>
            Đăng nhập để quản lý và kết nối toàn bộ hoạt động SpeeGo.
          </p>
          <div className="auth-rise" style={rise(3)}>
            <LoginForm accounts={accounts} />
          </div>
        </div>

        <footer className="mx-auto w-full max-w-md border-t pt-5 text-center text-xs text-muted-foreground">
          SpeeGo Logistics · Hệ thống quản trị nội bộ
        </footer>
      </main>
    </div>
  );
}
