"use client";

import { useEffect, useState } from "react";
import type { CrmActivity, CrmLane } from "@speego/shared";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { api, ApiError } from "@/lib/api";
import { crmPath } from "./lane";

const actionNames = { create: "Tạo", update: "Cập nhật", handover: "Bàn giao", delete: "Xóa" };

export function CrmHandoverField({ lane, value, onChange, id, potentialId, disabled, handlerName }: {
  lane: CrmLane; value: string; onChange: (id: string) => void; id: string;
  potentialId?: string; disabled?: boolean; handlerName?: string | null;
}) {
  const [sales, setSales] = useState<{ id: string; name: string }[]>([]);
  const [history, setHistory] = useState<CrmActivity[]>([]);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    const requests: Promise<void>[] = [];
    if (!disabled) requests.push(api<{ sales: { id: string; name: string }[] }>(crmPath("/api/crm/sales", lane)).then((body) => { if (active) setSales(body.sales); }));
    if (potentialId) requests.push(api<{ history: CrmActivity[] }>(crmPath(`/api/crm/potentials/${potentialId}/history`, lane)).then((body) => { if (active) setHistory(body.history); }));
    Promise.all(requests).catch((err: unknown) => { if (active) setError(err instanceof ApiError ? err.message : "Không tải được thông tin bàn giao"); });
    return () => { active = false; };
  }, [lane, potentialId, disabled]);
  return <div className="space-y-3">
    <Field label="Bàn giao Sale xử lý" htmlFor={id} hint={disabled ? "Bạn chỉ xem hồ sơ này. Người nhận tiếp tục xử lý." : "Sau khi lưu, người nhận được xử lý; người bàn giao chỉ xem. Lịch sử xử lý được giữ lại."}>
      <NativeSelect id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">{potentialId ? "Giữ người xử lý hiện tại" : "Tôi tiếp tục xử lý"}</option>
        {value && !sales.some((sale) => sale.id === value) && <option value={value}>{handlerName ?? value}</option>}
        {sales.map((sale) => <option key={sale.id} value={sale.id}>{sale.name}</option>)}
      </NativeSelect>
    </Field>
    {handlerName && <p className="text-sm text-muted-foreground">Người xử lý hiện tại: <span className="font-medium text-foreground">{handlerName}</span></p>}
    {error && <InlineAlert>{error}</InlineAlert>}
    {potentialId && <details className="rounded-lg border p-3 text-sm">
      <summary className="cursor-pointer font-medium">Lịch sử bàn giao và xử lý</summary>
      <p className="mt-2 text-xs text-muted-foreground">100 thao tác gần nhất; gồm khách tiềm năng và báo giá liên quan.</p>
      <ol className="mt-3 max-h-64 space-y-3 overflow-y-auto">
        {history.map((item) => <li key={item.id} className="border-l-2 border-border pl-3">
          <p><span className="font-medium">{item.actorName}</span> · {actionNames[item.action]} {item.entity === "quote" ? "báo giá" : item.entity === "message" ? "Mess" : "khách tiềm năng"}</p>
          {item.action === "handover" && <p className="text-muted-foreground">{item.previousHandlerName ?? item.actorName} → {item.handlerName ?? "Chưa giao"}</p>}
          <time className="text-xs text-muted-foreground" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("vi-VN")}</time>
        </li>)}
      </ol>
      {!history.length && !error && <p className="mt-2 text-muted-foreground">Chưa có lịch sử. Các thao tác trước khi bật chức năng này chưa được ghi nhận.</p>}
    </details>}
  </div>;
}
