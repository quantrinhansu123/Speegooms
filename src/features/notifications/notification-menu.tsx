"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { fetchNotifications, fetchUnreadCount, markAllNotificationsRead, markNotificationRead } from "./api";
import { OPEN_CONTRACT_EVENT, type OpenContractDetail } from "./open-contract";
import type { AppNotification } from "./types";

const POLL_MS = 30_000;

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}

/** Gắn `id` / `lane` vào href để mở đúng hợp đồng (kể cả thông báo cũ chỉ lưu list path). */
function resolveHref(item: AppNotification): string {
  if (!item.href) return item.href;
  if (!item.refId) return item.href;
  try {
    const url = new URL(item.href, "http://local");
    url.searchParams.set("id", item.refId);
    if (item.lane) url.searchParams.set("lane", item.lane);
    return `${url.pathname}${url.search}`;
  } catch {
    return item.href;
  }
}

function badgeLabel(count: number): string {
  if (count <= 0) return "";
  return count > 9 ? "9+" : String(count);
}

export function NotificationMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const body = await fetchUnreadCount();
      setCount(body.count);
    } catch {
      /* giữ count cũ nếu poll lỗi */
    }
  }, []);

  const refreshList = useCallback(async () => {
    setLoading(true);
    try {
      const body = await fetchNotifications();
      setItems(body.notifications);
      setCount(body.notifications.filter((item) => !item.read).length);
    } catch {
      /* giữ list cũ */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCount();
    const timer = window.setInterval(() => {
      void refreshCount();
    }, POLL_MS);
    const onFocus = () => {
      void refreshCount();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshCount]);

  useEffect(() => {
    if (open) void refreshList();
  }, [open, refreshList]);

  const onOpenItem = async (item: AppNotification) => {
    setOpen(false);
    if (!item.read) {
      try {
        await markNotificationRead(item.id);
        setItems((current) => current.map((row) => (row.id === item.id ? { ...row, read: true } : row)));
        setCount((current) => Math.max(0, current - 1));
      } catch {
        /* vẫn điều hướng */
      }
    }
    const href = resolveHref(item);
    if (href) router.push(href);
    if ((item.refType === "contract" || item.refType === "quote") && item.refId) {
      window.dispatchEvent(
        new CustomEvent<OpenContractDetail>(OPEN_CONTRACT_EVENT, {
          detail: { id: item.refId, lane: item.lane, refType: item.refType },
        }),
      );
    }
  };

  const onMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((current) => current.map((row) => ({ ...row, read: true })));
      setCount(0);
    } catch {
      /* bỏ qua */
    }
  };

  const label = badgeLabel(count);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label="Thông báo"
        className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Bell className="size-5" />
        {label ? (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
            {label}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 sm:w-96">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <p className="text-sm font-medium">Thông báo</p>
          {count > 0 ? (
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => void onMarkAll()}>
              Đánh dấu đã đọc hết
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="max-h-80 overflow-y-auto">
          {loading && items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Đang tải…</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Chưa có thông báo.</p>
          ) : (
            items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                className={cn(
                  "cursor-pointer items-start gap-2 rounded-none px-3 py-2.5",
                  !item.read && "bg-accent/60",
                )}
                onClick={() => {
                  void onOpenItem(item);
                }}
              >
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.read ? "bg-transparent" : "bg-red-600")} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm", !item.read && "font-semibold")}>{item.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground whitespace-normal">{item.body}</span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">{formatWhen(item.createdAt)}</span>
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
