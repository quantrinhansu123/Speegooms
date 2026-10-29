"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ChevronDown, Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { roleConfig } from "@/config/roles";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/role";
import { ApiError, api } from "@/lib/api";
import { DEMO_PASSWORD, loginSchema, type LoginInput } from "./schema";

export interface DemoAccount {
  role: Role;
  email: string;
}

export function LoginForm({ accounts }: { accounts: DemoAccount[] }) {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string>();
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    control,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "", remember: false },
  });
  const email = useWatch({ control, name: "email" });

  // Chỉ tự focus trên desktop để tránh bật bàn phím ảo trên điện thoại.
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) setFocus("email");
  }, [setFocus]);

  const onSubmit = (values: LoginInput) => {
    setServerError(undefined);
    startTransition(async () => {
      try {
        await api("/api/auth/login", { method: "POST", body: JSON.stringify(values) });
        window.location.assign("/dashboard");
      } catch (err) {
        setServerError(err instanceof ApiError ? err.message : "Không kết nối được máy chủ");
        setFocus("password");
      }
    });
  };

  const fillDemo = (acc: DemoAccount) => {
    setValue("email", acc.email, { shouldValidate: true });
    setValue("password", DEMO_PASSWORD, { shouldValidate: true });
    setServerError(undefined);
  };

  const field = "h-11 rounded-lg border-input bg-background pl-11 text-sm shadow-xs transition-[border-color,box-shadow] duration-200 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15";

  return (
    <div>
      <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {serverError && (
          <div role="alert" className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger">
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
            {serverError}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email công ty
          </label>
          <div className="relative">
            <Mail aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              placeholder="ten@speego.vn"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              className={field}
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p id="email-error" className="text-sm text-danger">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Mật khẩu
          </label>
          <div className="relative">
            <LockKeyhole aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
              className={cn(field, "pr-12")}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              aria-pressed={showPassword}
              className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none"
            >
              {showPassword ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className="text-sm text-danger">
              {errors.password.message}
            </p>
          )}
        </div>

        <label htmlFor="remember" className="flex w-fit cursor-pointer items-center gap-2.5 text-sm select-none">
          <input
            id="remember"
            type="checkbox"
            className="size-4 cursor-pointer rounded accent-primary focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none"
            {...register("remember")}
          />
          Ghi nhớ đăng nhập
        </label>

        {/* Nút cam: chữ navy đạt tương phản ~4.5:1, chữ trắng trên cam chỉ ~3.2:1 */}
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          aria-busy={pending}
          className="h-11 w-full cursor-pointer bg-brand-orange text-sm font-semibold text-primary shadow-sm transition-all duration-200 hover:bg-brand-orange/90 hover:shadow-md focus-visible:ring-brand-orange/40 disabled:opacity-80"
        >
          {pending && <Loader2 aria-hidden className="animate-spin" />}
          {pending ? "Đang đăng nhập…" : "Đăng nhập"}
        </Button>
      </form>

      <details className="group mt-8 rounded-xl border bg-background">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-4 py-3 text-sm font-medium focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          Tài khoản demo theo vai trò
          <ChevronDown aria-hidden className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t px-4 pt-3 pb-4">
          <p className="text-xs text-muted-foreground">
            Chọn một vai trò để điền sẵn email. Mật khẩu demo là speego@demo. Đăng nhập kiểm tra trên máy chủ.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {accounts.map((acc) => (
              <button
                key={acc.role}
                type="button"
                onClick={() => fillDemo(acc)}
                aria-pressed={email === acc.email}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none",
                  email === acc.email
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-surface text-foreground hover:bg-muted",
                )}
              >
                {roleConfig[acc.role].label}
              </button>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
