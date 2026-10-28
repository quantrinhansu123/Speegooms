import { Suspense, type ReactNode } from "react";
import { TableSkeleton } from "@/components/shared/loading-skeleton";

async function Resolve<P>({ params, children }: { params: Promise<P>; children: (p: P) => ReactNode }) {
  return children(await params);
}

/** Đọc `params` bên trong Suspense để App Shell của route không bị gắn với một URL cụ thể. */
export function WithParams<P>({
  params,
  fallback = <TableSkeleton rows={8} columns={5} />,
  children,
}: {
  params: Promise<P>;
  fallback?: ReactNode;
  children: (p: P) => ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      <Resolve params={params}>{children}</Resolve>
    </Suspense>
  );
}
