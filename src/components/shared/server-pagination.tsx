"use client";

import { useCallback, useEffect, useState } from "react";
import type { PageInfo } from "@speego/shared";
import { OPEN_CONTRACT_EVENT, readOpenContractFromUrl, type OpenContractDetail } from "@/features/notifications/open-contract";
import { Pagination } from "./pagination";

const initial: PageInfo = { page: 1, pages: 1, pageSize: 20, total: 0, summary: {} };

export function useServerPagination(key: string, refTypes = "") {
  const [request, setRequest] = useState({ key, page: 1, focusId: "" });
  const [loaded, setLoaded] = useState<{ key: string; info: PageInfo }>();
  const current = request.key === key ? request : { key, page: 1, focusId: "" };
  const info = loaded?.key === key ? loaded.info : initial;
  const query = `&page=${current.page}&pageSize=20${current.focusId ? `&focusId=${encodeURIComponent(current.focusId)}` : ""}`;
  const receive = useCallback((next: PageInfo) => setLoaded({ key, info: next }), [key]);
  const setPage = (page: number) => setRequest({ key, page, focusId: "" });

  useEffect(() => {
    if (!refTypes) return;
    const focus = (detail: OpenContractDetail | null) => {
      if (!detail || (detail.refType && !refTypes.split("|").includes(detail.refType))) return;
      setRequest({ key, page: 1, focusId: detail.id });
    };
    focus(readOpenContractFromUrl());
    const onOpen = (event: Event) => focus((event as CustomEvent<OpenContractDetail>).detail);
    window.addEventListener(OPEN_CONTRACT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CONTRACT_EVENT, onOpen);
  }, [key, refTypes]);

  return { ...info, query, receive, setPage };
}

export function ServerPagination({ paging, loading = false }: { paging: ReturnType<typeof useServerPagination>; loading?: boolean }) {
  return <div className="mt-4 print:hidden"><Pagination {...paging} loading={loading} onPageChange={paging.setPage} /></div>;
}
