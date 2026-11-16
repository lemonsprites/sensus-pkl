/** M3b — seed 65 Ruang dari data/ruangan.csv. Tidak ada mapping aset. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "csv-parse/sync";

import { prisma } from "../src/lib/prisma.js";

interface RoomCsvRow {
  bangunan: string;
  nup: string;
  kode_ruangan: string;
  tipe_ruangan: string;
  nama_ruangan: string;
  kode_register: string;
  lantai: string;
  urutan: string;
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/bangunan|gedung|permanen/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main(): Promise<void> {
  const rooms = parse(readFileSync(resolve(process.cwd(), "data/ruangan.csv"), "utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as RoomCsvRow[];

  const buildings = await prisma.masterAset.findMany({
    where: {
      OR: [
        { kodeBarang: { startsWith: "4" } },
        { kategori: { contains: "BANGUNAN", mode: "insensitive" } },
      ],
    },
    select: { id: true, kodeBarang: true, kodeSiman: true, nama: true },
  });

  const byKey = new Map<string, (typeof buildings)[number]>();
  const byNup = new Map<string, Array<(typeof buildings)[number]>>();
  for (const building of buildings) {
    const nup = building.kodeSiman ?? "";
    byKey.set(`${nup}|${normalizeName(building.nama)}`, building);
    byNup.set(nup, [...(byNup.get(nup) ?? []), building]);
  }

  const groups = new Map<string, { bangunan: string; nup: string; rows: RoomCsvRow[]; building?: (typeof buildings)[number] }>();
  for (const room of rooms) {
    const key = `${room.nup}|${room.bangunan}`;
    const group = groups.get(key) ?? { bangunan: room.bangunan, nup: room.nup, rows: [] };
    group.rows.push(room);
    groups.set(key, group);
  }

  const unmatched: string[] = [];
  for (const group of groups.values()) {
    group.building =
      byKey.get(`${group.nup}|${normalizeName(group.bangunan)}`) ??
      (byNup.get(group.nup)?.length === 1 ? byNup.get(group.nup)?.[0] : undefined);
    if (!group.building) unmatched.push(`${group.bangunan} (NUP ${group.nup})`);
  }
  if (unmatched.length > 0) {
    throw new Error(`Bangunan tidak cocok: ${unmatched.join(", ")}`);
  }

  let created = 0;
  let updated = 0;
  await prisma.$transaction(async (tx) => {
    for (const group of groups.values()) {
      if (!group.building) continue;
      for (const room of group.rows) {
        const kode = room.kode_ruangan.trim();
        const data = {
          kodeRegister: room.kode_register.trim() || null,
          nama: room.nama_ruangan.trim() || room.tipe_ruangan.trim() || kode,
          tipeRuang: room.tipe_ruangan.trim() || null,
          lantai: Number.parseInt(room.lantai, 10) || 1,
          urutan: Number.parseInt(room.urutan, 10) || 0,
          bangunanAsetId: group.building.id,
        };
        const existing = await tx.ruang.findUnique({ where: { kode }, select: { id: true } });
        if (existing) {
          await tx.ruang.update({ where: { kode }, data });
          updated += 1;
        } else {
          await tx.ruang.create({ data: { kode, ...data } });
          created += 1;
        }
      }
    }
  }, { timeout: 120_000 });

  // Bersihkan ruang virtual lama (jika ada) yang tidak punya sensus/grup.
  const virtual = await prisma.ruang.findMany({
    where: { tipeRuang: "TANPA RUANGAN" },
    select: { id: true },
  });
  if (virtual.length > 0) {
    const deleted = await prisma.ruang.deleteMany({
      where: { id: { in: virtual.map((room) => room.id) }, sensus: { none: {} }, grup: { none: {} } },
    });
    if (deleted.count > 0) console.log(`[seed:ruang] ruang virtual lama dihapus=${deleted.count}`);
  }

  console.log(`[seed:ruang] ${rooms.length} ruangan; dibuat=${created}, diperbarui=${updated}; total ruang=${await prisma.ruang.count()}`);
}

main()
  .catch((error) => {
    console.error("[seed:ruang] GAGAL:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
