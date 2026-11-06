"use client";

import { useEffect, useRef } from "react";

export const LIST_POLL_MS = 30_000;
/** Quay lại tab chỉ tải lại khi lần tải gần nhất đã cũ hơn mức này, tránh tải dồn khi tab ẩn/hiện liên tục. */
const RETURN_REFRESH_MIN_MS = 10_000;

/**
 * Tải lại dữ liệu định kỳ (mặc định 30 giây) khi tab đang hiển thị, để thấy thay đổi của người khác mà không cần F5.
 * Tab ẩn thì dừng poll; quay lại tab thì tải lại ngay nếu dữ liệu đã cũ.
 */
export function usePolling(refresh: () => void, intervalMs = LIST_POLL_MS) {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  }, [refresh]);

  useEffect(() => {
    let timer: number | undefined;
    let lastRun = Date.now();
    const run = () => {
      lastRun = Date.now();
      latest.current();
    };
    const start = () => {
      if (timer === undefined) timer = window.setInterval(run, intervalMs);
    };
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (Date.now() - lastRun >= RETURN_REFRESH_MIN_MS) run();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
}
