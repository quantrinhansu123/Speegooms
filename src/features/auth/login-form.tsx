"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { roleConfig } from "@/config/roles";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/role";
import { loginAction } from "./actions";
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
    control,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const email = useWatch({ control, name: "email" });

  const onSubmit = (values: LoginInput) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await loginAction(values);
      if (result?.error) setServerError(result.error);
    });
  };

  const fillDemo = (acc: DemoAccount) => {
    setValue("email", acc.email, { shouldValidate: true });
    setValue("password", DEMO_PASSWORD, { shouldValidate: true });
    setServerError(undefined);
  };

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {serverError && (
          <div role="alert" className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger">
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
            {serverError}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email công ty
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="ten@speego.vn"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            className="h-10"
            {...register("email")}
          />
          {errors.email && (
            <p id="email-error" className="text-sm text-danger">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Mật khẩu
          </label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
              className="h-10 pr-10"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
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

        <Button type="submit" size="lg" className="h-10 w-full text-sm" disabled={pending}>
          {pending && <Loader2 aria-hidden className="animate-spin" />}
          {pending ? "Đang đăng nhập…" : "Đăng nhập"}
        </Button>
      </form>

      <div className="mt-8 rounded-xl border bg-background p-4">
        <p className="text-sm font-medium">Tài khoản demo theo vai trò</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Chọn một vai trò để điền sẵn thông tin, sau đó bấm Đăng nhập. Chỉ để xem giao diện, không phải xác thực thật.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {accounts.map((acc) => (
            <button
              key={acc.role}
              type="button"
              onClick={() => fillDemo(acc)}
              aria-pressed={email === acc.email}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
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
    </div>
  );
}
