import { z } from "zod";

const uuid = (label: string) => z.string().uuid(`${label} tidak valid`);

export const ruangParamSchema = z.object({
  id: uuid("ID ruang"),
});

export const sensusParamSchema = z.object({
  barangLamaId: uuid("ID aset"),
});

export const roomAssetsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
  status: z.enum(["SEMUA", "BELUM", "SUDAH"]).default("SEMUA"),
});

export const sensusUpsertSchema = z.object({
  jumlahFisik: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
  kondisi: z.enum(["BAIK", "RUSAK_RINGAN", "RUSAK_BERAT"]).nullable().optional(),
  statusMatch: z.enum(["COCOK", "TIDAK_COCOK", "TEMUAN_BARU"]).nullable().optional(),
  isTemuanBaru: z.boolean().optional(),
  docsNote: z.string().trim().max(1000).nullable().optional(),
  catatan: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(["DRAFT", "ASSESSED", "TIDAK_DITEMUKAN"]).default("ASSESSED"),
});

export type RuangParam = z.infer<typeof ruangParamSchema>;
export type SensusParam = z.infer<typeof sensusParamSchema>;
export type RoomAssetsQuery = z.infer<typeof roomAssetsQuerySchema>;
export type SensusUpsertInput = z.infer<typeof sensusUpsertSchema>;

export const rejectSensusSchema = z.object({
  catatan: z.string().trim().min(1, "Alasan penolakan wajib diisi").max(1000),
});

export type RejectSensusInput = z.infer<typeof rejectSensusSchema>;
