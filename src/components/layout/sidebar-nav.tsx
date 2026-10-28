"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { navigationForRole } from "@/config/roles";
import { useSession } from "@/features/auth/session-provider";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/types/navigation";

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

function NavEntry({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const [open, setOpen] = useState(active);
  const Icon = item.icon;
  const base =
    "relative flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors";
  const tone = active
    ? "bg-sidebar-accent text-sidebar-accent-foreground"
    : "text-sidebar-foreground hover:bg-muted";

  const indicator = active && (
    <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-brand-orange" />
  );

  if (!item.children) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={pathname === item.href ? "page" : undefined}
        className={cn(base, tone)}
      >
        {indicator}
        <Icon aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{item.title}</span>
          {item.tag && (
            <span className="mt-0.5 inline-block rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
              {item.tag}
            </span>
          )}
        </span>
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(base, tone)}
      >
        {indicator}
        <Icon aria-hidden className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">{item.title}</span>
        <ChevronDown
          aria-hidden
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <ul className="ml-[1.45rem] mt-0.5 space-y-0.5 border-l border-sidebar-border pl-2">
          {item.children.map((child) => {
            const current = pathname === child.href;
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  onClick={onNavigate}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-3 py-1.5 text-sm transition-colors",
                    current
                      ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {child.title}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { role } = useSession();
  return (
    <nav aria-label="Điều hướng chính" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {navigationForRole(role).map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavEntry key={item.href} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
