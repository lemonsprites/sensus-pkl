import { parse as parseCsv } from "csv-parse/sync";
import * as XLSX from "xlsx";

import { config } from "../lib/config.js";
import type { ImportRowPatchInput } from "../schemas/import.js";
import { ApiError } from "../utils/apiError.js";

/** Baris hasil normalisasi + validasi (disimpan di Redis staging). */
export interface ImportRow {
  rowNum: number;
  kodeRegister: string | null;
  kodeBarang: string | null;
  kodeSiman: string | null;
  nama: string;
  kategori: string | null;
  kodeSatker: string | null;
  jumlahLama: number;
  merk: string | null;
  noSeri: string | null;
  tahun: number | null;
  /** Decimal sebagai string agar aman di JSON/Prisma. */
  nilaiPerolehan: string | null;
  lokasiSiman: string | null;
  kondisiSiman: string | null;
  statusAset: string | null;
  catatan: string | null;
  errors: string[];
  warnings: string[];
}

type Field = keyof Omit<ImportRow, "rowNum" | "errors" | "warnings">;
type RawField = Field | "lokasiSimanAlt";
type RawRow = Partial<Record<RawField, string>>;

const HEADER_ALIASES: Record<RawField, string[]> = {
  kodeRegister: ["kode register", "kode register barang", "no register", "nomor register", "kode_register"],
  kodeBarang: ["kode barang", "kode_barang", "kodebarang"],
  kodeSiman: ["nup", "kode siman", "kode_siman", "nomor urut pendaftaran"],
  nama: ["nama barang", "nama", "uraian barang"],
  kategori: ["jenis bmn", "jenis barang", "kategori"],
  kodeSatker: ["kode satker", "kode_satker", "kode satuan kerja"],
  jumlahLama: ["jumlah", "jumlah lama", "kuantitas", "qty"],
  merk: ["merk", "merek"],
  noSeri: ["no seri", "nomor seri", "no. seri", "serial number"],
  tahun: ["tahun perolehan", "tahun"],
  nilaiPerolehan: ["nilai perolehan", "nilai perolehan pertama", "nilai"],
  lokasiSiman: ["lokasi ruang", "lokasi"],
  /** Kolom RUANGAN (D) — dipakai sebagai fallback bila Lokasi Ruang kosong. */
  lokasiSimanAlt: ["ruangan", "ruang"],
  kondisiSiman: ["kondisi", "kondisi bmn"],
  statusAset: ["status bmn", "status"],
  catatan: ["catatan", "keterangan"],
};

const HEADER_LOOKUP = new Map<string, RawField>();
for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<[RawField, string[]]>) {
  for (const alias of aliases) HEADER_LOOKUP.set(normalizeHeader(alias), field);
  HEADER_LOOKUP.set(normalizeHeader(field), field);
}

function normalizeHeader(value: string): string {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[_.\-/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).replace(/^\uFEFF/, "").trim();
}

function cleanCode(value: string): string | null {
  const v = value.replace(/\s+/g, "").toUpperCase();
  return v === "" ? null : v;
}

function cleanText(value: string): string | null {
  const v = value.trim();
  return v === "" ? null : v;
}

function parseInteger(value: string): number | null {
  const digits = value.replace(/[^\d-]/g, "");
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseYear(value: string): number | null {
  const match = value.match(/\d{4}/);
  if (!match) return null;
  const year = Number.parseInt(match[0], 10);
  return year >= 1900 && year <= 2100 ? year : null;
}

/** Dukung format Indonesia (1.234.567,89) dan internasional (1,234,567.89). */
function parseAmount(value: string): string | null {
  if (!value || value.trim() === "" || value.trim() === "-") return null;
  let text = value.replace(/[^\d.,-]/g, "");
  if (!text) return null;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > lastDot) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else {
    text = text.replace(/,/g, "");
  }
  const number = Number(text);
  return Number.isFinite(number) ? number.toFixed(2) : null;
}

