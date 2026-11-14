import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ChangePasswordForm } from "@/features/auth/change-password-form";

export const metadata: Metadata = { title: "Tài khoản cá nhân" };
export const instant = false;

export default function Page() {
  return <><PageHeader title="Tài khoản cá nhân" description="Bảo mật tài khoản của bạn." /><ChangePasswordForm /></>;
}
