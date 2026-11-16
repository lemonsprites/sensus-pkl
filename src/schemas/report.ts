import { z } from "zod";

export const reportQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  buildingId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  sekolah: z.string().trim().max(160).optional(),
  alamat: z.string().trim().max(240).optional(),
  kota: z.string().trim().max(80).optional(),
  kepala: z.string().trim().max(120).optional(),
  adminBmn: z.string().trim().max(120).optional(),
  pembimbing: z.string().trim().max(120).optional(),
  includeLog: z.enum(["true", "false"]).default("true"),
});

export const reportExportQuerySchema = reportQuerySchema.extend({
  format: z.enum(["docx"]).default("docx"),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type ReportExportQuery = z.infer<typeof reportExportQuerySchema>;
