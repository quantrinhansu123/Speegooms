"use client";

import { useCallback, useEffect, useState } from "react";
import type { CrmLane } from "@speego/shared";
import { clearOpenContractParams, OPEN_CONTRACT_EVENT, readOpenContractFromUrl, type OpenContractDetail } from "./open-contract";

const HIGHLIGHT_MS = 8000;
const GIVE_UP_MS = 10_000;

export const FOCUS_ROW_CLASS = "bg-yellow-100 ring-2 ring-inset ring-yellow-400 transition-colors";

function scrollToRow(id: string) {
  const el = document.querySelector(`[data-row-id="${CSS.escape(id)}"]`);
  el?.scrollIntoView({ block: "center", behavior: "smooth" });
  return Boolean(el);
}

/**
 * Chọn đúng tuyến, cuộn tới dòng được thông báo và tô vàng tạm thời
 * (id lấy từ `?id=` hoặc sự kiện từ chuông thông báo).
 */
export function useFocusRow(
  rows: readonly { id: string }[],
  lane: CrmLane,
  canPick: boolean,
  setLane: (lane: CrmLane) => void,
  options?: { refTypes?: string[] },
) {
  const refTypesKey = (options?.refTypes ?? ["quote"]).join("|");
  const [pending, setPending] = useState<OpenContractDetail | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const request = useCallback((detail: OpenContractDetail) => {
    setPending(detail);
    setHighlightId(null);
    if (detail.lane && canPick) setLane(detail.lane);
  }, [canPick, setLane]);

  useEffect(() => {
    const allowed = new Set(refTypesKey.split("|").filter(Boolean));
    const fromUrl = readOpenContractFromUrl();
    if (fromUrl) request(fromUrl);
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenContractDetail>).detail;
      if (!detail?.id) return;
      if (detail.refType && !allowed.has(detail.refType)) return;
      request(detail);
    };
    window.addEventListener(OPEN_CONTRACT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CONTRACT_EVENT, onOpen);
  }, [request, refTypesKey]);

  useEffect(() => {
    if (!pending) return;
    if (pending.lane && canPick && pending.lane !== lane) return;
    if (!rows.some((row) => row.id === pending.id)) return;
    setHighlightId(pending.id);
    setPending(null);
    clearOpenContractParams();
  }, [pending, rows, lane, canPick]);

  // Danh sách không có dòng đó (đã xóa / lọc mất) thì thôi, tránh chờ mãi.
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => {
      setPending(null);
      clearOpenContractParams();
    }, GIVE_UP_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);

  useEffect(() => {
    if (!highlightId) return;
    // Đợi bảng render xong rồi cuộn; thử lại vài lần nếu chưa có DOM.
    let tries = 0;
    const tick = () => {
      if (scrollToRow(highlightId) || tries >= 8) return;
      tries += 1;
      window.setTimeout(tick, 80);
    };
    const start = window.setTimeout(tick, 40);
    const clear = window.setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(clear);
    };
  }, [highlightId]);

  return highlightId;
}
