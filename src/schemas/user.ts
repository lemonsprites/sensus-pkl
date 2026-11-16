import { z } from "zod";

import { emailSchema, passwordSchema, profileFieldsSchema } from "./auth.js";

export const roleSchema = z.enum(["MAHASISWA", "ADMIN", "SUPERADMIN"]);

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
  role: roleSchema.optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export const createUserSchema = z.object({
  nama: z.string().trim().min(1, "Nama wajib diisi").max(120),
  email: emailSchema,
  password: passwordSchema,
  role: roleSchema.default("MAHASISWA"),
  ...profileFieldsSchema.shape,
});

export const updateUserSchema = z
  .object({
    nama: z.string().trim().min(1, "Nama wajib diisi").max(120).optional(),
    email: emailSchema.optional(),
    role: roleSchema.optional(),
    ...profileFieldsSchema.shape,
  })
  .refine(
    (data) =>
      data.nama !== undefined ||
      data.email !== undefined ||
      data.role !== undefined ||
      data.nim !== undefined ||
      data.programStudi !== undefined ||
      data.instansi !== undefined ||
      data.noHp !== undefined,
    { message: "Tidak ada perubahan yang dikirim" },
  );

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const userIdParamSchema = z.object({
  id: z.string().uuid("ID user tidak valid"),
});

export type UserIdParam = z.infer<typeof userIdParamSchema>;
