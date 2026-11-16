import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

import { signAccessToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { logActivity } from "./activityService.js";

export const BCRYPT_ROUNDS = 12;

export const PUBLIC_USER_SELECT = {
  id: true,
  nama: true,
  username: true,
  role: true,
  isActive: true,
  nim: true,
  programStudi: true,
  instansi: true,
  noHp: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function generateTempPassword(): string {
  // base64url tanpa karakter ambigu; 16 karakter cukup untuk password sementara.
  return randomBytes(12).toString("base64url").slice(0, 16);
}

/** Login username+password → JWT (berisi tokenVersion saat ini). */
export async function login(username: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { ...PUBLIC_USER_SELECT, passwordHash: true, tokenVersion: true },
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw ApiError.unauthorized("Username atau password salah");
  }
  if (!user.isActive) {
    throw ApiError.forbidden("Akun dinonaktifkan. Hubungi admin sekolah.");
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await logActivity({
    actorId: user.id,
    actorNama: user.nama,
    action: "LOGIN",
    entityType: "AUTH",
    entityId: user.id,
    summary: `${user.nama} masuk ke aplikasi`,
  });

  const token = signAccessToken({
    sub: user.id,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  return {
    token,
    user: {
      id: user.id,
      nama: user.nama,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      nim: user.nim,
      programStudi: user.programStudi,
      instansi: user.instansi,
      noHp: user.noHp,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  };
}

/** Logout → tokenVersion naik, semua token lama mati. */
export async function logout(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
  await logActivity({
    actorId: userId,
    action: "LOGOUT",
    entityType: "AUTH",
    entityId: userId,
    summary: "Keluar dari aplikasi",
  });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PUBLIC_USER_SELECT,
  });
  if (!user) throw ApiError.notFound("User tidak ditemukan");
  return user;
}

export async function updateMe(
  userId: string,
  input: {
    nama?: string;
    username?: string;
    nim?: string;
    programStudi?: string;
    instansi?: string;
    noHp?: string;
  },
) {
  if (input.username) {
    const existing = await prisma.user.findUnique({
      where: { username: input.username },
      select: { id: true },
    });
    if (existing && existing.id !== userId) throw ApiError.conflict("Username sudah dipakai akun lain");
  }
  if (input.nim) {
    const existing = await prisma.user.findUnique({ where: { nim: input.nim }, select: { id: true } });
    if (existing && existing.id !== userId) throw ApiError.conflict("NIM sudah dipakai akun lain");
  }
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.nama !== undefined ? { nama: input.nama } : {}),
      ...(input.username !== undefined ? { username: input.username } : {}),
      ...(input.nim !== undefined ? { nim: input.nim || null } : {}),
      ...(input.programStudi !== undefined ? { programStudi: input.programStudi || null } : {}),
      ...(input.instansi !== undefined ? { instansi: input.instansi || null } : {}),
      ...(input.noHp !== undefined ? { noHp: input.noHp || null } : {}),
    },
    select: PUBLIC_USER_SELECT,
  });
}

/**
 * Ganti password sendiri. tokenVersion naik → token lama invalid; token baru
 * dikembalikan agar sesi berjalan tidak perlu login ulang.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true, role: true },
  });
  if (!user) throw ApiError.notFound("User tidak ditemukan");

  const cocok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!cocok) throw ApiError.badRequest("Password lama tidak sesuai");

  const passwordHash = await hashPassword(newPassword);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, tokenVersion: { increment: 1 } },
    select: { tokenVersion: true },
  });

  const token = signAccessToken({
    sub: user.id,
    role: user.role,
    tokenVersion: updated.tokenVersion,
  });

  return { token };
}
