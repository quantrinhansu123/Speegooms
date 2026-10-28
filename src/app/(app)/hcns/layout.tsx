import { ModuleShell } from "@/features/backoffice/module-shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ModuleShell>{children}</ModuleShell>;
}
