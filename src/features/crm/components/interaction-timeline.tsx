"use client";

import { useState } from "react";
import { MessageSquare, Phone, Settings2, StickyNote, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { formatDate } from "@/lib/format";
import type { InteractionType } from "@/types/crm";
import { useCrm } from "../hooks";

const typeMeta: Record<InteractionType, { label: string; icon: LucideIcon }> = {
  call: { label: "Cuộc gọi", icon: Phone },
  message: { label: "Tin nhắn", icon: MessageSquare },
  note: { label: "Ghi chú", icon: StickyNote },
  system: { label: "Hệ thống", icon: Settings2 },
};

export function InteractionTimeline({ messId }: { messId: string }) {
  const { all, actions, can, staffName } = useCrm();
  const [type, setType] = useState<InteractionType>("note");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string>();

  const items = all.interactions.filter((i) => i.messId === messId).sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));

  const submit = () => {
    const res = actions.addInteraction(messId, type, content);
    if (res.ok) {
      setContent("");
      setError(undefined);
    } else setError(res.error);
  };

  return (
    <SectionCard title="Lịch sử tương tác" description="Ghi chú, cuộc gọi, tin nhắn và thay đổi hệ thống của lead này">
      {can("lead.write") && (
        <div className="mb-5 space-y-2 rounded-lg border bg-background p-3">
          <div className="flex gap-2">
            <NativeSelect aria-label="Loại tương tác" className="w-36" value={type} onChange={(e) => setType(e.target.value as InteractionType)}>
              <option value="note">Ghi chú</option>
              <option value="call">Cuộc gọi</option>
              <option value="message">Tin nhắn</option>
            </NativeSelect>
          </div>
          <Textarea aria-label="Nội dung tương tác" rows={2} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Nội dung trao đổi với khách…" />
          {error && <InlineAlert>{error}</InlineAlert>}
          <div className="flex justify-end">
            <Button onClick={submit}>Thêm</Button>
          </div>
        </div>
      )}
      {items.length === 0 ? (
        <EmptyState title="Chưa có tương tác" className="py-8" />
      ) : (
        <ol className="relative space-y-4 border-l pl-5">
          {items.map((i) => {
            const { icon: Icon, label } = typeMeta[i.type];
            return (
              <li key={i.id} className="relative">
                <span aria-hidden className="absolute -left-[1.85rem] flex size-6 items-center justify-center rounded-full border bg-surface text-muted-foreground">
                  <Icon className="size-3.5" />
                </span>
                <p className="text-sm">{i.content}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {label} · {staffName(i.by)} · {formatDate(i.at.slice(0, 10))} {i.at.slice(11)}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}
