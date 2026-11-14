"use client";

import { useEffect, useState } from "react";
import type { DataLanhRecipient, PublicUser } from "@speego/shared";
import { InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";

export function DataLanhRecipients() {
  const [recipients, setRecipients] = useState<DataLanhRecipient[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ recipients: DataLanhRecipient[] }>("/api/data-lanh/recipients"),
      api<{ users: PublicUser[] }>("/api/users"),
    ]).then(([pool, accounts]) => {
      if (active) { setRecipients(pool.recipients); setUsers(accounts.users); }
    }).catch((err: unknown) => {
      if (active) setError(err instanceof ApiError ? err.message : "Không tải được danh sách người nhận");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const change = async (userId: string, action: "add" | "remove") => {
    setPending(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await api<{ assigned: number; interns: number }>("/api/data-lanh/recipients", {
        method: action === "add" ? "POST" : "DELETE", body: JSON.stringify({ userId }),
      });
      setNotice(`Đã ${action === "add" ? "thêm người vào" : "bỏ người khỏi"} vòng. Đã chia lại ${result.assigned} khách chưa xử lý cho ${result.interns} người.`);
      setSelected("");
      const pool = await api<{ recipients: DataLanhRecipient[] }>("/api/data-lanh/recipients");
      setRecipients(pool.recipients);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không cập nhật được danh sách. Tải lại để kiểm tra trước khi thử lại.");
    } finally { setPending(false); }
  };

  const candidates = users.filter(u => ["sale-vn", "sale-global", "sale-intern"].includes(u.role) && !recipients.some(r => r.id === u.id));
  return <SectionCard className="mt-6" title="Người nhận data khách hàng"
    description="Dùng chung cho Việt Nam và Global. Thêm hoặc bỏ người sẽ tự chia đều lại khách chưa có kết quả Facebook/Telesale và chưa bàn giao. Khách đã xử lý giữ nguyên người phụ trách.">
    {error && <InlineAlert className="mb-4">{error}</InlineAlert>}
    {notice && <InlineAlert tone="success" className="mb-4">{notice}</InlineAlert>}
    {loading ? <p className="text-sm text-muted-foreground">Đang tải danh sách…</p> : <>
      <ol className="divide-y">
        {recipients.map((person, index) => <li key={person.id} className="flex items-center justify-between gap-3 py-3">
          <div><p className="text-sm font-medium">{index + 1}. {person.name}</p><p className="text-xs text-muted-foreground">{person.email}</p></div>
          <Button variant="outline" disabled={pending || recipients.length === 1} aria-label={`Bỏ ${person.name} khỏi vòng`} onClick={() => void change(person.id, "remove")}>Bỏ khỏi vòng</Button>
        </li>)}
      </ol>
      {!recipients.length && <p className="mb-3 text-sm text-muted-foreground">Chưa có người nhận data.</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <NativeSelect aria-label="Tài khoản Sale nhận data" value={selected} disabled={pending} onChange={e => setSelected(e.target.value)}>
          <option value="">Chọn tài khoản Sale</option>
          {candidates.map(person => <option key={person.id} value={person.id}>{person.name} — {person.email}</option>)}
        </NativeSelect>
        <Button disabled={pending || !selected} onClick={() => void change(selected, "add")}>{pending ? "Đang cập nhật…" : "Thêm người"}</Button>
      </div>
      {recipients.length === 1 && <p className="mt-3 text-xs text-muted-foreground">Cần giữ ít nhất một người trong vòng nhận data.</p>}
    </>}
  </SectionCard>;
}
