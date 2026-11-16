import * as XLSX from "xlsx";

import { prisma } from "../lib/prisma.js";

const EXPORT_SELECT = {
  status: true,
  jumlahFisik: true,
  kondisi: true,
  statusMatch: true,
  isTemuanBaru: true,
  docsComplete: true,
  docsNote: true,
  catatan: true,
  labelPrintedAt: true,
  labelAppliedAt: true,
  diverifikasiAt: true,
  updatedAt: true,
  masterAset: {
    select: {
      kodeRegister: true, kodeBarang: true, kodeSiman: true, nama: true,
      kategori: true, kodeSatker: true, statusAset: true, syncStatus: true,
    },
  },
  ruang: {
    select: { kode: true, nama: true, lantai: true, bangunanAset: { select: { nama: true } } },
  },
  grup: { select: { id: true, kodeBarang: true, namaBarang: true, kondisi: true, jumlah: true } },
  diinputOleh: { select: { nama: true } },
  diverifikasiOleh: { select: { nama: true } },
} as const;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function exportSensus(format: "csv" | "xlsx") {
  const rows = await prisma.sensus.findMany({ select: EXPORT_SELECT, orderBy: { updatedAt: "asc" } });

  const flat = rows.map((row) => ({
    grup_id: row.grup?.id ?? null,
    grup_kode_barang: row.grup?.kodeBarang ?? null,
    grup_kondisi: row.grup?.kondisi ?? null,
    grup_jumlah: row.grup?.jumlah ?? null,
    kode_register: row.masterAset.kodeRegister,
    kode_barang: row.masterAset.kodeBarang,
    nup: row.masterAset.kodeSiman,
    nama_barang: row.masterAset.nama,
    kategori: row.masterAset.kategori,
    kode_satker: row.masterAset.kodeSatker,
    status_bmn: row.masterAset.statusAset,
    sync_status: row.masterAset.syncStatus,
    gedung: row.ruang?.bangunanAset.nama ?? null,
    ruang: row.ruang?.nama ?? null,
    kode_ruang: row.ruang?.kode ?? null,
    lantai: row.ruang?.lantai ?? null,
    status_sensus: row.status,
    jumlah_fisik: row.jumlahFisik,
    kondisi: row.kondisi,
    status_match: row.statusMatch,
    temuan_baru: row.isTemuanBaru ? "YA" : "TIDAK",
    docs_complete: row.docsComplete ? "YA" : "TIDAK",
    docs_note: row.docsNote,
    catatan: row.catatan,
    label_dicetak: row.labelPrintedAt?.toISOString() ?? null,
    label_ditempel: row.labelAppliedAt?.toISOString() ?? null,
    diinput_oleh: row.diinputOleh?.nama ?? null,
    diverifikasi_oleh: row.diverifikasiOleh?.nama ?? null,
    diverifikasi_at: row.diverifikasiAt?.toISOString() ?? null,
    updated_at: row.updatedAt.toISOString(),
  }));

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "xlsx") {
    const sheet = XLSX.utils.json_to_sheet(flat);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Sensus");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return {
      filename: `sensus-bmn-${stamp}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer,
    };
  }

  const headers = Object.keys(flat[0] ?? {
    grup_id: "", grup_kode_barang: "", grup_kondisi: "", grup_jumlah: "",
    kode_register: "", kode_barang: "", nup: "", nama_barang: "", kategori: "",
    kode_satker: "", status_bmn: "", sync_status: "", gedung: "", ruang: "",
    kode_ruang: "", lantai: "", status_sensus: "", jumlah_fisik: "", kondisi: "",
    status_match: "", temuan_baru: "", docs_complete: "", docs_note: "", catatan: "",
    label_dicetak: "", label_ditempel: "", diinput_oleh: "", diverifikasi_oleh: "",
    diverifikasi_at: "", updated_at: "",
  });
  const lines = [headers.join(",")];
  for (const row of flat as Array<Record<string, unknown>>) {
    lines.push(headers.map((header) => csvCell(row[header])).join(","));
  }

  return {
    filename: `sensus-bmn-${stamp}.csv`,
    contentType: "text/csv; charset=utf-8",
    buffer: Buffer.from(`\uFEFF${lines.join("\n")}`, "utf8"),
  };
}
