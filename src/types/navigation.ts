import type { LucideIcon } from "lucide-react";

export interface NavLeaf {
  title: string;
  href: string;
}

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Nhãn nhỏ cạnh tên, ví dụ "Chưa phân bổ" */
  tag?: string;
  /** Nhóm con (nhóm / vị trí trong phòng) */
  children?: NavLeaf[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}
