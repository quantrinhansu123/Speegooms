"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useSession } from "@/features/auth/session-provider";
import { actions, getServerSnapshot, getSnapshot, start, subscribe } from "./store";

export function useBackoffice() {
  const user = useSession();
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => start(), []);
  return { user, ready: state.status === "ready", data: state.data, actions };
}
