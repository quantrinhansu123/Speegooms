"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { CRM_TODAY } from "@/config/crm";
import { opsPermissions, type OpsAction } from "@/config/operations";
import { useCrm } from "@/features/crm/hooks";
import users from "@/mocks/users.json";
import { buildOrderViews } from "@/services/ops/rules";
import { actions, getServerSnapshot, getSnapshot, startOps, subscribe, type Actor } from "./store";

type Bind<T> = {
  [K in keyof T]: T[K] extends (actor: Actor, ...rest: infer R) => infer O ? (...rest: R) => O : T[K];
};

/**
 * Điểm vào cho màn hình Vận hành: dữ liệu Vận hành + dữ liệu CRM (đọc), danh sách đơn đã dựng
 * (giai đoạn, cảnh báo), thao tác đã gắn người thực hiện và kiểm tra quyền.
 */
export function useOps() {
  const crm = useCrm();
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => startOps(), []);

  const ready = crm.ready && state.status === "ready";
  // Nhận RFQ mới gửi yêu cầu giá cho Sourcing
  useEffect(() => {
    if (ready) actions.syncRequests();
  }, [ready, crm.all.rfqs]);

  const actor = useMemo<Actor>(() => ({ id: crm.user.id, role: crm.user.role }), [crm.user.id, crm.user.role]);
  const bound = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(actions).map(([name, fn]) => [name, name === "syncRequests" ? fn : (...args: unknown[]) => (fn as (...a: unknown[]) => unknown)(actor, ...args)]),
      ) as Bind<typeof actions>,
    [actor],
  );

  const ops = state.data;
  const orders = useMemo(() => (ready ? buildOrderViews(crm.all, ops, CRM_TODAY) : []), [ready, crm.all, ops]);

  const staffName = useMemo(() => {
    const map = new Map([...users, ...crm.all.staff, ...ops.staff].map((s) => [s.id, s.name]));
    return (id: string) => (!id ? "Chưa phân công" : id === "system" ? "Hệ thống" : (map.get(id) ?? id));
  }, [crm.all.staff, ops.staff]);

  return {
    ready,
    error: crm.error ?? state.error,
    ops,
    crm: crm.all,
    orders,
    user: crm.user,
    actions: bound,
    /** Thao tác của CRM (ví dụ xác nhận cọc, chỉ Kế toán) để các module dùng chung một trạng thái */
    crmActions: crm.actions,
    can: (a: OpsAction = "ops.write") => opsPermissions[a].includes(crm.user.role),
    staffName,
    today: CRM_TODAY,
  };
}
