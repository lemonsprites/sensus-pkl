import { z } from "zod";

const uuid = (label: string) => z.string().uuid(`${label} tidak valid`);

export const dokumenListParamSchema = z.object({ id: uuid("ID grup sensus") });
export const dokumenIdParamSchema = z.object({
  id: uuid("ID grup sensus"),
  dokumenId: uuid("ID dokumen"),
});

export const dokumenPresignSchema = z.object({
  filename: z.string().trim().min(1, "Nama file wajib").max(255),
  contentType: z.string().trim().min(1).max(120),
  jenis: z.enum(["FOTO", "DOKUMEN"]).default("FOTO"),
});

export const dokumenConfirmSchema = z.object({
  objectKey: z.string().trim().min(1).max(500),
  jenis: z.enum(["FOTO", "DOKUMEN"]).default("FOTO"),
  contentType: z.string().trim().max(120).optional(),
  size: z.coerce.number().int().min(0).max(50 * 1024 * 1024).optional(),
});

export type DokumenListParam = z.infer<typeof dokumenListParamSchema>;
export type DokumenIdParam = z.infer<typeof dokumenIdParamSchema>;
export type DokumenPresignInput = z.infer<typeof dokumenPresignSchema>;
export type DokumenConfirmInput = z.infer<typeof dokumenConfirmSchema>;
