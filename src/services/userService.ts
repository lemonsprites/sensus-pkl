import type { Role } from "../generated/prisma/enums.js";
import type { UserWhereInput } from "../generated/prisma/models.js";
import { prisma } from "../lib/prisma.js";
import type {
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
} from "../schemas/user.js";
import { ApiError } from "../utils/apiError.js";
import { generateTempPassword, hashPassword, PUBLIC_USER_SELECT } from "./authService.js";

export interface Actor {
  id: string;
  role: Role;
}

/** ADMIN hanya boleh membuat akun MAHASISWA. */
function assertBolehBuatRole(actor: Actor, role: Role): void {
  if (actor.role === "ADMIN" && role !== "MAHASISWA") {
    throw ApiError.forbidden("ADMIN hanya boleh membuat akun MAHASISWA");
  }
}

async function loadTarget(id: string) {
  const target = await prisma.user.findUnique({
    where: { id },
    select: { ...PUBLIC_USER_SELECT, tokenVersion: true },
  });
  if (!target) throw ApiError.notFound("User tidak ditemukan");
  return target;
}

/**
 * Matrix §11 (sementara sampai brief v1 tersedia):
 * - Tidak ada yang boleh mengelola akunnya sendiri lewat endpoint ini.
 * - ADMIN hanya mengelola MAHASISWA.
 * - SUPERADMIN boleh mengelola semua role lain.
 */
function assertBolehKelola(actor: Actor, target: { id: string; role: Role }): void {
  if (actor.id === target.id) {
    throw ApiError.forbidden(
      "Akun sendiri tidak bisa dikelola dari sini. Gunakan halaman Profil.",
    );
  }
  if (actor.role === "ADMIN" && target.role !== "MAHASISWA") {
    throw ApiError.forbidden("ADMIN hanya boleh mengelola akun MAHASISWA");
  }
}

/** Jangan sampai sekolah kehilangan SUPERADMIN aktif terakhir. */
async function assertBukanSuperadminTerakhir(target: {
  role: Role;
  isActive: boolean;
}): Promise<void> {
  if (target.role !== "SUPERADMIN" || !target.isActive) return;
  const aktif = await prisma.user.count({
    where: { role: "SUPERADMIN", isActive: true },
  });
  if (aktif <= 1) {
    throw ApiError.conflict("Tidak bisa menonaktifkan atau menurunkan SUPERADMIN terakhir");
  }
}

export async function listUsers(actor: Actor, query: ListUsersQuery) {
  const where: UserWhereInput = {};

  if (actor.role === "ADMIN") {
    // ADMIN tidak boleh melihat akun ADMIN/SUPERADMIN.
    where.role = "MAHASISWA";
  } else if (query.role) {
    where.role = query.role;
  }

  if (query.isActive !== undefined) where.isActive = query.isActive;

  if (query.q) {
    where.OR = [
      { nama: { contains: query.q, mode: "insensitive" } },
      { email: { contains: query.q, mode: "insensitive" } },
    ];
  }

  const skip = (query.page - 1) * query.limit;

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: PUBLIC_USER_SELECT,
      orderBy: { createdAt: "desc" },
      skip,
      take: query.limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total, page: query.page, limit: query.limit };
}

export async function createUser(actor: Actor, input: CreateUserInput) {
  assertBolehBuatRole(actor, input.role);

  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) throw ApiError.conflict("Email sudah terdaftar");

  const passwordHash = await hashPassword(input.password);

  return prisma.user.create({
    data: {
      nama: input.nama,
      email: input.email,
      passwordHash,
      role: input.role,
    },
    select: PUBLIC_USER_SELECT,
  });
}

export async function updateUser(actor: Actor, id: string, input: UpdateUserInput) {
  const target = await loadTarget(id);
  assertBolehKelola(actor, target);

  if (input.role !== undefined && input.role !== target.role) {
    if (actor.role === "ADMIN" && input.role !== "MAHASISWA") {
      throw ApiError.forbidden("ADMIN hanya boleh menetapkan role MAHASISWA");
    }
    if (target.role === "SUPERADMIN") {
      await assertBukanSuperadminTerakhir(target);
    }
  }

  if (input.email !== undefined && input.email !== target.email) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) throw ApiError.conflict("Email sudah terdaftar");
  }

  return prisma.user.update({
    where: { id },
    data: {
      ...(input.nama !== undefined ? { nama: input.nama } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
    },
    select: PUBLIC_USER_SELECT,
  });
}

/** Reset password oleh admin → password sementara dikembalikan SEKALI. */
export async function resetPassword(actor: Actor, id: string) {
  const target = await loadTarget(id);
  assertBolehKelola(actor, target);

  const password = generateTempPassword();
  const passwordHash = await hashPassword(password);

  await prisma.user.update({
    where: { id },
    data: { passwordHash, tokenVersion: { increment: 1 } },
  });

  return { password };
}

export async function setUserActive(actor: Actor, id: string, active: boolean) {
  const target = await loadTarget(id);
  assertBolehKelola(actor, target);

  if (!active) await assertBukanSuperadminTerakhir(target);

  return prisma.user.update({
    where: { id },
    data: active
      ? { isActive: true }
      : { isActive: false, tokenVersion: { increment: 1 } },
    select: PUBLIC_USER_SELECT,
  });
}
