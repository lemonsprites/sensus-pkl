import { z } from "zod";

export const labelQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
});

export const labelIdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Pilih minimal satu label").max(500),
});

export const scanParamSchema = z.object({
  kodeRegister: z.string().trim().min(1).max(120),
});

export type LabelQuery = z.infer<typeof labelQuerySchema>;
export type LabelIdsInput = z.infer<typeof labelIdsSchema>;
export type ScanParam = z.infer<typeof scanParamSchema>;
