import { z } from "zod";

const searchDay = z.string().trim().regex(/^$|^\d{4}-\d{2}-\d{2}$/, "Ngày không đúng định dạng");

export const listSearchSchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  from: searchDay.optional().default(""),
  to: searchDay.optional().default(""),
}).superRefine((value, ctx) => {
  if (value.from && value.to && value.from > value.to) {
    ctx.addIssue({ code: "custom", message: "Ngày bắt đầu không được sau ngày kết thúc", path: ["from"] });
  }
});

export type ListSearch = z.infer<typeof listSearchSchema>;
