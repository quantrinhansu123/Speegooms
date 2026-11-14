"use client";

import { useId, useState, type FormEvent } from "react";
import { changePasswordSchema } from "@speego/shared";
import { Field, InlineAlert } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { useSession } from "./session-provider";

export function ChangePasswordForm() {
  const user = useSession();
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(undefined);
    const data = new FormData(event.currentTarget);
    const parsed = changePasswordSchema.safeParse(Object.fromEntries(data));
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    if (parsed.data.newPassword !== data.get("confirmPassword")) return setError("Mật khẩu nhập lại không khớp");
    setPending(true);
    try {
      await api("/api/auth/password", { method: "POST", body: JSON.stringify(parsed.data) });
      // Tải lại toàn trang để xóa dữ liệu và cache của phiên đăng nhập cũ.
      window.location.assign(new URL("/login?passwordChanged=1", window.location.origin).href);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không đổi được mật khẩu. Vui lòng thử lại.");
      setPending(false);
    }
  }

  return <SectionCard title="Đổi mật khẩu" description="Mật khẩu mới có 8–128 ký tự. Đổi thành công sẽ đăng xuất tất cả phiên; hãy đăng nhập lại.">
    <p className="mb-4 text-sm">{user.name} · {user.email}</p>
    <form onSubmit={submit} className="max-w-md space-y-4">
      {error && <InlineAlert>{error}</InlineAlert>}
      <Field label="Mật khẩu hiện tại" htmlFor={`${id}-current-password`} required>
        <Input id={`${id}-current-password`} name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} />
      </Field>
      <Field label="Mật khẩu mới" htmlFor={`${id}-new-password`} required>
        <Input id={`${id}-new-password`} name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
      </Field>
      <Field label="Nhập lại mật khẩu mới" htmlFor={`${id}-confirm-password`} required>
        <Input id={`${id}-confirm-password`} name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Đang đổi…" : "Đổi mật khẩu"}</Button>
    </form>
  </SectionCard>;
}
