import { z } from "zod";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email wajib diisi")
  .transform((v) => v.toLowerCase())
  .refine((v) => EMAIL_RE.test(v), "Format email tidak valid");

export const passwordSchema = z
  .string()
  .min(8, "Password minimal 8 karakter")
  .max(72, "Password maksimal 72 karakter");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password wajib diisi"),
});

export const updateMeSchema = z
  .object({
    nama: z.string().trim().min(1, "Nama wajib diisi").max(120).optional(),
    email: emailSchema.optional(),
  })
  .refine((data) => data.nama !== undefined || data.email !== undefined, {
    message: "Tidak ada perubahan yang dikirim",
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Password lama wajib diisi"),
  newPassword: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
