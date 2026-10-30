"use client";

import { useEffect, useRef } from "react";

const NOTIFICATIONS_CHANGED_EVENT = "speego:notifications-changed";

/** Chuông gọi khi số thông báo chưa đọc tăng giữa hai lần poll. */
export function dispatchNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

/** Tải lại dữ liệu trang khi có thông báo mới, không cần F5. */
export function useNotificationRefresh(refresh: () => void) {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const onChanged = () => latest.current();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
  }, []);
}
