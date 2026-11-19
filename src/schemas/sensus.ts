import { z } from "zod";

const uuid = (label: string) => z.string().uuid(`${label} tidak valid`);

export const ruangParamSchema = z.object({
  id: uuid("ID ruang"),
});

export const grupParamSchema = z.object({
  id: uuid("ID grup sensus"),
});

export const kandidatQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value ? value : undefined)),
});

const kondisiSchema = z.enum(["BAIK", "RUSAK_RINGAN", "RUSAK_BERAT"]);

export const createSensusGrupSchema = z.object({
  rows: z
    .array(
      z.object({
        kodeBarang: z.string().trim().min(1, "Kode Barang wajib").max(64),
        kondisi: kondisiSchema,
        jumlah: z.coerce.number().int().min(1, "Jumlah minimal 1").max(500),
        catatan: z.string().trim().max(1000).optional(),
      }),
    )
    .min(1, "Minimal satu baris input")
    .max(100),
});

export const updateSensusGrupSchema = z
  .object({
    kondisi: kondisiSchema.optional(),
    catatan: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((data) => data.kondisi !== undefined || data.catatan !== undefined, {
    message: "Tidak ada perubahan yang dikirim",
  });

export const rejectSensusGrupSchema = z.object({
  catatan: z.string().trim().min(1, "Alasan penolakan wajib diisi").max(1000),
});

export type RuangParam = z.infer<typeof ruangParamSchema>;
export type GrupParam = z.infer<typeof grupParamSchema>;
export type KandidatQuery = z.infer<typeof kandidatQuerySchema>;
export type CreateSensusGrupInput = z.infer<typeof createSensusGrupSchema>;
export type UpdateSensusGrupInput = z.infer<typeof updateSensusGrupSchema>;
export type RejectSensusGrupInput = z.infer<typeof rejectSensusGrupSchema>;
