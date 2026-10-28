import type { Role } from "./role";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Tên phòng hiển thị */
  department: string;
  title: string;
}
