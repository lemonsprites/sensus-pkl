import type { Prisma } from "../generated/prisma/client.js";
import type { SensusStatus } from "../generated/prisma/enums.js";
import { prisma } from "../lib/prisma.js";
import type { AdminGroupQuery, MonitoringQuery } from "../schemas/monitoring.js";
import { verifySensusGrup } from "./sensusService.js";

function period(from?: string, to?: string): { gte?: Date; lte?: Date } | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(to) } : {}),
  };
}

function emptyStatus() {
  return {
    ASSESSED: 0,
    DOCS_COMPLETE: 0,
    VALIDATED: 0,
    TIDAK_DITEMUKAN: 0,
  } as Record<SensusStatus, number>;
}

export async function getProgress(query: MonitoringQuery) {
  const range = period(query.from, query.to);
  const groupWhere: Prisma.SensusGrupWhereInput = {
    ...(query.ruangId ? { ruangId: query.ruangId } : {}),
    ...(query.userId ? { createdById: query.userId } : {}),
    ...(range ? { createdAt: range } : {}),
    ...(query.q
      ? {
          OR: [
            { kodeBarang: { contains: query.q, mode: "insensitive" } },
            { namaBarang: { contains: query.q, mode: "insensitive" } },
            { ruang: { nama: { contains: query.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [users, groups, docsByUser, corrections, activity, students] = await Promise.all([
    prisma.user.findMany({
      where: {
        ...(query.userId ? { id: query.userId } : {}),
        ...(query.q
          ? {
              OR: [
                { nama: { contains: query.q, mode: "insensitive" } },
                { nim: { contains: query.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true, nama: true, username: true, role: true, nim: true,
        programStudi: true, instansi: true, isActive: true, lastLoginAt: true,
      },
      orderBy: { nama: "asc" },
    }),
    prisma.sensusGrup.findMany({
      where: groupWhere,
      select: {
        id: true, ruangId: true, kodeBarang: true, namaBarang: true,
        kondisi: true, jumlah: true, status: true, createdAt: true, updatedAt: true,
        createdById: true, updatedById: true,
        ruang: { select: { id: true, kode: true, nama: true, bangunanAset: { select: { id: true, nama: true } } } },
        sensus: { select: { id: true, status: true } },
        dokumen: { select: { id: true, uploadedById: true } },
      },
    }),
    prisma.sensusDokumen.groupBy({
      by: ["uploadedById"],
      where: {
        ...(range ? { createdAt: range } : {}),
        ...(query.ruangId ? { grup: { ruangId: query.ruangId } } : {}),
      },
      _count: { _all: true },
    }),
    prisma.sensusGrup.groupBy({
      by: ["updatedById"],
      where: {
        updatedById: { not: null },
        ...(query.ruangId ? { ruangId: query.ruangId } : {}),
        ...(range ? { updatedAt: range } : {}),
      },
      _count: { _all: true },
    }),
    prisma.activityLog.groupBy({
      by: ["actorId"],
      where: {
        actorId: { not: null },
        action: { notIn: ["LOGIN", "LOGOUT"] },
        ...(range ? { createdAt: range } : {}),
      },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.user.count({ where: { role: "MAHASISWA", isActive: true } }),
  ]);

  const docsMap = new Map(docsByUser.map((row) => [row.uploadedById, row._count._all]));
  const correctionsMap = new Map(
    corrections.filter((row) => row.updatedById).map((row) => [row.updatedById as string, row._count._all]),
  );
  const activityMap = new Map(
    activity.filter((row) => row.actorId).map((row) => [row.actorId as string, row]),
  );

  const statusTotals = emptyStatus();
  for (const group of groups) statusTotals[group.status] += 1;

  const progress = users.map((user) => {
    const milik = groups.filter((group) => group.createdById === user.id);
    const status = emptyStatus();
    const rooms = new Set<string>();
    let nupAllocated = 0;
    for (const group of milik) {
      status[group.status] += 1;
      nupAllocated += group.sensus.length;
      rooms.add(group.ruangId);
    }
    const log = activityMap.get(user.id);
    return {
      ...user,
      groupsCreated: milik.length,
      nupAllocated,
      docsUploaded: docsMap.get(user.id) ?? 0,
      corrections: correctionsMap.get(user.id) ?? 0,
      validatedGroups: status.VALIDATED,
      activityCount: log?._count._all ?? 0,
      lastActivityAt: log?._max.createdAt?.toISOString() ?? null,
      ruangCount: rooms.size,
      status,
    };
  });

  progress.sort((a, b) => b.nupAllocated - a.nupAllocated || b.activityCount - a.activityCount);

  const roomMap = new Map<string, {
    id: string; kode: string; nama: string; gedung: string;
    groups: number; nup: number; docs: number; contributors: Set<string>;
    status: Record<SensusStatus, number>; lastActivityAt: Date;
  }>();
  for (const group of groups) {
    const current = roomMap.get(group.ruangId) ?? {
      id: group.ruang.id,
      kode: group.ruang.kode,
      nama: group.ruang.nama,
      gedung: group.ruang.bangunanAset.nama,
      groups: 0,
      nup: 0,
      docs: 0,
      contributors: new Set<string>(),
      status: emptyStatus(),
      lastActivityAt: group.updatedAt,
    };
    current.groups += 1;
    current.nup += group.sensus.length;
    current.docs += group.dokumen.length;
    current.status[group.status] += 1;
    if (group.createdById) current.contributors.add(group.createdById);
    if (group.updatedById) current.contributors.add(group.updatedById);
    for (const doc of group.dokumen) current.contributors.add(doc.uploadedById);
    if (group.updatedAt > current.lastActivityAt) current.lastActivityAt = group.updatedAt;
    roomMap.set(group.ruangId, current);
  }
  const rooms = [...roomMap.values()]
    .map((room) => ({
      ...room,
      contributors: room.contributors.size,
      lastActivityAt: room.lastActivityAt.toISOString(),
    }))
    .sort((a, b) => b.groups - a.groups || a.nama.localeCompare(b.nama));

  const totalNup = groups.reduce((sum, group) => sum + group.sensus.length, 0);
  const totalDocs = docsByUser.reduce((sum, row) => sum + row._count._all, 0);
  return {
    period: { from: query.from ?? null, to: query.to ?? null },
    summary: {
      totalGroups: groups.length,
      totalNup,
      totalDocs,
      totalStudents: students,
      activeContributors: progress.filter((row) => row.activityCount > 0 || row.groupsCreated > 0).length,
      status: statusTotals,
      validatedNup: groups
        .filter((group) => group.status === "VALIDATED")
        .reduce((sum, group) => sum + group.sensus.length, 0),
    },
    mahasiswa: progress,
    ruang: rooms,
  };
}

export async function listAdminGroups(query: AdminGroupQuery) {
  const range = period(query.from, query.to);
  const base: Prisma.SensusGrupWhereInput = {
    ...(query.ruangId ? { ruangId: query.ruangId } : {}),
    ...(query.userId ? { createdById: query.userId } : {}),
    ...(range ? { createdAt: range } : {}),
    ...(query.q
      ? {
          OR: [
            { kodeBarang: { contains: query.q, mode: "insensitive" } },
            { namaBarang: { contains: query.q, mode: "insensitive" } },
            { ruang: { nama: { contains: query.q, mode: "insensitive" } } },
            { createdBy: { nama: { contains: query.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const where: Prisma.SensusGrupWhereInput = { ...base, ...(query.status ? { status: query.status } : {}) };

  const [items, total, statusGroups] = await prisma.$transaction([
    prisma.sensusGrup.findMany({
      where,
      select: {
        id: true, ruangId: true, kodeBarang: true, namaBarang: true,
        kondisi: true, jumlah: true, status: true, docsComplete: true, catatan: true,
        createdAt: true, updatedAt: true,
        createdBy: { select: { id: true, nama: true, nim: true } },
        updatedBy: { select: { id: true, nama: true } },
        ruang: { select: { id: true, kode: true, nama: true, bangunanAset: { select: { nama: true } } } },
        sensus: { select: { id: true, status: true, masterAset: { select: { kodeSiman: true, kodeRegister: true } } } },
        dokumen: { select: { id: true, jenis: true, createdAt: true, uploadedBy: { select: { nama: true } } } },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.sensusGrup.count({ where }),
    prisma.sensusGrup.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
  ]);

  const statusCounts = emptyStatus();
  for (const row of statusGroups) statusCounts[row.status] = row._count._all;
  return { items, total, page: query.page, limit: query.limit, statusCounts };
}

export async function bulkVerify(actorId: string, ids: string[]) {
  let verified = 0;
  const errors: { id: string; message: string }[] = [];
  for (const id of ids) {
    try {
      await verifySensusGrup(actorId, id);
      verified += 1;
    } catch (error) {
      errors.push({ id, message: (error as Error).message });
    }
  }
  return { verified, skipped: errors.length, errors };
}
