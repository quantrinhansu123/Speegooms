"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { fulfillmentPermissions, type FulfillmentAction } from "@/config/fulfillment";
import { useOps } from "@/features/operations/hooks";
import { bindActions } from "@/features/shared/bind-actions";
import { actions, getServerSnapshot, getSnapshot, startFulfillment, subscribe } from "./store";

/**
 * Dữ liệu Fulfillment + đọc chéo CRM/Vận hành (qua useOps) cùng thao tác đã gắn người thực hiện.
 * Mọi module dùng chung các store nên trạng thái đồng bộ: POD ghi ngược mốc giao của lô hàng.
 */
export function useFulfillment() {
  const ops = useOps();
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => startFulfillment(), []);

  const actor = useMemo(() => ({ id: ops.user.id, role: ops.user.role }), [ops.user.id, ops.user.role]);
  const bound = useMemo(() => bindActions(actions, actor), [actor]);

  return {
    ...ops,
    ready: ops.ready && state.status === "ready",
    wh: state.data,
    whActions: bound,
    canWh: (a: FulfillmentAction = "wh.write") => fulfillmentPermissions[a].includes(ops.user.role),
  };
}
