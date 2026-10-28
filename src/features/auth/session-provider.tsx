"use client";

import { createContext, useContext } from "react";
import type { CurrentUser } from "@/types/user";

const SessionContext = createContext<CurrentUser | null>(null);

export function SessionProvider({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSession(): CurrentUser {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useSession phải nằm trong SessionProvider");
  return user;
}
