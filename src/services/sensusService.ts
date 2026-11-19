import { logActivity } from "./activityService.js";
import { config } from "../lib/config.js";
import { prisma } from "../lib/prisma.js";
import type {
  CreateSensusGrupInput,
  KandidatQuery,
  UpdateSensusGrupInput,
} from "../schemas/sensus.js";
import { ApiError } from "../utils/apiError.js";

const SENSUS_ROW_SELECT = {
  id: true,
  grupId: true,
  status: true,
  jumlahFisik: true,
  kondisi: true,
  statusMatch: true,
  isTemuanBaru: true,
  docsComplete: true,
  docsNote: true,
  labelPrintedAt: true,
  labelAppliedAt: true,
  catatan: true,
  diverifikasiAt: true,
  updatedAt: true,
  masterAset: {
    select: {
      id: true,
      kodeRegister: true,
      kodeBarang: true,
      kodeSiman: true,
      nama: true,
      kategori: true,
      statusAset: true,
    },
  },
  diinputOleh: { select: { id: true, nama: true } },
  diverifikasiOleh: { select: { id: true, nama: true } },
} as const;

const GROUP_SELECT = {
  id: true,
  ruangId: true,
  kodeBarang: true,
  namaBarang: true,
  kondisi: true,
  jumlah: true,
  status: true,
  docsComplete: true,
  catatan: true,
  catatanOtomatis: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, nama: true } },
  updatedBy: { select: { id: true, nama: true } },
  sensus: { select: SENSUS_ROW_SELECT, orderBy: { createdAt: "asc" as const } },
} as const;

const MASTER_SELECT = {
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
  kondisiSiman: true,
  statusAset: true,
  syncStatus: true,
  sensus: { select: SENSUS_ROW_SELECT },
} as const;

export interface Actor {
  id: string;
}

export async function getHierarchy() {
  const [buildings, tanah] = await Promise.all([
    prisma.masterAset.findMany({
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
        sensus: { select: SENSUS_ROW_SELECT },
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
            _count: { select: { sensus: true, grup: true } },
          },
          orderBy: [{ lantai: "asc" }, { urutan: "asc" }, { kode: "asc" }],
        },
      },
      orderBy: { nama: "asc" },
    }),
    prisma.masterAset.findMany({
      where: { kodeBarang: { startsWith: "2" } },
      select: {
        id: true,
        kodeBarang: true,
        kodeSiman: true,
        kodeRegister: true,
        nama: true,
        kategori: true,
        sensus: { select: SENSUS_ROW_SELECT },
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
      jumlahGrup: room._count.grup,
      jumlahNup: room._count.sensus,
    })),
  }));

  return {
    buildings: mappedBuildings,
    tanah,
    total: {
      bangunan: mappedBuildings.length,
      ruang: mappedBuildings.reduce((sum, building) => sum + building.ruang.length, 0),
      nupDisensus: mappedBuildings.reduce(
        (sum, building) => sum + building.ruang.reduce((n, room) => n + room.jumlahNup, 0),
        0,
      ),
      tanah: tanah.length,
    },
  };
}

export async function getRuangData(ruangId: string) {
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
      bangunanAset: { select: MASTER_SELECT },
      grup: { select: GROUP_SELECT, orderBy: { createdAt: "desc" } },
      sensus: { select: SENSUS_ROW_SELECT, orderBy: { createdAt: "asc" } },
      _count: { select: { sensus: true, grup: true } },
    },
  });
  if (!room) throw ApiError.notFound("Ruang tidak ditemukan");

  const { bangunanAset, ...ruang } = room;
  return { ruang, gedung: bangunanAset, groups: room.grup, items: room.sensus };
}

