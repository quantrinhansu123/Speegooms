"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session-provider";
import { NotificationMenu } from "@/features/notifications/notification-menu";
import { Breadcrumbs } from "./breadcrumbs";
import { UserMenu } from "./user-menu";

export function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
  const user = useSession();
  return (
    <header className="z-20 flex h-16 w-full shrink-0 items-center gap-3 border-b bg-surface pl-4 pr-2 lg:pl-8">
      <Button variant="ghost" size="icon-lg" className="lg:hidden" aria-label="Mở menu" onClick={onOpenMenu}>
        <Menu />
      </Button>
      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>
      <NotificationMenu />
      <UserMenu user={user} />
    </header>
  );
}