/** Baris header teknis Excel (Column1, Column2, ...) — bukan data. */
function isTechnicalHeaderRow(cells: unknown[]): boolean {
  const texts = cells.map((cell) => toText(cell)).filter(Boolean);
  return texts.length > 0 && texts.every((text) => /^column\d+$/i.test(text));
}

function normalizeRow(raw: RawRow, rowNum: number): ImportRow {
  const kodeSimanRaw = toText(raw.kodeSiman).replace(/\.0$/, "");
  return {
    rowNum,
    kodeRegister: cleanCode(toText(raw.kodeRegister)),
    kodeBarang: cleanCode(toText(raw.kodeBarang)),
    kodeSiman: cleanCode(kodeSimanRaw),
    nama: toText(raw.nama),
    kategori: cleanText(toText(raw.kategori)),
    kodeSatker: cleanCode(toText(raw.kodeSatker)),
    jumlahLama: parseInteger(toText(raw.jumlahLama)) ?? 1,
    merk: cleanText(toText(raw.merk)),
    noSeri: cleanText(toText(raw.noSeri)),
    tahun: parseYear(toText(raw.tahun)),
    nilaiPerolehan: parseAmount(toText(raw.nilaiPerolehan)),
    // C (Lokasi Ruang) diutamakan; D (RUANGAN) hanya fallback.
    lokasiSiman: cleanText(toText(raw.lokasiSiman) || toText(raw.lokasiSimanAlt)),
    kondisiSiman: cleanText(toText(raw.kondisiSiman)),
    statusAset: cleanText(toText(raw.statusAset)),
    catatan: cleanText(toText(raw.catatan)),
    errors: [],
    warnings: [],
  };
}

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).filter((line) => line.trim() !== "").slice(0, 5).join("\n");
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  for (const char of sample) {
    if (char in counts) counts[char] += 1;
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ",") as string;
}

interface HeaderColumn {
  field: RawField;
  index: number;
}

function mapHeaderRow(row: unknown[]): HeaderColumn[] {
  const columns: HeaderColumn[] = [];
  const seen = new Set<RawField>();
  row.forEach((cell, index) => {
    const field = HEADER_LOOKUP.get(normalizeHeader(toText(cell)));
    if (field && !seen.has(field)) {
      seen.add(field);
      columns.push({ field, index });
    }
  });
  return columns;
}

function findHeader(rows: unknown[][]): { headerIndex: number; columns: HeaderColumn[] } {
  let headerIndex = -1;
  let columns: HeaderColumn[] = [];

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const candidate = mapHeaderRow(rows[i] ?? []);
    if (candidate.length > columns.length) {
      headerIndex = i;
      columns = candidate;
    }
  }

  if (headerIndex < 0 || columns.length < 2) {
    throw ApiError.badRequest(
      "Header file tidak dikenali. Wajib ada kolom Kode Register / Kode Barang / NUP / Nama Barang.",
    );
  }

  return { headerIndex, columns };
}