/** Kandidat kodeBarang dengan NUP yang belum disensus, dihitung global. */
export async function getKandidat(query: KandidatQuery) {
  const assets = await prisma.masterAset.findMany({
    where: {
      kodeBarang: { not: null },
      statusAset: { contains: "aktif", mode: "insensitive" },
      ...(config.SATKER_KODE ? { kodeSatker: config.SATKER_KODE } : {}),
      sensus: { is: null },
      ...(query.q
        ? {
            OR: [
              { nama: { contains: query.q, mode: "insensitive" as const } },
              { kodeBarang: { contains: query.q, mode: "insensitive" as const } },
              { kodeRegister: { contains: query.q, mode: "insensitive" as const } },
              { kodeSiman: { contains: query.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: { kodeBarang: true, nama: true, kategori: true },
  });

  const map = new Map<string, { kodeBarang: string; nama: string; kategori: string | null; tersedia: number }>();
  for (const asset of assets) {
    const kode = asset.kodeBarang;
    if (!kode) continue;
    const current = map.get(kode);
    if (current) current.tersedia += 1;
    else map.set(kode, { kodeBarang: kode, nama: asset.nama, kategori: asset.kategori, tersedia: 1 });
  }

  return {
    items: [...map.values()].sort((a, b) => b.tersedia - a.tersedia || a.nama.localeCompare(b.nama)),
    total: map.size,
  };
}

export async function createSensusGrup(
  actorId: string,
  ruangId: string,
  input: CreateSensusGrupInput,
) {
  const room = await prisma.ruang.findUnique({
    where: { id: ruangId },
    select: { id: true, nama: true, kode: true },
  });
  if (!room) throw ApiError.notFound("Ruang tidak ditemukan");

  const satker = config.SATKER_KODE ?? "";

  const groups = await prisma.$transaction(
    async (tx) => {
      const created = [];

      for (const row of input.rows) {
        const available = await tx.$queryRaw<Array<{ id: string; nama: string; kodeSiman: string | null }>>`
          SELECT id, nama, "kodeSiman"
          FROM "MasterAset"
          WHERE "kodeBarang" = ${row.kodeBarang}
            AND "statusAset" ILIKE '%aktif%'
            AND (${satker}::text = '' OR "kodeSatker" = ${satker})
            AND NOT EXISTS (SELECT 1 FROM "Sensus" s WHERE s."masterAsetId" = "MasterAset".id)
          ORDER BY COALESCE(NULLIF(regexp_replace(COALESCE("kodeSiman", ''), '[^0-9]', '', 'g'), ''), '0')::int DESC,
                   "kodeSiman" DESC
          LIMIT ${row.jumlah}
          FOR UPDATE SKIP LOCKED
        `;

        if (available.length < row.jumlah) {
          throw ApiError.badRequest(
            `NUP tidak mencukupi untuk ${row.kodeBarang}: diminta ${row.jumlah}, tersedia ${available.length}, kurang ${row.jumlah - available.length}.`,
            {
              kodeBarang: row.kodeBarang,
              diminta: row.jumlah,
              tersedia: available.length,
              kurang: row.jumlah - available.length,
            },
          );
        }

        const namaBarang = available[0]?.nama ?? row.kodeBarang;
        const group = await tx.sensusGrup.create({
          data: {
            ruangId,
            kodeBarang: row.kodeBarang,
            namaBarang,
            kondisi: row.kondisi,
            jumlah: row.jumlah,
            status: "ASSESSED",
            catatan: row.catatan ?? null,
            createdById: actorId,
            sensus: {
              create: available.map((asset) => ({
                masterAsetId: asset.id,
                ruangId,
                status: "ASSESSED" as const,
                jumlahFisik: 1,
                kondisi: row.kondisi,
                statusMatch: "COCOK" as const,
                diinputOlehId: actorId,
              })),
            },
          },
          select: GROUP_SELECT,
        });

        const sisa = await tx.masterAset.count({
          where: {
            kodeBarang: row.kodeBarang,
            statusAset: { contains: "aktif", mode: "insensitive" },
            ...(config.SATKER_KODE ? { kodeSatker: config.SATKER_KODE } : {}),
            sensus: { is: null },
          },
        });
        if (sisa > 0) {
          await tx.sensusGrup.update({
            where: { id: group.id },
            data: { catatanOtomatis: `Sisa NUP tersedia: ${sisa}` },
          });
        }
        created.push(group);
      }

      return created;
    },
    { timeout: 60_000, maxWait: 10_000 },
  );

  for (const group of groups) {
    await logActivity({
      actorId,
      action: "GROUP_CREATE",
      entityType: "SENSUS_GRUP",
      entityId: group.id,
      summary: `${group.namaBarang} ${group.jumlah} unit (${group.kondisi}) di ${room.nama} (${room.kode})`,
      metadata: {
        kodeBarang: group.kodeBarang,
        jumlah: group.jumlah,
        kondisi: group.kondisi,
        nup: group.sensus.map((row) => row.masterAset.kodeSiman),
      },
    });
  }

  return { groups };
}

export async function updateSensusGrup(actorId: string, grupId: string, input: UpdateSensusGrupInput) {
  const group = await prisma.sensusGrup.findUnique({
    where: { id: grupId },
    select: {
      id: true,
      status: true,
      kodeBarang: true,
      namaBarang: true,
      jumlah: true,
      kondisi: true,
      catatan: true,
      sensus: { select: { id: true, labelPrintedAt: true, diverifikasiAt: true } },
    },
  });
  if (!group) throw ApiError.notFound("Grup sensus tidak ditemukan");
  if (
    group.status === "VALIDATED" ||
    group.sensus.some((row) => row.labelPrintedAt || row.diverifikasiAt)
  ) {
    throw ApiError.conflict("Grup sudah divalidasi/dilabeli, tidak bisa diubah");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.sensusGrup.update({
      where: { id: grupId },
      data: {
        ...(input.kondisi ? { kondisi: input.kondisi } : {}),
        ...(input.catatan !== undefined ? { catatan: input.catatan } : {}),
        updatedById: actorId,
      },
      select: GROUP_SELECT,
    });
    if (input.kondisi) {
      await tx.sensus.updateMany({ where: { grupId }, data: { kondisi: input.kondisi } });
    }
    return result;
  });

  await logActivity({
    actorId,
    action: "GROUP_UPDATE",
    entityType: "SENSUS_GRUP",
    entityId: grupId,
    summary: `Koreksi ${group.namaBarang} (${group.jumlah} unit)`,
    metadata: {
      before: { kondisi: group.kondisi, catatan: group.catatan },
      after: { kondisi: input.kondisi ?? group.kondisi, catatan: input.catatan ?? group.catatan },
    },
  });

  return { group: updated };
}

export async function deleteSensusGrup(actor: { id: string; role: string }, grupId: string) {
  const group = await prisma.sensusGrup.findUnique({
    where: { id: grupId },
    select: {
      id: true,
      status: true,
      createdById: true,
      kodeBarang: true,
      namaBarang: true,
      kondisi: true,
      jumlah: true,
      sensus: { select: { id: true, labelPrintedAt: true, labelAppliedAt: true, diverifikasiAt: true } },
    },
  });
  if (!group) throw ApiError.notFound("Grup sensus tidak ditemukan");
  if (actor.role !== "ADMIN" && actor.role !== "SUPERADMIN" && group.createdById !== actor.id) {
    throw ApiError.forbidden("Hanya pembuat grup atau ADMIN yang boleh menghapus");
  }
  if (
    group.status === "VALIDATED" ||
    group.sensus.some((row) => row.labelPrintedAt || row.labelAppliedAt || row.diverifikasiAt)
  ) {
    throw ApiError.conflict("Grup sudah divalidasi/dilabeli, tidak bisa dihapus");
  }

  await prisma.$transaction(async (tx) => {
    await tx.sensus.deleteMany({ where: { grupId } });
    await tx.sensusGrup.delete({ where: { id: grupId } });
  });
  await logActivity({
    actorId: actor.id,
    action: "GROUP_DELETE",
    entityType: "SENSUS_GRUP",
    entityId: grupId,
    summary: `Hapus ${group.namaBarang} ${group.jumlah} unit (${group.kondisi})`,
    metadata: { kodeBarang: group.kodeBarang, nup: group.sensus.map((row) => row.id) },
  });

  return { deleted: true };
}

export async function verifySensusGrup(actorId: string, grupId: string) {
  const group = await prisma.sensusGrup.findUnique({
    where: { id: grupId },
    select: { id: true, status: true },
  });
  if (!group) throw ApiError.notFound("Grup sensus tidak ditemukan");
  if (group.status !== "DOCS_COMPLETE") {
    throw ApiError.conflict("Hanya grup DOCS_COMPLETE yang bisa diverifikasi");
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    await tx.sensus.updateMany({
      where: { grupId },
      data: {
        status: "VALIDATED",
        diverifikasiOlehId: actorId,
        diverifikasiAt: now,
      },
    });
    return tx.sensusGrup.update({
      where: { id: grupId },
      data: { status: "VALIDATED", docsComplete: true },
      select: GROUP_SELECT,
    });
  });

  await logActivity({
    actorId,
    action: "VERIFY",
    entityType: "SENSUS_GRUP",
    entityId: grupId,
    summary: `Validasi grup ${updated.namaBarang} (${updated.jumlah} unit)`,
    metadata: { nup: updated.sensus.map((row) => row.masterAset.kodeSiman) },
  });

  return { group: updated };
}

export async function rejectSensusGrup(actorId: string, grupId: string, catatan: string) {
  const group = await prisma.sensusGrup.findUnique({
    where: { id: grupId },
    select: { id: true, status: true, sensus: { select: { id: true } } },
  });
  if (!group) throw ApiError.notFound("Grup sensus tidak ditemukan");
  if (group.status !== "VALIDATED" && group.status !== "DOCS_COMPLETE") {
    throw ApiError.conflict("Grup belum siap diverifikasi/ditolak");
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.sensus.updateMany({
      where: { grupId },
      data: {
        status: "ASSESSED",
        docsComplete: false,
        diverifikasiOlehId: null,
        diverifikasiAt: null,
      },
    });
    for (const row of group.sensus) {
      await tx.editHistory.create({
        data: {
          sensusId: row.id,
          olehId: actorId,
          field: "verifikasi",
          nilaiLama: group.status,
          nilaiBaru: `DITOLAK: ${catatan}`,
        },
      });
    }
    return tx.sensusGrup.update({
      where: { id: grupId },
      data: { status: "ASSESSED", docsComplete: false },
      select: GROUP_SELECT,
    });
  });

  await logActivity({
    actorId,
    action: "REJECT",
    entityType: "SENSUS_GRUP",
    entityId: grupId,
    summary: `Tolak grup ${updated.namaBarang} (${updated.jumlah} unit)`,
    metadata: { catatan, nup: updated.sensus.map((row) => row.masterAset.kodeSiman) },
  });

  return { group: updated };
}
