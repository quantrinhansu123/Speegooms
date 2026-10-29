import { publicUserSchema, type PublicUser } from "@speego/shared";
import { z } from "zod";
import { InfrastructureError } from "../lib/errors";

export const userRecordSchema = publicUserSchema.extend({
  passwordHash: z.string().min(20).max(500),
});

export type UserRecord = z.infer<typeof userRecordSchema>;

export function toPublicUser(user: UserRecord): PublicUser {
  return publicUserSchema.parse({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    title: user.title,
  });
}

export function toUserRecord(row: {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  title: string;
  password_hash: string;
}): UserRecord {
  const parsed = userRecordSchema.safeParse({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    department: row.department,
    title: row.title,
    passwordHash: row.password_hash,
  });
  if (!parsed.success) {
    throw new InfrastructureError("database row is invalid");
  }
  return parsed.data;
}
