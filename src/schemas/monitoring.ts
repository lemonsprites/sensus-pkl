import { z } from "zod";

import { roleSchema } from "./user.js";

export const monitoringQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  ruangId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  q: z.string().trim().max(120).optional(),
});

export const adminGroupQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(["ASSESSED", "DOCS_COMPLETE", "VALIDATED", "TIDAK_DITEMUKAN"]).optional(),
  ruangId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  role: roleSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  q: z.string().trim().max(120).optional(),
});

export const bulkVerifySchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Pilih minimal satu grup").max(100),
});

export type MonitoringQuery = z.infer<typeof monitoringQuerySchema>;
export type AdminGroupQuery = z.infer<typeof adminGroupQuerySchema>;
export type BulkVerifyInput = z.infer<typeof bulkVerifySchema>;
