"use client";

import { useState } from "react";
import type { QuoteDesk } from "@speego/shared";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session-provider";
import { QuoteDeskView } from "@/features/crm/live/quotes-view";

export function OperationsReport() {
  const user = useSession();
  const [desk, setDesk] = useState<QuoteDesk>(user.role === "sourcing" ? "sourcing" : "logistics");
  return <>
    {user.role !== "sourcing" && <nav aria-label="Bộ phận báo cáo" className="mb-4 flex gap-2">
      {(["logistics", "sourcing"] as const).map(value => <Button key={value} variant={desk === value ? "default" : "outline"} onClick={() => setDesk(value)}>{value === "logistics" ? "Logistics" : "Sourcing"}</Button>)}
    </nav>}
    <QuoteDeskView key={desk} desk={desk} report />
  </>;
}