export function validateImportRows(rows: ImportRow[]): ImportRow[] {
  const seenRegister = new Set<string>();
  const seenComposite = new Set<string>();
  const nupPattern = config.NUP_REGEX ? new RegExp(config.NUP_REGEX) : null;

  for (const row of rows) {
    row.errors = [];
    row.warnings = [];

    if (!row.nama) row.errors.push("Nama barang kosong");

    if (!row.kodeRegister && !(row.kodeBarang && row.kodeSiman)) {
      row.errors.push("Kode Register atau kombinasi Kode Barang+NUP wajib ada");
    }

    if (row.kodeRegister) {
      if (seenRegister.has(row.kodeRegister)) {
        row.errors.push(`Kode Register duplikat di dalam file: ${row.kodeRegister}`);
      } else {
        seenRegister.add(row.kodeRegister);
      }
    } else {
      row.warnings.push("Kode Register kosong — QR label tidak bisa dicetak");
    }

    if (row.kodeBarang && row.kodeSiman) {
      const composite = `${row.kodeBarang}|${row.kodeSiman}`;
      if (seenComposite.has(composite)) {
        row.errors.push("Kombinasi Kode Barang+NUP duplikat di dalam file");
      } else {
        seenComposite.add(composite);
      }
    }

    if (config.SATKER_KODE) {
      if (!row.kodeSatker) {
        row.warnings.push("Kode Satker kosong");
      } else if (row.kodeSatker !== config.SATKER_KODE) {
        row.errors.push(`Kode Satker ${row.kodeSatker} tidak cocok dengan satker ${config.SATKER_KODE}`);
      }
    }

    if (nupPattern && row.kodeSiman && !nupPattern.test(row.kodeSiman)) {
      row.errors.push(`Format NUP tidak valid: ${row.kodeSiman}`);
    }

    if (!row.kodeSiman) row.warnings.push("NUP kosong — tidak bisa masuk gate label");
  }

  return rows;
}

/** Parse XLSX atau CSV (deteksi dari nama file / magic bytes). */
export function parseImportFile(buffer: Buffer, filename: string): ImportRow[] {
  const isXlsx =
    /\.(xlsx|xls)$/i.test(filename) || (buffer[0] === 0x50 && buffer[1] === 0x4b);

  let matrix: unknown[][];

  if (isXlsx) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw ApiError.badRequest("File XLSX tidak memiliki sheet");
    matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    });
  } else {
    const text = buffer.toString("utf8");
    matrix = parseCsv(text, {
      bom: true,
      delimiter: detectDelimiter(text),
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    }) as unknown[][];
  }

  if (matrix.length === 0) throw ApiError.badRequest("File kosong");

  const { headerIndex, columns } = findHeader(matrix);
  const rows: ImportRow[] = [];

  for (let i = headerIndex + 1; i < matrix.length; i++) {
    const cells = matrix[i] ?? [];
    if (cells.every((cell) => toText(cell) === "")) continue;
    if (isTechnicalHeaderRow(cells)) continue;

    const raw: RawRow = {};
    for (const { field, index } of columns) raw[field] = toText(cells[index]);
    rows.push(normalizeRow(raw, i + 1));
  }

  if (rows.length === 0) throw ApiError.badRequest("File tidak berisi baris data");
  if (rows.length > config.IMPORT_MAX_ROWS) {
    throw ApiError.badRequest(
      `Jumlah baris ${rows.length} melebihi batas ${config.IMPORT_MAX_ROWS}`,
    );
  }

  return validateImportRows(rows);
}

/** Terapkan hasil edit preview ke satu baris (normalisasi sama seperti upload). */
export function applyRowPatch(row: ImportRow, patch: ImportRowPatchInput): ImportRow {
  const next: ImportRow = { ...row };
  const codeFields = ["kodeRegister", "kodeBarang", "kodeSiman", "kodeSatker"] as const;
  for (const field of codeFields) {
    const value = patch[field];
    if (value !== undefined) next[field] = cleanCode(value);
  }

  const textFields = ["kategori", "merk", "noSeri", "lokasiSiman", "kondisiSiman", "statusAset", "catatan"] as const;
  for (const field of textFields) {
    const value = patch[field];
    if (value !== undefined) next[field] = cleanText(value);
  }
  if (patch.nama !== undefined) next.nama = patch.nama.trim();

  if (patch.jumlahLama !== undefined) next.jumlahLama = patch.jumlahLama;
  if (patch.tahun !== undefined) next.tahun = patch.tahun;
  if (patch.nilaiPerolehan !== undefined) {
    next.nilaiPerolehan =
      typeof patch.nilaiPerolehan === "number"
        ? patch.nilaiPerolehan.toFixed(2)
        : parseAmount(patch.nilaiPerolehan);
  }

  return next;
}
