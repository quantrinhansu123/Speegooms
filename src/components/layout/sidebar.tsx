import Image from "next/image";
import Link from "next/link";
import { SidebarNav } from "./sidebar-nav";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="speego-sidebar flex h-full flex-col bg-sidebar">
      <Link
        href="/dashboard"
        aria-label="SpeeGo Logistics – Trang chủ"
        className="flex h-16 shrink-0 items-center justify-center border-b border-sidebar-border px-5"
      >
        <Image src="/logo.png" alt="SpeeGo Logistics" width={150} height={45} priority className="h-11 w-auto" />
      </Link>
      <SidebarNav onNavigate={onNavigate} />
    </div>
  );
}
