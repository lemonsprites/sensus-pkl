import type { BarangLamaWhereInput } from "../generated/prisma/models.js";
import { prisma } from "../lib/prisma.js";
import type { RoomAssetsQuery, SensusUpsertInput } from "../schemas/sensus.js";
import { ApiError } from "../utils/apiError.js";

const SENSUS_SELECT = {
  id: true,
  status: true,
  jumlahFisik: true,
  kondisi: true,
  statusMatch: true,
  isTemuanBaru: true,
  docsComplete: true,
  docsNote: true,
  labelAppliedAt: true,
  catatan: true,
  diverifikasiAt: true,
  updatedAt: true,
  diinputOleh: { select: { id: true, nama: true } },
  diverifikasiOleh: { select: { id: true, nama: true } },
} as const;

const ASSET_SELECT = {
  id: true,
  kodeRegister: true,
  kodeBarang: true,
  kodeSiman: true,
  nama: true,
  kategori: true,
  merk: true,
  noSeri: true,
  tahun: true,
  nilaiPerolehan: true,
  lokasiSiman: true,
  kondisiSiman: true,
  statusAset: true,
  ruangId: true,
  parentAsetId: true,
  syncStatus: true,
  sensus: { select: SENSUS_SELECT },
} as const;

export interface Actor {
  id: string;
}

