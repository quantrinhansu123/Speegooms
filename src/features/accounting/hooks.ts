"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { accountingPermissions, type AccountingAction } from "@/config/accounting";
import { useOps } from "@/features/operations/hooks";
import { bindActions } from "@/features/shared/bind-actions";
import { actions, getServerSnapshot, getSnapshot, startAccounting, subscribe } from "./store";

/**
 * Dữ liệu Kế toán + đọc chéo CRM/Vận hành (qua useOps). Xác nhận cọc dùng thao tác của CRM (ops.crmActions),
 * nên Kế toán, Vận hành, Sale cùng nhìn một trạng thái cọc.
 */
export function useAccounting() {
  const ops = useOps();
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => startAccounting(), []);

  const actor = useMemo(() => ({ id: ops.user.id, role: ops.user.role }), [ops.user.id, ops.user.role]);
  const bound = useMemo(() => bindActions(actions, actor), [actor]);

  return {
    ...ops,
    ready: ops.ready && state.status === "ready",
    acc: state.data,
    accActions: bound,
    actor,
    canAcc: (a: AccountingAction) => accountingPermissions[a].includes(ops.user.role),
  };
}
