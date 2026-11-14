"use client";

import { useCallback, useEffect, useState } from "react";
import type { CrmLane } from "@speego/shared";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session-provider";

export function crmPath(path: string, lane: CrmLane): string {
  return `${path}${path.includes("?") ? "&" : "?"}lane=${lane}`;
}

export function useCrmLane(fixed?: CrmLane) {
  const user = useSession();
  const roleLane = user.role === "sale-vn" ? "vn" : (user.role === "sale-global" || user.role === "sale-global-lead") ? "global" : null;
  const locked = fixed ?? roleLane;
  const [picked, setPicked] = useState<CrmLane>(locked ?? "vn");
  const storageKey = `speego:crm-lane:${user.id}`;
  const setLane = useCallback((lane: CrmLane) => {
    if (locked) return;
    setPicked(lane);
    try {
      window.sessionStorage.setItem(storageKey, lane);
    } catch { /* Vẫn đổi tuyến khi trình duyệt chặn lưu trữ. */ }
  }, [locked, storageKey]);

  useEffect(() => {
    if (locked) return;
    let lane = new URLSearchParams(window.location.search).get("lane");
    if (lane !== "vn" && lane !== "global") {
      try {
        lane = window.sessionStorage.getItem(storageKey);
      } catch { /* Dùng tuyến mặc định khi trình duyệt chặn lưu trữ. */ }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Read browser-only preferences after hydration to keep server and initial client markup identical.
    setLane(lane === "vn" || lane === "global" ? lane : "vn");
  }, [locked, setLane, storageKey]);

  return { lane: locked ?? picked, canPick: locked == null, setLane };
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
