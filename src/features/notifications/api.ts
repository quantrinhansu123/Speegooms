import { api } from "@/lib/api";
import type { AppNotification } from "./types";

export function fetchNotifications() {
  return api<{ notifications: AppNotification[] }>("/api/notifications");
}

export function fetchUnreadCount() {
  return api<{ count: number }>("/api/notifications/unread-count");
}

export function markNotificationRead(id: string) {
  return api<void>(`/api/notifications/${id}/read`, { method: "POST" });
}

export function markAllNotificationsRead() {
  return api<{ updated: number }>("/api/notifications/read-all", { method: "POST" });
}
