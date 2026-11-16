import { z } from "zod";

export const exportQuerySchema = z.object({
  format: z.enum(["csv", "xlsx"]).default("csv"),
});

export type ExportQuery = z.infer<typeof exportQuerySchema>;
