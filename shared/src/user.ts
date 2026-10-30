import { z } from "zod";

/** Khớp src/types/role.ts của frontend. */
export const roleSchema = z.enum([
  "admin",
  "ban-gd",
  "marketing",
  "sale-vn",
  "sale-global",
  "van-hanh",
  "sourcing",
  "logistics",
  "ke-toan",
  "hcns",
  "phap-che",
]);

export const publicUserSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  email: z.string().email(),
  role: roleSchema,
  department: z.string().min(1).max(120),
  title: z.string().min(1).max(120),
});

export type Role = z.infer<typeof roleSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
