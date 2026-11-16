import type { ActivityLogWhereInput } from "../generated/prisma/models.js";
import type { Prisma } from "../generated/prisma/client.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import type { LogQuery } from "../schemas/log.js";

export interface LogInput {
  actorId?: string | null;
  actorNama?: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: unknown;
}

/** Catat aktivitas; kegagalan log tidak boleh menggagalkan aksi utama. */
export async function logActivity(input: LogInput): Promise<void> {
  try {
    let actorNama = input.actorNama;
    if (!actorNama && input.actorId) {
      const actor = await prisma.user.findUnique({
        where: { id: input.actorId },
        select: { nama: true },
      });
      actorNama = actor?.nama;
    }

    const metadata =
      input.metadata === undefined
        ? undefined
        : (JSON.parse(JSON.stringify(input.metadata)) as Prisma.InputJsonValue);

    await prisma.activityLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorNama: actorNama ?? "Sistem",
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        ...(metadata !== undefined ? { metadata } : {}),
      },
    });
  } catch (error) {
    logger.warn({ err: (error as Error).message, action: input.action }, "Gagal menulis activity log");
  }
}

export async function listLogs(query: LogQuery) {
  const where: ActivityLogWhereInput = {};
  if (query.action) where.action = query.action;
  if (query.actorId) where.actorId = query.actorId;
  if (query.entityType) where.entityType = query.entityType;
  if (query.entityId) where.entityId = query.entityId;
  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lte: new Date(query.to) } : {}),
    };
  }
  if (query.q) {
    where.OR = [
      { actorNama: { contains: query.q, mode: "insensitive" } },
      { summary: { contains: query.q, mode: "insensitive" } },
      { entityId: { contains: query.q, mode: "insensitive" } },
    ];
  }

  const [items, total] = await prisma.$transaction([
    prisma.activityLog.findMany({
      where,
      select: {
        id: true, actorId: true, actorNama: true, action: true, entityType: true,
        entityId: true, summary: true, metadata: true, createdAt: true,
        actor: { select: { id: true, nama: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.activityLog.count({ where }),
  ]);

  return { items, total, page: query.page, limit: query.limit };
}
