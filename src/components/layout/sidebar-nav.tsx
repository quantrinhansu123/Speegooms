"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { navigationForRole } from "@/config/roles";
import { isImplemented } from "@/config/modules";
import { useSession } from "@/features/auth/session-provider";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/types/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

function NavEntry({ item, onNavigate, horizontal = false }: { item: NavItem; onNavigate?: () => void; horizontal?: boolean }) {
  const pathname = usePathname() ?? "";
  const active = item.children
    ? pathname === item.href || item.children.some((child) => isActive(pathname, child.href))
    : isActive(pathname, item.href);
  const [expansion, setExpansion] = useState<{ pathname: string; open: boolean }>();
  const open = expansion?.pathname === pathname ? expansion.open : active;
  const submenuId = useId();
  const Icon = item.icon;
  const tag = item.tag ?? (!isImplemented(item.href) && !item.children?.some((c) => isImplemented(c.href)) ? "Chưa triển khai" : undefined);
  const base =
    "relative flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors";
  const tone = active
    ? "bg-sidebar-accent text-sidebar-accent-foreground"
    : "text-sidebar-foreground hover:bg-muted";

  const indicator = active && (
    <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-brand-orange" />
  );

  if (horizontal && item.children) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(base, tone)}>
          {indicator}
          <Icon aria-hidden className="size-4 shrink-0" />
          <span>{item.title}</span>
          {tag && <span className="text-xs text-warning">{tag}</span>}
          <ChevronDown aria-hidden className="size-4 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64">
          {item.children.map((child) => (
            <DropdownMenuItem key={child.href} render={<Link href={child.href} />} onClick={onNavigate} aria-current={pathname === child.href ? "page" : undefined} className={cn(pathname === child.href && "bg-sidebar-accent font-semibold text-sidebar-accent-foreground")}>
              {child.title}{!isImplemented(child.href) && <span className="text-xs text-warning">· Chưa triển khai</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

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
          {tag && (
            <span className="mt-0.5 inline-block rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
              {tag}
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
        aria-controls={submenuId}
        onClick={() => setExpansion({ pathname, open: !open })}
        className={cn(base, tone)}
      >
        {indicator}
        <Icon aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 text-left"><span className="block truncate">{item.title}</span>{tag && <span className="block text-xs text-warning">{tag}</span>}</span>
        <ChevronDown
          aria-hidden
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <ul id={submenuId} className="ml-[1.45rem] mt-0.5 space-y-0.5 border-l border-sidebar-border pl-2">
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
                  {child.title}{!isImplemented(child.href) && <span className="ml-1 text-xs text-warning">· Chưa triển khai</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function SidebarNav({ onNavigate, horizontal = false }: { onNavigate?: () => void; horizontal?: boolean }) {
  const { role } = useSession();
  return (
    <nav aria-label="Điều hướng chính" className={horizontal ? "flex max-h-[30dvh] flex-wrap gap-x-4 gap-y-2 overflow-y-auto px-4 py-2" : "sidebar-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4"}>
      {navigationForRole(role).map((group) => (
        <div key={group.label} className={horizontal ? "flex flex-wrap items-center gap-1" : undefined}>
          <p className={horizontal ? "px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground" : "px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"}>
            {group.label}
          </p>
          <div className={horizontal ? "flex flex-wrap items-center gap-1" : "space-y-0.5"}>
            {group.items.map((item) => (
              <div key={item.href} className={horizontal ? "shrink-0" : undefined}><NavEntry item={item} onNavigate={onNavigate} horizontal={horizontal} /></div>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
