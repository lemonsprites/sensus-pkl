import { z } from "zod";

const USERNAME_RE = /^[a-z0-9._-]+$/;

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username minimal 3 karakter")
  .max(40, "Username maksimal 40 karakter")
  .transform((v) => v.toLowerCase())
  .refine((v) => USERNAME_RE.test(v), "Username hanya boleh huruf, angka, titik, garis bawah, dan tanda hubung");

export const passwordSchema = z
  .string()
  .min(8, "Password minimal 8 karakter")
  .max(72, "Password maksimal 72 karakter");

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, "Password wajib diisi"),
});

export const profileFieldsSchema = z.object({
  nim: z.string().trim().max(40).optional(),
  programStudi: z.string().trim().max(120).optional(),
  instansi: z.string().trim().max(160).optional(),
  noHp: z.string().trim().max(32).optional(),
});

export const updateMeSchema = z
  .object({
    nama: z.string().trim().min(1, "Nama wajib diisi").max(120).optional(),
    username: usernameSchema.optional(),
    ...profileFieldsSchema.shape,
  })
  .refine(
    (data) =>
      data.nama !== undefined ||
      data.username !== undefined ||
      data.nim !== undefined ||
      data.programStudi !== undefined ||
      data.instansi !== undefined ||
      data.noHp !== undefined,
    { message: "Tidak ada perubahan yang dikirim" },
  );

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Password lama wajib diisi"),
  newPassword: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
