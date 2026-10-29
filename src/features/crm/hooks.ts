"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { crmPermissions, roleRouteScope, type CrmAction } from "@/config/crm";
import { useSession } from "@/features/auth/session-provider";
import { routeFromOrigin } from "@/services/crm/rules";
import type { RouteCode } from "@/types/crm";
import { actions, getServerSnapshot, getSnapshot, startCrm, subscribe, type Actor } from "./store";

type Bind<T> = {
  [K in keyof T]: T[K] extends (actor: Actor, ...rest: infer R) => infer O ? (...rest: R) => O : never;
};

/**
 * Điểm vào duy nhất cho màn hình CRM: dữ liệu (đã lọc theo tuyến của vai trò),
 * các thao tác đã gắn người thực hiện, và kiểm tra quyền.
 */
export function useCrm(route?: RouteCode) {
  const user = useSession();
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => startCrm(), []);

  const actor = useMemo<Actor>(() => ({ id: user.id, role: user.role }), [user.id, user.role]);
  const bound = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(actions).map(([name, fn]) => [name, (...args: unknown[]) => (fn as (...a: unknown[]) => unknown)(actor, ...args)]),
      ) as Bind<typeof actions>,
    [actor],
  );

  const scope = roleRouteScope[user.role] ?? route ?? null;
  const { data } = state;
  const scoped = useMemo(() => {
    if (!scope) return data;
    return {
      ...data,
      leads: data.leads.filter((l) => routeFromOrigin(l.goodsOrigin) === scope),
      customers: data.customers.filter((c) => c.route === scope),
      rfqs: data.rfqs.filter((r) => r.route === scope),
      quotations: data.quotations.filter((q) => data.rfqs.find((r) => r.rfqId === q.rfqId)?.route === scope),
      contracts: data.contracts.filter((c) => c.route === scope),
    };
  }, [data, scope]);

  const staffName = useMemo(() => {
    const map = new Map(data.staff.map((s) => [s.id, s.name]));
    return (id: string) => (id === "system" ? "Hệ thống" : (map.get(id) ?? id));
  }, [data.staff]);

  return {
    ready: state.status === "ready",
    error: state.error,
    /** Toàn bộ dữ liệu, dùng khi cần tra cứu chéo (ví dụ tên khách của hợp đồng) */
    all: data,
    /** Dữ liệu trong phạm vi tuyến của vai trò hiện tại */
    data: scoped,
    scope,
    user,
    actions: bound,
    can: (action: CrmAction) => crmPermissions[action].includes(user.role),
    staffName,
  };
}

/** Phân trang phía client: tự kẹp trang khi danh sách ngắn lại. */
export function usePagination<T>(items: T[], pageSize = 15, resetKey = "") {
  const [requested, setRequested] = useState({ page: 1, key: resetKey });
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(requested.key === resetKey ? requested.page : 1, pages);
  return {
    page,
    pages,
    setPage: (page: number) => setRequested({ page, key: resetKey }),
    total: items.length,
    pageSize,
    slice: items.slice((page - 1) * pageSize, page * pageSize),
  };
}
