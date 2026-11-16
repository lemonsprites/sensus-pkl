import { z } from "zod";

export const logQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(30),
  action: z.string().trim().max(64).optional(),
  actorId: z.string().uuid().optional(),
  entityType: z.string().trim().max(64).optional(),
  entityId: z.string().trim().max(80).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  q: z.string().trim().max(160).optional(),
});

export type LogQuery = z.infer<typeof logQuerySchema>;
