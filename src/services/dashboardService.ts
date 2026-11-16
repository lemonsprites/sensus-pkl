import type { SensusGrupWhereInput, SensusWhereInput } from "../generated/prisma/models.js";
import { prisma } from "../lib/prisma.js";
import type { DashboardQuery, DashboardTab } from "../schemas/dashboard.js";

const GROUP_WHERE: Partial<Record<DashboardTab, SensusGrupWhereInput>> = {
  PERLU_DOKUMEN: { status: "ASSESSED", docsComplete: false },
  PERLU_VERIFIKASI: { status: "DOCS_COMPLETE" },
};

const NUP_WHERE: Partial<Record<DashboardTab, SensusWhereInput>> = {
  PERLU_CETAK: { status: "VALIDATED", labelPrintedAt: null, isTemuanBaru: false },
  PERLU_TEMPEL: { status: "VALIDATED", labelPrintedAt: { not: null }, labelAppliedAt: null },
};

const RUANG_SELECT = {
  id: true,
  kode: true,
  nama: true,
  lantai: true,
  bangunanAset: { select: { nama: true } },
} as const;

export async function getDashboard(query: DashboardQuery) {
  const counts = await Promise.all([
    prisma.sensusGrup.count({ where: GROUP_WHERE.PERLU_DOKUMEN }),
    prisma.sensusGrup.count({ where: GROUP_WHERE.PERLU_VERIFIKASI }),
    prisma.sensus.count({ where: NUP_WHERE.PERLU_CETAK }),
    prisma.sensus.count({ where: NUP_WHERE.PERLU_TEMPEL }),
  ]);

  const countMap = {
    PERLU_DOKUMEN: counts[0],
    PERLU_VERIFIKASI: counts[1],
    PERLU_CETAK: counts[2],
    PERLU_TEMPEL: counts[3],
  };

  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  if (query.tab === "PERLU_DOKUMEN" || query.tab === "PERLU_VERIFIKASI") {
    const where: SensusGrupWhereInput = { ...(GROUP_WHERE[query.tab] ?? {}) };
    if (query.q) {
      where.OR = [
        { kodeBarang: { contains: query.q, mode: "insensitive" } },
        { namaBarang: { contains: query.q, mode: "insensitive" } },
      ];
    }
    const [items, total] = await prisma.$transaction([
      prisma.sensusGrup.findMany({
        where,
        select: {
          id: true, kodeBarang: true, namaBarang: true, kondisi: true, jumlah: true,
          status: true, docsComplete: true, catatan: true, catatanOtomatis: true, updatedAt: true,
          ruang: { select: RUANG_SELECT },
          createdBy: { select: { nama: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.sensusGrup.count({ where }),
    ]);
    return {
      counts: countMap,
      tab: query.tab,
      kind: "GROUP" as const,
      items: items.map((item) => ({ ...item, kind: "GROUP" as const })),
      total,
      page,
      limit,
    };
  }

  const where: SensusWhereInput = { ...(NUP_WHERE[query.tab] ?? {}) };
  if (query.q) {
    where.masterAset = {
      OR: [
        { nama: { contains: query.q, mode: "insensitive" } },
        { kodeRegister: { contains: query.q, mode: "insensitive" } },
        { kodeSiman: { contains: query.q, mode: "insensitive" } },
        { kodeBarang: { contains: query.q, mode: "insensitive" } },
      ],
    };
  }

  const [items, total] = await prisma.$transaction([
    prisma.sensus.findMany({
      where,
      select: {
        id: true, status: true, labelPrintedAt: true, labelAppliedAt: true, updatedAt: true,
        masterAset: {
          select: { id: true, kodeRegister: true, kodeBarang: true, kodeSiman: true, nama: true, kategori: true },
        },
        ruang: { select: RUANG_SELECT },
        grup: { select: { id: true, kondisi: true, jumlah: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.sensus.count({ where }),
  ]);

  return {
    counts: countMap,
    tab: query.tab,
    kind: "NUP" as const,
    items: items.map((item) => ({ ...item, kind: "NUP" as const })),
    total,
    page,
    limit,
  };
}
