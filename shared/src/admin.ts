import { z } from "zod";
import { roleSchema } from "./user";

export const updateRoleSchema = z.object({
  role: roleSchema,
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
