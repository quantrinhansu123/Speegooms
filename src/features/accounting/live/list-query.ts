"use client";

import { useCallback, useEffect, useState } from "react";
import { dateRangeError } from "@/features/crm/live/list-search-bar";
import { ApiError, api } from "@/lib/api";
import type { PageInfo } from "@speego/shared";
import { useServerPagination } from "@/components/shared/server-pagination";

/** Chuỗi query `?a=b&c=d` từ bộ lọc đã áp dụng. Bỏ giá trị rỗng. */
export function listQuery(filters: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    const text = value.trim();
    if (text) params.set(key, text);
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

type Loaded<T> = { url: string; version: number; rows: T[]; error?: string };

/**
 * Tải danh sách từ API theo bộ lọc đã áp dụng (có `from`/`to`). `field` là khóa mảng trong phản hồi.
 * Gọi `reload()` sau khi tạo mới để tải lại.
 */
export function useListData<T>(path: string, field: string, filters: Record<string, string>, failure: string, paged = false, enabled = true) {
  const paging = useServerPagination(path + JSON.stringify(filters));
  const { receive } = paging;
  const rangeError = dateRangeError(filters.from ?? "", filters.to ?? "");
  const query = listQuery(filters);
  const filteredPath = `${path}${path.includes("?") ? query.replace(/^\?/, "&") : query}`;
  const url = rangeError || !enabled ? null : `${filteredPath}${paged ? `${filteredPath.includes("?") ? "" : "?"}${paging.query.slice(filteredPath.includes("?") ? 0 : 1)}` : ""}`;
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);

  useEffect(() => {
    if (url === null) return;
    let cancelled = false;
    api<Record<string, T[]> & { pagination?: PageInfo }>(url)
      .then((body) => {
        if (!cancelled) {
          setLoaded({ url, version, rows: body[field] ?? [] });
          if (body.pagination) receive(body.pagination);
        }
      })
      .catch((cause) => {
        if (!cancelled) setLoaded({ url, version, rows: [], error: cause instanceof ApiError ? cause.message : failure });
      });
    return () => {
      cancelled = true;
    };
  }, [url, version, field, failure, receive]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  const current = url !== null && loaded?.url === url && loaded.version === version;
  return {
    rows: current ? loaded.rows : ([] as T[]),
    loading: url !== null && !current,
    error: rangeError ?? (current ? loaded.error : undefined),
    reload,
    paging,
  };
}
