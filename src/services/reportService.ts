import type { Prisma } from "../generated/prisma/client.js";
import type { Kondisi, SensusStatus } from "../generated/prisma/enums.js";
import { config } from "../lib/config.js";
import { prisma } from "../lib/prisma.js";
import type { ReportQuery } from "../schemas/report.js";
import { ApiError } from "../utils/apiError.js";
import type { Actor } from "./userService.js";

function emptyConditions(): Record<Kondisi, number> {
  return { BAIK: 0, RUSAK_RINGAN: 0, RUSAK_BERAT: 0 };
}

function emptyStatus(): Record<SensusStatus, number> {
  return { DRAFT: 0, ASSESSED: 0, DOCS_COMPLETE: 0, VALIDATED: 0, TIDAK_DITEMUKAN: 0 };
}

export async function getReportData(actor: Actor, query: ReportQuery) {
  // MAHASISWA hanya boleh membuat laporan dirinya sendiri. ADMIN/SUPERADMIN
  // dapat memilih user lewat query userId atau melihat laporan seluruh sekolah.
  const subjectId = actor.role === "MAHASISWA" ? actor.id : query.userId;
  const subject = subjectId
    ? await prisma.user.findUnique({
        where: { id: subjectId },
        select: {
          id: true, nama: true, nim: true, programStudi: true, instansi: true,
          role: true, isActive: true,
        },
      })
    : null;
  if (subjectId && !subject) throw ApiError.notFound("Mahasiswa tidak ditemukan");

  const range: { gte?: Date; lte?: Date } | undefined =
    query.from || query.to
      ? {
          ...(query.from ? { gte: new Date(query.from) } : {}),
          ...(query.to ? { lte: new Date(query.to) } : {}),
        }
      : undefined;

  const groupWhere: Prisma.SensusGrupWhereInput = {
    ...(range ? { createdAt: range } : {}),
    ...(subjectId ? { createdById: subjectId } : {}),
    ...(query.roomId
      ? { ruangId: query.roomId }
      : query.buildingId
        ? { ruang: { bangunanAsetId: query.buildingId } }
        : {}),
  };

  const [groups, totalMaster, totalSensus, docsCount, logs] = await Promise.all([
    prisma.sensusGrup.findMany({
      where: groupWhere,
      select: {
        id: true, ruangId: true, kodeBarang: true, namaBarang: true,
        kondisi: true, jumlah: true, status: true, catatan: true,
        createdAt: true, updatedAt: true,
        createdBy: { select: { id: true, nama: true, nim: true } },
        updatedBy: { select: { id: true, nama: true } },
        ruang: {
          select: {
            id: true, kode: true, nama: true, lantai: true,
            bangunanAset: { select: { id: true, nama: true, kodeBarang: true } },
          },
        },
        sensus: {
          select: {
            id: true, status: true, kondisi: true, isTemuanBaru: true,
            masterAset: { select: { kodeSiman: true, kodeRegister: true, nama: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        dokumen: { select: { id: true, jenis: true } },
      },
      orderBy: [{ ruang: { bangunanAset: { nama: "asc" } } }, { ruang: { nama: "asc" } }, { namaBarang: "asc" }],
    }),
    prisma.masterAset.count({
      where: {
        ...(config.SATKER_KODE ? { kodeSatker: config.SATKER_KODE } : {}),
        statusAset: { contains: "aktif", mode: "insensitive" },
      },
    }),
    prisma.sensus.count({
      where: {
        ...(subjectId ? { grup: { createdById: subjectId } } : {}),
        ...(query.roomId
          ? { ruangId: query.roomId }
          : query.buildingId
            ? { ruang: { bangunanAsetId: query.buildingId } }
            : {}),
      },
    }),
    prisma.sensusDokumen.count({
      where: {
        ...(subjectId ? { grup: { createdById: subjectId } } : {}),
        ...(query.roomId
          ? { grup: { ruangId: query.roomId } }
          : query.buildingId
            ? { grup: { ruang: { bangunanAsetId: query.buildingId } } }
            : {}),
      },
    }),
    query.includeLog === "true"
      ? prisma.activityLog.findMany({
          where: {
            ...(subjectId ? { actorId: subjectId } : {}),
            ...(range ? { createdAt: range } : {}),
          },
          select: {
            id: true, actorNama: true, action: true, entityType: true,
            entityId: true, summary: true, createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 60,
        })
      : Promise.resolve([]),
  ]);

  const conditions = emptyConditions();
  const status = emptyStatus();
  let totalNup = 0;
  for (const group of groups) {
    conditions[group.kondisi] += group.jumlah;
    status[group.status] += 1;
    totalNup += group.sensus.length;
  }

  const roomMap = new Map<string, {
    id: string; kode: string; nama: string; lantai: number; gedung: string;
    groups: number; nup: number; docs: number; conditions: Record<Kondisi, number>;
    status: Record<SensusStatus, number>;
  }>();
  const buildingMap = new Map<string, {
    id: string; nama: string; kode: string; rooms: Set<string>; groups: number;
    nup: number; docs: number; conditions: Record<Kondisi, number>;
  }>();

  for (const group of groups) {
    const room = roomMap.get(group.ruangId) ?? {
      id: group.ruang.id, kode: group.ruang.kode, nama: group.ruang.nama,
      lantai: group.ruang.lantai, gedung: group.ruang.bangunanAset.nama,
      groups: 0, nup: 0, docs: 0, conditions: emptyConditions(), status: emptyStatus(),
    };
    room.groups += 1;
    room.nup += group.sensus.length;
    room.docs += group.dokumen.length;
    room.conditions[group.kondisi] += group.jumlah;
    room.status[group.status] += 1;
    roomMap.set(group.ruangId, room);

    const building = buildingMap.get(group.ruang.bangunanAset.id) ?? {
      id: group.ruang.bangunanAset.id, nama: group.ruang.bangunanAset.nama,
      kode: group.ruang.bangunanAset.kodeBarang ?? "", rooms: new Set<string>(),
      groups: 0, nup: 0, docs: 0, conditions: emptyConditions(),
    };
    building.rooms.add(group.ruangId);
    building.groups += 1;
    building.nup += group.sensus.length;
    building.docs += group.dokumen.length;
    building.conditions[group.kondisi] += group.jumlah;
    buildingMap.set(group.ruang.bangunanAset.id, building);
  }

  const findings = groups
    .filter(
      (group) =>
        group.kondisi !== "BAIK" ||
        group.status === "TIDAK_DITEMUKAN" ||
        Boolean(group.catatan),
    )
    .map((group) => ({
      grupId: group.id,
      ruang: `${group.ruang.nama} (${group.ruang.kode})`,
      gedung: group.ruang.bangunanAset.nama,
      namaBarang: group.namaBarang,
      kodeBarang: group.kodeBarang,
      kondisi: group.kondisi,
      jumlah: group.jumlah,
      status: group.status,
      catatan: group.catatan,
    }));

  const contributorMap = new Map<string, {
    id: string; nama: string; nim: string | null; groups: number; nup: number;
    docs: number; corrections: number; validated: number;
  }>();
  for (const group of groups) {
    const current = contributorMap.get(group.createdBy.id) ?? {
      id: group.createdBy.id, nama: group.createdBy.nama, nim: group.createdBy.nim,
      groups: 0, nup: 0, docs: 0, corrections: 0, validated: 0,
    };
    current.groups += 1;
    current.nup += group.sensus.length;
    current.docs += group.dokumen.length;
    current.validated += group.status === "VALIDATED" ? 1 : 0;
    contributorMap.set(group.createdBy.id, current);
    if (group.updatedBy) {
      const editor = contributorMap.get(group.updatedBy.id) ?? {
        id: group.updatedBy.id, nama: group.updatedBy.nama, nim: null,
        groups: 0, nup: 0, docs: 0, corrections: 0, validated: 0,
      };
      editor.corrections += 1;
      contributorMap.set(group.updatedBy.id, editor);
    }
  }

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      generatedBy: { id: actor.id, role: actor.role },
      periode: { from: query.from ?? null, to: query.to ?? null },
      kementerian: query.kementerian ?? "KEMENTERIAN AGAMA REPUBLIK INDONESIA",
      sekolah: query.sekolah ?? "",
      alamat: query.alamat ?? "",
      kota: query.kota ?? "",
      kontak: query.kontak ?? "",
      kopImageUrl: query.kopImageUrl ?? "/Kopsurat.png",
      satker: config.SATKER_KODE ?? null,
      subject: subject
        ? {
            id: subject.id, nama: subject.nama, nim: subject.nim,
            programStudi: subject.programStudi, instansi: subject.instansi,
            role: subject.role, isActive: subject.isActive,
          }
        : null,
      scope: {
        userId: subjectId ?? null,
        buildingId: query.buildingId ?? null,
        roomId: query.roomId ?? null,
        gedung: [...buildingMap.values()].map((row) => row.nama),
      },
      signatures: {
        kepala: query.kepala ?? "",
        adminBmn: query.adminBmn ?? "",
        pembimbing: query.pembimbing ?? "",
      },
    },
    summary: {
      totalMaster,
      totalSensus,
      totalGroups: groups.length,
      totalNup,
      totalDocs: docsCount,
      coverage: totalMaster > 0 ? Math.round((totalSensus / totalMaster) * 1000) / 10 : 0,
      conditions,
      status,
      findings: findings.length,
      validatedGroups: status.VALIDATED,
    },
    perRuang: [...roomMap.values()].sort((a, b) => a.gedung.localeCompare(b.gedung) || a.lantai - b.lantai || a.nama.localeCompare(b.nama)),
    perGedung: [...buildingMap.values()]
      .map((row) => ({ ...row, rooms: row.rooms.size }))
      .sort((a, b) => a.nama.localeCompare(b.nama)),
    findings,
    contributors: [...contributorMap.values()].sort((a, b) => b.nup - a.nup || a.nama.localeCompare(b.nama)),
    groups: groups.map((group) => ({
      id: group.id,
      ruang: group.ruang.nama,
      kodeRuang: group.ruang.kode,
      lantai: group.ruang.lantai,
      gedung: group.ruang.bangunanAset.nama,
      kodeBarang: group.kodeBarang,
      namaBarang: group.namaBarang,
      kondisi: group.kondisi,
      jumlah: group.jumlah,
      status: group.status,
      docs: group.dokumen.length,
      nup: group.sensus.map((row) => ({
        kodeSiman: row.masterAset.kodeSiman,
        kodeRegister: row.masterAset.kodeRegister,
        nama: row.masterAset.nama,
        status: row.status,
        kondisi: row.kondisi,
        temuanBaru: row.isTemuanBaru,
      })),
    })),
    logs: logs.map((log) => ({ ...log, createdAt: log.createdAt.toISOString() })),
  };
}
export type ReportData = Awaited<ReturnType<typeof getReportData>>;

