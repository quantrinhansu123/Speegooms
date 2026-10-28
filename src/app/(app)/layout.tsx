import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SessionProvider } from "@/features/auth/session-provider";
import { getSession } from "@/lib/session";

async function SessionShell({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");
  return (
    <SessionProvider user={user}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Đang tải">
          <Image src="/logo.png" alt="SpeeGo" width={150} height={45} className="h-9 w-auto animate-pulse" />
        </div>
      }
    >
      <SessionShell>{children}</SessionShell>
    </Suspense>
  );
}
