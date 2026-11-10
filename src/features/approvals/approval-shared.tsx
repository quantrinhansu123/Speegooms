"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { leaveDayCount, type ProposalKind, type ProposalRecord, type ProposalStatus } from "@speego/shared";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDate, formatVnd } from "@/lib/format";
import { matchesQuery } from "@/lib/text";
import { cn } from "@/lib/utils";
import type { StatusTone } from "@/types/status";

export const statusMeta: Record<ProposalStatus, { label: string; tone: StatusTone }> = {
  "cho-duyet": { label: "Chờ duyệt", tone: "warning" },
  "da-duyet": { label: "Đã duyệt", tone: "success" },
  "tu-choi": { label: "Từ chối", tone: "danger" },
};

export const kindLabels: Record<ProposalKind, string> = {
  "cham-cong": "Chấm công", "di-muon-ve-som": "Đi muộn/về sớm", "thanh-toan": "Thanh toán", "nghi-phep": "Nghỉ phép", chung: "Chung",
};

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export const formatDay = (iso: string) => formatDate(iso.slice(0, 10));

export const isFinished = (p: ProposalRecord) => p.status !== "cho-duyet";

/** Đến lượt người này duyệt. */
export const isMyTurn = (p: ProposalRecord, userId: string) => p.status === "cho-duyet" && p.steps[p.currentStep]?.approverId === userId;

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const letter = name.trim().split(/\s+/).at(-1)?.[0]?.toUpperCase() ?? "?";
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-primary" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {letter}
    </span>
  );
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Các dòng thông tin riêng của từng loại đề xuất (hiện ở chi tiết). */
export function detailRows(p: Pick<ProposalRecord, "kind" | "details">): [string, string][] {
  const d = p.details;
  switch (p.kind) {
    case "cham-cong":
      return [["Ngày cần điều chỉnh", formatDay(str(d.date))], ["Giờ vào", str(d.checkIn) || "—"], ["Giờ ra", str(d.checkOut) || "—"]];
    case "di-muon-ve-som":
      return [["Ngày", formatDay(str(d.date))], ["Loại", d.type === "ve-som" ? "Về sớm" : "Đi muộn"], [d.type === "ve-som" ? "Giờ về" : "Giờ đến", str(d.time)]];
    case "thanh-toan":
      return [["Số tiền", formatVnd(Number(d.amount) || 0)], ["Người / đơn vị thụ hưởng", str(d.payee)], ["Tài khoản nhận", str(d.bankAccount) || "—"]];
    case "nghi-phep": {
      const duration = d.duration === "half" ? "half" : "full";
      return [
        ["Từ ngày", formatDay(str(d.startDate))], ["Đến ngày", formatDay(str(d.endDate))],
        ["Loại nghỉ", d.leaveType === "khong-luong" ? "Không lương" : "Phép năm"],
        ["Thời lượng", duration === "half" ? "Nửa ngày / ngày" : "Cả ngày"],
        ["Tổng số ngày", String(leaveDayCount(str(d.startDate), str(d.endDate), duration)).replace(".", ",")],
      ];
    }
    default:
      return [];
  }
}

/** Dòng tóm tắt ngắn trên thẻ danh sách. */
export function summaryChip(p: ProposalRecord): string | null {
  const d = p.details;
  if (p.kind === "thanh-toan") return formatVnd(Number(d.amount) || 0);
  if (p.kind === "nghi-phep") return `${formatDay(str(d.startDate))}${d.endDate !== d.startDate ? ` – ${formatDay(str(d.endDate))}` : ""}`;
  if (p.kind === "cham-cong" || p.kind === "di-muon-ve-som") return formatDay(str(d.date));
  return null;
}

/** Hộp chọn một người, có tìm kiếm theo tên / phòng ban / chức danh. */
export function PeopleDialog({ title, users, onPick, onClose }: {
  title: string;
  users: { id: string; name: string; department: string; title: string }[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const shown = users.filter((u) => matchesQuery(q, `${u.name} ${u.id} ${u.department} ${u.title}`));
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[80dvh] flex-col gap-3 sm:max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus aria-label="Tìm nhân sự" className="pl-9" placeholder="Tìm nhân sự..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ul className="min-h-0 flex-1 divide-y overflow-y-auto rounded-lg border">
          {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Không tìm thấy</li>}
          {shown.map((u) => (
            <li key={u.id}>
              <button type="button" className={cn("flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted")} onClick={() => onPick(u.id)}>
                <Avatar name={u.name} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{u.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[u.title, u.department].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
