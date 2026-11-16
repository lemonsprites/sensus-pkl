import { config } from "../lib/config.js";
import { prisma } from "../lib/prisma.js";
import type { LabelQuery } from "../schemas/label.js";
import { ApiError } from "../utils/apiError.js";

const LABEL_SELECT = {
  id: true,
  status: true,
  isTemuanBaru: true,
  labelPrintedAt: true,
  labelAppliedAt: true,
  masterAset: {
    select: {
      id: true, kodeRegister: true, kodeBarang: true, kodeSiman: true,
      nama: true, kategori: true, kodeSatker: true, statusAset: true,
    },
  },
  ruang: {
    select: {
      kode: true, nama: true, lantai: true,
      bangunanAset: { select: { nama: true } },
    },
  },
  grup: { select: { id: true, kodeBarang: true, namaBarang: true, kondisi: true, jumlah: true } },
} as const;

type LabelRow = {
  id: string;
  status: string;
  isTemuanBaru: boolean;
  labelPrintedAt: Date | null;
  labelAppliedAt: Date | null;
  masterAset: {
    id: string; kodeRegister: string | null; kodeBarang: string | null;
    kodeSiman: string | null; nama: string; kategori: string | null;
    kodeSatker: string | null; statusAset: string | null;
  };
  ruang: {
    kode: string; nama: string; lantai: number; bangunanAset: { nama: string };
  } | null;
  grup: { id: string } | null;
};

export function evaluateGate(row: LabelRow): string[] {
  const asset = row.masterAset;
  const reasons: string[] = [];
  if (row.status !== "VALIDATED") reasons.push("Status sensus belum VALIDATED");
  if (row.isTemuanBaru) reasons.push("Temuan baru tidak boleh dilabeli");
  if (!asset.kodeRegister) reasons.push("Kode Register kosong");
  if (!asset.kodeSiman) reasons.push("NUP kosong");
  if (!asset.kodeBarang) reasons.push("Kode Barang kosong");
  if (!asset.statusAset || !asset.statusAset.toLowerCase().includes("aktif")) {
    reasons.push("Status BMN bukan Aktif");
  }
  if (config.SATKER_KODE && asset.kodeSatker !== config.SATKER_KODE) {
    reasons.push("Kode Satker tidak cocok");
  }
  return reasons;
}

function toLabel(row: LabelRow) {
  const asset = row.masterAset;
  return {
    sensusId: row.id,
    masterAsetId: asset.id,
    nama: asset.nama,
    kodeBarang: asset.kodeBarang,
    kodeSiman: asset.kodeSiman,
    kodeRegister: asset.kodeRegister,
    kategori: asset.kategori,
    kodeSatker: asset.kodeSatker,
    statusAset: asset.statusAset,
    gedung: row.ruang?.bangunanAset.nama ?? null,
    ruang: row.ruang ? `${row.ruang.nama} (${row.ruang.kode})` : null,
    lantai: row.ruang?.lantai ?? null,
    grupId: row.grup?.id ?? null,
    printedAt: row.labelPrintedAt?.toISOString() ?? null,
    appliedAt: row.labelAppliedAt?.toISOString() ?? null,
    qrContent: asset.kodeRegister,
  };
}

export async function getEligible(query: LabelQuery) {
  const where = {
    status: "VALIDATED" as const,
    labelPrintedAt: null,
    isTemuanBaru: false,
    ...(query.q
      ? {
          masterAset: {
            OR: [
              { nama: { contains: query.q, mode: "insensitive" as const } },
              { kodeRegister: { contains: query.q, mode: "insensitive" as const } },
              { kodeSiman: { contains: query.q, mode: "insensitive" as const } },
              { kodeBarang: { contains: query.q, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
  };

  const rows = (await prisma.sensus.findMany({
    where,
    select: LABEL_SELECT,
    orderBy: { updatedAt: "desc" },
  })) as LabelRow[];

  const eligible = rows.filter((row) => evaluateGate(row).length === 0);
  const start = (query.page - 1) * query.limit;
  return {
    items: eligible.slice(start, start + query.limit).map(toLabel),
    total: eligible.length,
    page: query.page,
    limit: query.limit,
  };
}

export async function printLabels(ids: string[]) {
  const rows = (await prisma.sensus.findMany({
    where: { id: { in: ids }, status: "VALIDATED", labelPrintedAt: null },
    select: LABEL_SELECT,
  })) as LabelRow[];

  const valid = rows.filter((row) => evaluateGate(row).length === 0);
  if (valid.length === 0) throw ApiError.badRequest("Tidak ada label yang lolos gate");

  await prisma.sensus.updateMany({
    where: { id: { in: valid.map((row) => row.id) } },
    data: { labelPrintedAt: new Date() },
  });

  return { printed: valid.length, labels: valid.map(toLabel) };
}

export async function applyLabels(ids: string[]) {
  const result = await prisma.sensus.updateMany({
    where: { id: { in: ids }, labelPrintedAt: { not: null }, labelAppliedAt: null },
    data: { labelAppliedAt: new Date() },
  });
  return { applied: result.count };
}

export async function scanLabel(kodeRegister: string) {
  const asset = await prisma.masterAset.findUnique({
    where: { kodeRegister: kodeRegister.trim().toUpperCase() },
    select: {
      id: true, kodeRegister: true, kodeBarang: true, kodeSiman: true,
      nama: true, kategori: true, kodeSatker: true, statusAset: true, syncStatus: true,
      sensus: {
        select: {
          id: true, status: true, jumlahFisik: true, kondisi: true, statusMatch: true,
          isTemuanBaru: true, docsComplete: true, labelPrintedAt: true, labelAppliedAt: true,
          catatan: true, diverifikasiAt: true,
          ruang: { select: { kode: true, nama: true, lantai: true, bangunanAset: { select: { nama: true } } } },
          grup: { select: { id: true, kondisi: true, jumlah: true } },
        },
      },
    },
  });
  if (!asset) throw ApiError.notFound("Kode Register tidak ditemukan");

  const gate = asset.sensus
    ? evaluateGate({
        id: asset.sensus.id,
        status: asset.sensus.status,
        isTemuanBaru: asset.sensus.isTemuanBaru,
        labelPrintedAt: asset.sensus.labelPrintedAt,
        labelAppliedAt: asset.sensus.labelAppliedAt,
        masterAset: {
          id: asset.id, kodeRegister: asset.kodeRegister, kodeBarang: asset.kodeBarang,
          kodeSiman: asset.kodeSiman, nama: asset.nama, kategori: asset.kategori,
          kodeSatker: asset.kodeSatker, statusAset: asset.statusAset,
        },
        ruang: asset.sensus.ruang,
        grup: asset.sensus.grup,
      })
    : ["Aset belum disensus"];

  return {
    asset: {
      ...asset,
      sensus: asset.sensus
        ? { ...asset.sensus, ruang: asset.sensus.ruang }
        : null,
    },
    gate: { ok: gate.length === 0, reasons: gate },
  };
}
