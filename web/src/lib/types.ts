export type Role = "MAHASISWA" | "ADMIN" | "SUPERADMIN";

export interface User {
  id: string;
  nama: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface LoginResult {
  token: string;
  user: User;
}

export type ImportBatchStatus = "PREVIEW" | "COMMITTED" | "CANCELLED";

export interface ImportBatch {
  id: string;
  filename: string;
  fileSize: number;
  snapshotAt: string;
  totalRows: number;
  inserted: number;
  updated: number;
  skipped: number;
  status: ImportBatchStatus;
  importedBy: string;
  committedAt: string | null;
  createdAt: string;
  errors: unknown;
  expiresAt?: string | null;
}

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
  nilaiPerolehan: string | null;
  lokasiSiman: string | null;
  kondisiSiman: string | null;
  statusAset: string | null;
  catatan: string | null;
  errors: string[];
  warnings: string[];
}

export interface ImportPreview {
  batch: ImportBatch;
  items: ImportRow[];
  total: number;
  page: number;
  limit: number;
  meta: {
    filename: string;
    fileSize: number;
    snapshotAt: string;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    backup: boolean;
  };
}

export interface ImportBatchList {
  items: ImportBatch[];
  total: number;
  page: number;
  limit: number;
}
