"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session-provider";
import { Breadcrumbs } from "./breadcrumbs";
import { UserMenu } from "./user-menu";

export function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
  const user = useSession();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-surface px-4 lg:px-8">
      <Button variant="ghost" size="icon-lg" className="lg:hidden" aria-label="Mở menu" onClick={onOpenMenu}>
        <Menu />
      </Button>
      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>
      <UserMenu user={user} />
    </header>
  );
}
