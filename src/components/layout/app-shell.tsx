"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { RouteGate } from "@/components/shared/route-gate";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="fixed inset-0 overflow-clip">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Bỏ qua điều hướng
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border lg:block">
        <Sidebar />
      </aside>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Điều hướng</SheetTitle>
          <SheetDescription className="sr-only">Menu các phòng ban SpeeGo</SheetDescription>
          <Sidebar onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex h-dvh w-full min-w-0 flex-col lg:pl-64">
        <Header onOpenMenu={() => setMenuOpen(true)} />
        <main id="main" tabIndex={-1} className="workspace-scroll min-h-0 w-full min-w-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-8">
          <RouteGate>{children}</RouteGate>
        </main>
      </div>
    </div>
  );
}
