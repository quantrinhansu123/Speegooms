"use client";

import { useState } from "react";
import type { CrmLane } from "@speego/shared";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session-provider";

export function crmPath(path: string, lane: CrmLane): string {
  return `${path}${path.includes("?") ? "&" : "?"}lane=${lane}`;
}

export function useCrmLane(fixed?: CrmLane) {
  const user = useSession();
  const roleLane = user.role === "sale-vn" ? "vn" : user.role === "sale-global" ? "global" : null;
  const locked = fixed ?? roleLane;
  const [picked, setPicked] = useState<CrmLane>(locked ?? "vn");
  return { lane: locked ?? picked, canPick: locked == null, setLane: setPicked };
}

export function LaneSwitch({ lane, onChange }: { lane: CrmLane; onChange: (lane: CrmLane) => void }) {
  const options = [
    ["vn", "Việt Nam"],
    ["global", "Global"],
  ] as const;
  return (
    <div className="flex rounded-lg border p-0.5">
      {options.map(([value, label]) => (
        <Button key={value} type="button" size="sm" variant={lane === value ? "default" : "ghost"} onClick={() => onChange(value)}>
          {label}
        </Button>
      ))}
    </div>
  );
}