/** Pohon bangunan → ruang (termasuk ruang virtual) untuk halaman /hierarki. */
export async function getHierarchy() {
  const [buildings, tanah] = await Promise.all([
    prisma.barangLama.findMany({
      where: {
        OR: [
          { kodeBarang: { startsWith: "4" } },
          { kategori: { contains: "BANGUNAN", mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        kodeBarang: true,
        kodeSiman: true,
        kodeRegister: true,
        nama: true,
        kategori: true,
        sensus: { select: SENSUS_SELECT },
        ruangAnak: {
          select: {
            id: true,
            kode: true,
            kodeRegister: true,
            nama: true,
            tipeRuang: true,
            luas: true,
            lantai: true,
            urutan: true,
            _count: { select: { aset: true, sensus: true } },
          },
          orderBy: [{ lantai: "asc" }, { urutan: "asc" }, { kode: "asc" }],
        },
      },
      orderBy: { nama: "asc" },
    }),
    prisma.barangLama.findMany({
      where: { kodeBarang: { startsWith: "2" } },
      select: {
        id: true,
        kodeBarang: true,
        kodeSiman: true,
        kodeRegister: true,
        nama: true,
        kategori: true,
        sensus: { select: SENSUS_SELECT },
      },
      orderBy: { nama: "asc" },
    }),
  ]);

  const mappedBuildings = buildings.map((building) => ({
    id: building.id,
    kodeBarang: building.kodeBarang,
    kodeSiman: building.kodeSiman,
    kodeRegister: building.kodeRegister,
    nama: building.nama,
    kategori: building.kategori,
    sensus: building.sensus,
    ruang: building.ruangAnak.map((room) => ({
      id: room.id,
      kode: room.kode,
      kodeRegister: room.kodeRegister,
      nama: room.nama,
      tipeRuang: room.tipeRuang,
      luas: room.luas,
      lantai: room.lantai,
      urutan: room.urutan,
      jumlahAset: room._count.aset,
      jumlahSensus: room._count.sensus,
    })),
  }));

  const totalRuang = mappedBuildings.reduce((sum, building) => sum + building.ruang.length, 0);
  const totalAsetRuang = mappedBuildings.reduce(
    (sum, building) => sum + building.ruang.reduce((n, room) => n + room.jumlahAset, 0),
    0,
  );

  return {
    buildings: mappedBuildings,
    tanah,
    total: {
      bangunan: mappedBuildings.length,
      ruang: totalRuang,
      asetDiRuang: totalAsetRuang,
      tanah: tanah.length,
    },
  };
}

export async function getRuangWithAssets(ruangId: string, query: RoomAssetsQuery) {
  const room = await prisma.ruang.findUnique({
    where: { id: ruangId },
    select: {
      id: true,
      kode: true,
      kodeRegister: true,
      nama: true,
      tipeRuang: true,
      luas: true,
      lantai: true,
      urutan: true,
      bangunanAsetId: true,
      bangunanAset: { select: ASSET_SELECT },
      _count: { select: { aset: true, sensus: true } },
    },
  });

  if (!room) throw ApiError.notFound("Ruang tidak ditemukan");

  const where: BarangLamaWhereInput = { ruangId };

  if (query.q) {
    where.OR = [
      { nama: { contains: query.q, mode: "insensitive" } },
      { kodeRegister: { contains: query.q, mode: "insensitive" } },
      { kodeSiman: { contains: query.q, mode: "insensitive" } },
      { kodeBarang: { contains: query.q, mode: "insensitive" } },
    ];
  }

  if (query.status === "BELUM") where.sensus = { is: null };
  if (query.status === "SUDAH") where.sensus = { isNot: null };

  const [items, total] = await prisma.$transaction([
    prisma.barangLama.findMany({
      where,
      select: ASSET_SELECT,
      orderBy: [{ nama: "asc" }, { id: "asc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.barangLama.count({ where }),
  ]);

  const { bangunanAset, ...roomInfo } = room;

  return {
    ruang: roomInfo,
    gedung: bangunanAset,
    items,
    total,
    page: query.page,
    limit: query.limit,
  };
}

function historyValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

/** Upsert sensus per aset. Edit setelah VALIDATED/DOCS_COMPLETE → reset ASSESSED + EditHistory. */
export async function upsertSensus(actorId: string, barangLamaId: string, input: SensusUpsertInput) {
  const asset = await prisma.barangLama.findUnique({
    where: { id: barangLamaId },
    select: { id: true, nama: true, ruangId: true },
  });
  if (!asset) throw ApiError.notFound("Aset tidak ditemukan");

  const existing = await prisma.sensus.findUnique({
    where: { barangLamaId },
    select: {
      id: true,
      status: true,
      jumlahFisik: true,
      kondisi: true,
      statusMatch: true,
      isTemuanBaru: true,
      docsNote: true,
      catatan: true,
      docsComplete: true,
      diverifikasiOlehId: true,
      diverifikasiAt: true,
    },
  });

  const reset = existing?.status === "VALIDATED" || existing?.status === "DOCS_COMPLETE";
  const nextStatus = reset ? "ASSESSED" : input.status;

  const jumlahFisik =
    input.jumlahFisik !== undefined ? input.jumlahFisik : (existing?.jumlahFisik ?? null);
  const kondisi = input.kondisi !== undefined ? input.kondisi : (existing?.kondisi ?? null);
  const docsNote =
    input.docsNote !== undefined
      ? input.docsNote
      : nextStatus === "TIDAK_DITEMUKAN"
        ? (existing?.docsNote ?? null)
        : null;
  const catatan = input.catatan !== undefined ? input.catatan : (existing?.catatan ?? null);
  const isTemuanBaru = input.isTemuanBaru ?? existing?.isTemuanBaru ?? false;
  const statusMatch =
    isTemuanBaru || input.statusMatch === "TEMUAN_BARU"
      ? "TEMUAN_BARU"
      : input.statusMatch !== undefined
        ? input.statusMatch
        : (existing?.statusMatch ?? null);

  if (nextStatus === "ASSESSED" && (jumlahFisik === null || kondisi === null)) {
    throw ApiError.badRequest("Jumlah fisik dan kondisi wajib diisi untuk status ASSESSED");
  }
  if (nextStatus === "TIDAK_DITEMUKAN" && (!docsNote || docsNote.trim() === "")) {
    throw ApiError.badRequest("Catatan dokumen (docsNote) wajib diisi untuk TIDAK_DITEMUKAN");
  }

  const data = {
    status: nextStatus,
    jumlahFisik,
    kondisi,
    statusMatch,
    isTemuanBaru: isTemuanBaru || statusMatch === "TEMUAN_BARU",
    docsNote,
    catatan,
    ruangId: asset.ruangId,
    diinputOlehId: actorId,
    ...(reset
      ? { docsComplete: false, diverifikasiOlehId: null, diverifikasiAt: null }
      : {}),
  };

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.sensus.upsert({
      where: { barangLamaId },
      update: data,
      create: { barangLamaId, ...data },
      select: SENSUS_SELECT,
    });

    if (reset && existing) {
      const changes: Array<[string, unknown, unknown]> = [
        ["status", existing.status, data.status],
        ["jumlahFisik", existing.jumlahFisik, data.jumlahFisik],
        ["kondisi", existing.kondisi, data.kondisi],
        ["statusMatch", existing.statusMatch, data.statusMatch],
        ["isTemuanBaru", existing.isTemuanBaru, data.isTemuanBaru],
        ["docsNote", existing.docsNote, data.docsNote],
        ["catatan", existing.catatan, data.catatan],
      ];

      for (const [field, before, after] of changes) {
        if (historyValue(before) === historyValue(after)) continue;
        await tx.editHistory.create({
          data: {
            sensusId: updated.id,
            olehId: actorId,
            field,
            nilaiLama: historyValue(before),
            nilaiBaru: historyValue(after),
          },
        });
      }
    }

    return updated;
  }, { timeout: 30_000 });

  return { sensus: result, asset: { id: asset.id, nama: asset.nama } };
}
