/**
 * M3b — seeding Ruang dari data/ruangan.csv (turunan ruangan.xlsx).
 *
 * - Bangunan dicari di BarangLama berdasarkan (NUP, nama ternormalisasi),
 *   fallback NUP unik. Nama "Gedung Pos Jaga" vs "Gedung Pos Jaga Permanen"
 *   cocok setelah normalisasi.
 * - Idempoten: UPSERT by Ruang.kode.
 * - Setelah ruang dibuat, aset dengan lokasiSiman berisi kode ruang dipetakan
 *   ke ruangId (hanya yang ruangId-nya masih null, agar tidak menimpa manual).
 *
 * Jalankan:
 *   npm run seed:ruang            (tulis)
 *   npm run seed:ruang -- --dry-run
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "csv-parse/sync";

import { config } from "../src/lib/config.js";
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
  sumber_baris: string;
}

const dryRun = process.argv.includes("--dry-run");

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/bangunan|gedung|permanen/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function loadRooms(): RoomCsvRow[] {
  const path = resolve(process.cwd(), "data/ruangan.csv");
  const text = readFileSync(path, "utf8");
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as RoomCsvRow[];
}

async function main(): Promise<void> {
  const rooms = loadRooms();
  if (rooms.length === 0) throw new Error("data/ruangan.csv kosong");

  const buildings = await prisma.barangLama.findMany({
    where: {
      OR: [
        { kodeBarang: { startsWith: "4" } },
        { kategori: { contains: "BANGUNAN", mode: "insensitive" } },
      ],
    },
    select: { id: true, kodeBarang: true, kodeSiman: true, nama: true, kodeRegister: true },
  });

  const byNameAndNup = new Map<string, (typeof buildings)[number]>();
  const byNup = new Map<string, Array<(typeof buildings)[number]>>();
  for (const building of buildings) {
    const nup = building.kodeSiman ?? "";
    byNameAndNup.set(`${nup}|${normalizeName(building.nama)}`, building);
    byNup.set(nup, [...(byNup.get(nup) ?? []), building]);
  }

  const groups = new Map<
    string,
    { bangunan: string; nup: string; rows: RoomCsvRow[]; building?: (typeof buildings)[number] }
  >();
  for (const room of rooms) {
    const key = `${room.nup}|${room.bangunan}`;
    const group = groups.get(key) ?? { bangunan: room.bangunan, nup: room.nup, rows: [] };
    group.rows.push(room);
    groups.set(key, group);
  }

  const unmatched: string[] = [];
  for (const group of groups.values()) {
    const exact = byNameAndNup.get(`${group.nup}|${normalizeName(group.bangunan)}`);
    if (exact) {
      group.building = exact;
      continue;
    }
    const candidates = byNup.get(group.nup) ?? [];
    if (candidates.length === 1) {
      group.building = candidates[0];
      continue;
    }
    unmatched.push(`${group.bangunan} (NUP ${group.nup})`);
  }

  if (unmatched.length > 0) {
    throw new Error(
      `Bangunan tidak bisa dipetakan untuk ${unmatched.length} grup:\n- ${unmatched.join("\n- ")}\n` +
        "Pastikan import SIMAN (M3) sudah di-commit dan nama/NUP bangunan cocok.",
    );
  }

  console.log(`[seed:ruang] ${rooms.length} ruangan, ${groups.size} grup bangunan, mode=${dryRun ? "dry-run" : "tulis"}`);
  for (const group of groups.values()) {
    console.log(
      `  ${group.bangunan} NUP ${group.nup} → ${group.building?.kodeBarang} / ${group.building?.nama} (${group.rows.length} ruang)`,
    );
  }

  if (dryRun) {
    console.log(
      `[seed:ruang] dry-run: akan membuat/memperbarui ${groups.size} ruang virtual per gedung + 1 fallback TANPA.00.00.00.`,
    );
    console.log("[seed:ruang] dry-run selesai — tidak ada perubahan.");
    return;
  }

  let created = 0;
  let updated = 0;
  let virtualCreated = 0;
  let virtualUpdated = 0;

  const desiredVirtualCodes = new Set<string>(["TANPA.00.00.00"]);
  for (const group of groups.values()) {
    const prefix = group.rows[0]?.kode_ruangan.split(".").slice(0, 2).join(".") ?? "";
    if (prefix) desiredVirtualCodes.add(`${prefix}.00.00`);
  }

  await prisma.$transaction(async (tx) => {
    for (const group of groups.values()) {
      const building = group.building;
      if (!building) continue;
      for (const room of group.rows) {
        const kode = room.kode_ruangan.trim();
        const data = {
          kodeRegister: room.kode_register.trim() || null,
          nama: room.nama_ruangan.trim() || room.tipe_ruangan.trim() || kode,
          tipeRuang: room.tipe_ruangan.trim() || null,
          lantai: Number.parseInt(room.lantai, 10) || 1,
          urutan: Number.parseInt(room.urutan, 10) || 0,
          bangunanAsetId: building.id,
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

    // Ruang virtual per gedung: {PREFIX}.00.00.00 → untuk aset di gedung itu
    // yang belum punya kode ruangan.
    for (const group of groups.values()) {
      const building = group.building;
      if (!building) continue;
      const prefix = group.rows[0]?.kode_ruangan.split(".").slice(0, 2).join(".") ?? "";
      if (!prefix) continue;
      const kode = `${prefix}.00.00`;
      const data = {
        kodeRegister: null,
        nama: "TANPA RUANGAN",
        tipeRuang: "TANPA RUANGAN",
        lantai: 0,
        urutan: 0,
        bangunanAsetId: building.id,
      };
      const existing = await tx.ruang.findUnique({ where: { kode }, select: { id: true } });
      if (existing) {
        await tx.ruang.update({ where: { kode }, data });
        virtualUpdated += 1;
      } else {
        await tx.ruang.create({ data: { kode, ...data } });
        virtualCreated += 1;
      }
    }

    // Fallback global: aset tanpa petunjuk gedung sama sekali (mayoritas 6xx).
    const fallbackBuilding = groups.values().next().value?.building;
    if (fallbackBuilding) {
      const kode = "TANPA.00.00.00";
      const data = {
        kodeRegister: null,
        nama: "TANPA RUANGAN (BELUM DITENTUKAN)",
        tipeRuang: "TANPA RUANGAN",
        lantai: 0,
        urutan: 0,
        bangunanAsetId: fallbackBuilding.id,
      };
      const existing = await tx.ruang.findUnique({ where: { kode }, select: { id: true } });
      if (existing) {
        await tx.ruang.update({ where: { kode }, data });
        virtualUpdated += 1;
      } else {
        await tx.ruang.create({ data: { kode, ...data } });
        virtualCreated += 1;
      }
    }
  }, { timeout: 120_000 });

  console.log(
    `[seed:ruang] Ruang dibuat=${created}, diperbarui=${updated}, virtual dibuat=${virtualCreated}, virtual diperbarui=${virtualUpdated}`,
  );

  // Bersihkan ruang virtual lama (mis. format 5 segmen) yang tidak dipakai lagi.
  const staleVirtual = await prisma.ruang.findMany({
    where: { tipeRuang: "TANPA RUANGAN", kode: { notIn: [...desiredVirtualCodes] } },
    select: { id: true, kode: true },
  });
  if (staleVirtual.length > 0) {
    const deleted = await prisma.ruang.deleteMany({
      where: {
        id: { in: staleVirtual.map((room) => room.id) },
        aset: { none: {} },
        sensus: { none: {} },
      },
    });
    if (deleted.count > 0) console.log(`[seed:ruang] Ruang virtual lama dihapus=${deleted.count}`);
  }

  // ── Mapping aset → ruangan berdasarkan Lokasi Ruang SIMAN ────────────────
  const roomRows = await prisma.ruang.findMany({ select: { id: true, kode: true } });
  const roomByCode = new Map(roomRows.map((room) => [room.kode.toUpperCase(), room.id]));

  const assets = await prisma.barangLama.findMany({
    where: {
      ruangId: null,
      lokasiSiman: { not: null },
      ...(config.SATKER_KODE ? { kodeSatker: config.SATKER_KODE } : {}),
    },
    select: { id: true, lokasiSiman: true },
  });

  const idsByRoom = new Map<string, string[]>();
  let tanpaKode = 0;
  let kodeTidakDikenal = 0;
  for (const asset of assets) {
    const first = (asset.lokasiSiman ?? "").split("|")[0]?.trim().toUpperCase() ?? "";
    if (!first || first.startsWith("XXX")) {
      tanpaKode += 1;
      continue;
    }
    const roomId = roomByCode.get(first);
    if (!roomId) {
      kodeTidakDikenal += 1;
      continue;
    }
    idsByRoom.set(roomId, [...(idsByRoom.get(roomId) ?? []), asset.id]);
  }

  let terpetakan = 0;
  for (const [roomId, ids] of idsByRoom) {
    for (let start = 0; start < ids.length; start += 1000) {
      const chunk = ids.slice(start, start + 1000);
      await prisma.barangLama.updateMany({ where: { id: { in: chunk } }, data: { ruangId: roomId } });
      terpetakan += chunk.length;
    }
  }

  // ── Fallback aset tanpa lokasi → TANPA RUANGAN global ──────────────────
  const fallbackRoom = await prisma.ruang.findUnique({
    where: { kode: "TANPA.00.00.00" },
    select: { id: true },
  });
  let fallbackMapped = 0;
  let tanahBangunanTanpaRuang = 0;
  if (fallbackRoom) {
    const sisa = await prisma.barangLama.findMany({
      where: {
        ruangId: null,
        ...(config.SATKER_KODE ? { kodeSatker: config.SATKER_KODE } : {}),
      },
      select: { id: true, kodeBarang: true },
    });
    const fallbackIds: string[] = [];
    for (const asset of sisa) {
      const prefix = (asset.kodeBarang ?? "").slice(0, 1);
      // Tanah (2xx) & bangunan (4xx) disensus di level gedung/tanah, bukan ruang.
      if (prefix === "2" || prefix === "4") {
        tanahBangunanTanpaRuang += 1;
        continue;
      }
      fallbackIds.push(asset.id);
    }

    for (let start = 0; start < fallbackIds.length; start += 1000) {
      const chunk = fallbackIds.slice(start, start + 1000);
      await prisma.barangLama.updateMany({
        where: { id: { in: chunk } },
        data: { ruangId: fallbackRoom.id },
      });
      fallbackMapped += chunk.length;
    }
  }

  const totalRuang = await prisma.ruang.count();
  const totalBangunan = await prisma.ruang.findMany({ distinct: ["bangunanAsetId"], select: { bangunanAsetId: true } });
  const asetTanpaRuang = await prisma.barangLama.count({ where: { ruangId: null } });

  console.log(
    `[seed:ruang] Aset ke ruang=${terpetakan}, fallback TANPA RUANGAN=${fallbackMapped}, tanah/bangunan tanpa ruang=${tanahBangunanTanpaRuang}, lokasi XXX=${tanpaKode}, kode tak dikenal=${kodeTidakDikenal}`,
  );
  console.log(`[seed:ruang] Total ruang=${totalRuang}, bangunan terpakai=${totalBangunan.length}, aset tanpa ruang=${asetTanpaRuang}`);
}

main()
  .catch((error) => {
    console.error("[seed:ruang] GAGAL:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
