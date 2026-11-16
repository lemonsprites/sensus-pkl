import type { SensusWhereInput } from "../generated/prisma/models.js";
import { prisma } from "../lib/prisma.js";
import type { DashboardQuery, DashboardTab } from "../schemas/dashboard.js";

const TAB_WHERE: Record<DashboardTab, SensusWhereInput> = {
  PERLU_DOKUMEN: { status: "ASSESSED", docsComplete: false },
  PERLU_VERIFIKASI: {
    OR: [
      { status: "DOCS_COMPLETE" },
      { status: "TIDAK_DITEMUKAN", diverifikasiAt: null },
    ],
  },
  PERLU_CETAK: { status: "VALIDATED", labelPrintedAt: null, isTemuanBaru: false },
  PERLU_TEMPEL: {
    status: "VALIDATED",
    labelPrintedAt: { not: null },
    labelAppliedAt: null,
  },
};

const DASHBOARD_SELECT = {
  id: true,
  status: true,
  jumlahFisik: true,
  kondisi: true,
  statusMatch: true,
  isTemuanBaru: true,
  docsComplete: true,
  labelPrintedAt: true,
  labelAppliedAt: true,
  updatedAt: true,
  barangLama: {
    select: {
      id: true,
      kodeRegister: true,
      kodeBarang: true,
      kodeSiman: true,
      nama: true,
      kategori: true,
      kodeSatker: true,
      statusAset: true,
      ruang: {
        select: {
          id: true,
          kode: true,
          nama: true,
          lantai: true,
          bangunanAset: { select: { id: true, nama: true } },
        },
      },
    },
  },
  diinputOleh: { select: { id: true, nama: true } },
} as const;

export async function getDashboard(query: DashboardQuery) {
  const counts = await Promise.all(
    (Object.keys(TAB_WHERE) as DashboardTab[]).map(async (tab) => [
      tab,
      await prisma.sensus.count({ where: TAB_WHERE[tab] }),
    ] as const),
  );

  const where: SensusWhereInput = { ...TAB_WHERE[query.tab] };
  if (query.q) {
    where.barangLama = {
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
      select: DASHBOARD_SELECT,
      orderBy: { updatedAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.sensus.count({ where }),
  ]);

  return {
    counts: Object.fromEntries(counts),
    tab: query.tab,
    items,
    total,
    page: query.page,
    limit: query.limit,
  };
}
