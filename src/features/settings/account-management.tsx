"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createUserSchema, updateUserSchema, type PublicUser } from "@speego/shared";
import { useSession } from "@/features/auth/session-provider";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { roleConfig } from "@/config/roles";
import { ApiError, api } from "@/lib/api";

export function AccountManagement() {
  const me = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const [editing, setEditing] = useState<PublicUser | "new">();
  const [deleting, setDeleting] = useState<PublicUser>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api<{ users: PublicUser[] }>("/api/users", { signal: controller.signal })
      .then((body) => { if (!controller.signal.aborted) setUsers(body.users); })
      .catch((err: unknown) => { if (!controller.signal.aborted) setError(err instanceof ApiError ? err.message : "Không tải được danh sách tài khoản. Vui lòng tải lại trang."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function remove(account: PublicUser) {
    if (pending) return;
    setPending(true);
    setError(undefined);
    setSaved(undefined);
    try {
      await api(`/api/users/${account.id}`, { method: "DELETE" });
      setUsers((rows) => rows.filter((row) => row.id !== account.id));
      setSaved(`Đã xóa tài khoản ${account.name}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không xóa được tài khoản");
    } finally {
      setPending(false);
    }
  }

  return <SectionCard className="mt-6" title="Quản lý tài khoản" description="Admin tạo tài khoản, sửa thông tin và vai trò, hoặc xóa tài khoản. Không tự xóa hoặc đổi vai trò của chính mình.">
    {error && <InlineAlert className="mb-4">{error}</InlineAlert>}
    {saved && <InlineAlert tone="success" className="mb-4">{saved}</InlineAlert>}
    <Button className="mb-4" disabled={pending || loading} onClick={() => setEditing("new")}>Tạo tài khoản</Button>
    {loading ? <p role="status">Đang tải tài khoản…</p> : <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b text-left text-muted-foreground">
          <th className="py-2 pr-3 font-medium">Tài khoản</th>
          <th className="py-2 pr-3 font-medium">Vai trò</th>
          <th className="py-2 pr-3 font-medium">Phòng ban / Chức danh</th>
          <th className="py-2 font-medium">Thao tác</th>
        </tr></thead>
        <tbody>{users.map((account) => <tr key={account.id} className="border-b last:border-0">
          <td className="py-3 pr-3"><p className="font-medium">{account.name}</p><p className="text-xs text-muted-foreground">{account.email}</p></td>
          <td className="py-3 pr-3">{roleConfig[account.role].label}</td>
          <td className="py-3 pr-3"><p>{account.department}</p><p className="text-xs text-muted-foreground">{account.title}</p></td>
          <td className="py-3"><div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pending} aria-label={`Sửa tài khoản ${account.name}`} onClick={() => setEditing(account)}>Sửa</Button>
            <Button variant="destructive" size="sm" disabled={pending || account.id === me.id} aria-label={`Xóa tài khoản ${account.name}`} onClick={() => setDeleting(account)}>Xóa</Button>
          </div></td>
        </tr>)}</tbody>
      </table>
      {!users.length && !error && <p className="py-4 text-muted-foreground">Chưa có tài khoản.</p>}
    </div>}
    <Dialog open={editing !== undefined} onOpenChange={(open) => { if (!open && !pending) setEditing(undefined); }}>
      <DialogContent showCloseButton={!pending} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing === "new" ? "Tạo tài khoản" : "Sửa tài khoản"}</DialogTitle>
          <DialogDescription>Nhập thông tin tài khoản và vai trò truy cập.</DialogDescription>
        </DialogHeader>
        {editing && <AccountForm key={editing === "new" ? "new" : editing.id} account={editing === "new" ? undefined : editing} pending={pending} setPending={setPending} onCancel={() => setEditing(undefined)} onSaved={(user) => {
          setUsers((rows) => editing === "new" ? [...rows, user] : rows.map((row) => row.id === user.id ? user : row));
          setSaved(`Đã ${editing === "new" ? "tạo" : "cập nhật"} tài khoản ${user.name}`);
          setError(undefined);
          setEditing(undefined);
          if (user.id === me.id) router.refresh();
        }} />}
      </DialogContent>
    </Dialog>
    <ConfirmDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(undefined); }} destructive title={`Xóa tài khoản ${deleting?.name ?? ""}?`}
      description="Tài khoản sẽ mất quyền đăng nhập. Đề xuất do tài khoản tạo, góp ý đề xuất, thông báo và cấu hình chia đơn/data lạnh của tài khoản cũng bị xóa. Không thể hoàn tác."
      confirmLabel="Xóa tài khoản" onConfirm={() => { if (deleting) void remove(deleting); }} />
  </SectionCard>;
}

function AccountForm({ account, pending, setPending, onSaved, onCancel }: {
  account?: PublicUser; pending: boolean; setPending: (value: boolean) => void;
  onSaved: (user: PublicUser) => void; onCancel: () => void;
}) {
  const me = useSession();
  const [error, setError] = useState<string>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(undefined);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (account?.id === me.id) values.role = account.role;
    const parsed = (account ? updateUserSchema : createUserSchema).safeParse(values);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setPending(true);
    try {
      const body = await api<{ user: PublicUser }>(account ? `/api/users/${account.id}` : "/api/users", {
        method: account ? "PATCH" : "POST", body: JSON.stringify(parsed.data),
      });
      onSaved(body.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không lưu được tài khoản");
    } finally {
      setPending(false);
    }
  }
  return <form onSubmit={submit} className="space-y-4">
    {error && <InlineAlert>{error}</InlineAlert>}
    <fieldset disabled={pending} className="space-y-4">
      <Field label="Họ tên" htmlFor="account-name" required><Input id="account-name" name="name" defaultValue={account?.name} required maxLength={120} /></Field>
      <Field label="Email" htmlFor="account-email" required><Input id="account-email" name="email" type="email" autoComplete="off" defaultValue={account?.email} required maxLength={254} /></Field>
      <Field label="Vai trò" htmlFor="account-role" required><NativeSelect id="account-role" name="role" defaultValue={account?.role ?? "sale-vn"} disabled={account?.id === me.id}>
        {Object.entries(roleConfig).map(([role, config]) => <option key={role} value={role}>{config.label}</option>)}
      </NativeSelect></Field>
      <Field label="Phòng ban" htmlFor="account-department" required><Input id="account-department" name="department" defaultValue={account?.department} required maxLength={120} /></Field>
      <Field label="Chức danh" htmlFor="account-title" required><Input id="account-title" name="title" defaultValue={account?.title} required maxLength={120} /></Field>
      {!account && <Field label="Mật khẩu ban đầu" htmlFor="account-password" hint="8–128 ký tự. Người dùng có thể tự đổi sau khi đăng nhập." required><Input id="account-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} /></Field>}
    </fieldset>
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={pending} onClick={onCancel}>Hủy</Button><Button type="submit" disabled={pending}>{pending ? "Đang lưu…" : "Lưu tài khoản"}</Button></div>
  </form>;
}
