import { z } from "zod";

export const importBatchParamSchema = z.object({
  batchId: z.string().uuid("ID batch tidak valid"),
});

export const importRowParamSchema = z.object({
  batchId: z.string().uuid("ID batch tidak valid"),
  rowNum: z.coerce.number().int().min(1, "Nomor baris tidak valid"),
});

export const importPreviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const importBatchIdSchema = z.object({
  batchId: z.string().uuid("ID batch tidak valid"),
});

export const importBatchListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const optionalText = (max = 255) => z.string().trim().max(max).optional();

export const importRowPatchSchema = z
  .object({
    kodeRegister: optionalText(64),
    kodeBarang: optionalText(64),
    kodeSiman: optionalText(64),
    nama: optionalText(255),
    kategori: optionalText(120),
    kodeSatker: optionalText(64),
    jumlahLama: z.coerce.number().int().min(0).max(1_000_000).optional(),
    merk: optionalText(120),
    noSeri: optionalText(120),
    tahun: z.coerce.number().int().min(1900).max(2100).optional(),
    nilaiPerolehan: z.union([z.string(), z.number()]).optional(),
    kondisiSiman: optionalText(120),
    statusAset: optionalText(120),
    catatan: optionalText(500),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Tidak ada perubahan yang dikirim",
  });

export type ImportBatchParam = z.infer<typeof importBatchParamSchema>;
export type ImportRowParam = z.infer<typeof importRowParamSchema>;
export type ImportPreviewQuery = z.infer<typeof importPreviewQuerySchema>;
export type ImportBatchListQuery = z.infer<typeof importBatchListQuerySchema>;
export type ImportRowPatchInput = z.infer<typeof importRowPatchSchema>;
