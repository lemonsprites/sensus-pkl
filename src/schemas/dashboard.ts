import { z } from "zod";

export const dashboardTabSchema = z.enum([
  "PERLU_DOKUMEN",
  "PERLU_VERIFIKASI",
  "PERLU_INPUT_SIMAN",
  "PERLU_CETAK",
  "PERLU_TEMPEL",
]);

export const dashboardQuerySchema = z.object({
  tab: dashboardTabSchema.default("PERLU_DOKUMEN"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
});

export type DashboardTab = z.infer<typeof dashboardTabSchema>;
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
