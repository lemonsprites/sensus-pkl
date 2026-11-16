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

export type SensusStatus =
  | "DRAFT"
  | "ASSESSED"
  | "DOCS_COMPLETE"
  | "VALIDATED"
  | "TIDAK_DITEMUKAN";

export type Kondisi = "BAIK" | "RUSAK_RINGAN" | "RUSAK_BERAT";
export type StatusMatch = "COCOK" | "TIDAK_COCOK" | "TEMUAN_BARU";

export interface Sensus {
  id: string;
  status: SensusStatus;
  jumlahFisik: number | null;
  kondisi: Kondisi | null;
  statusMatch: StatusMatch | null;
  isTemuanBaru: boolean;
  docsComplete: boolean;
  docsNote: string | null;
  labelAppliedAt: string | null;
  catatan: string | null;
  diverifikasiAt: string | null;
  updatedAt: string;
  diinputOleh: { id: string; nama: string } | null;
  diverifikasiOleh: { id: string; nama: string } | null;
}

export interface AssetWithSensus {
  id: string;
  kodeRegister: string | null;
  kodeBarang: string | null;
  kodeSiman: string | null;
  nama: string;
  kategori: string | null;
  merk: string | null;
  noSeri: string | null;
  tahun: number | null;
  nilaiPerolehan: string | null;
  lokasiSiman: string | null;
  kondisiSiman: string | null;
  statusAset: string | null;
  ruangId: string | null;
  parentAsetId: string | null;
  syncStatus: string;
  sensus: Sensus | null;
}

export interface RuangHierarki {
  id: string;
  kode: string;
  kodeRegister: string | null;
  nama: string;
  tipeRuang: string | null;
  luas: string | null;
  lantai: number;
  urutan: number;
  jumlahAset: number;
  jumlahSensus: number;
}

export interface BangunanHierarki {
  id: string;
  kodeBarang: string | null;
  kodeSiman: string | null;
  kodeRegister: string | null;
  nama: string;
  kategori: string | null;
  sensus: Sensus | null;
  ruang: RuangHierarki[];
}

export interface HierarkiResponse {
  buildings: BangunanHierarki[];
  tanah: Array<{
    id: string;
    kodeBarang: string | null;
    kodeSiman: string | null;
    kodeRegister: string | null;
    nama: string;
    kategori: string | null;
    sensus: Sensus | null;
  }>;
  total: {
    bangunan: number;
    ruang: number;
    asetDiRuang: number;
    tanah: number;
  };
}

export interface RuangAssetsResponse {
  ruang: {
    id: string;
    kode: string;
    kodeRegister: string | null;
    nama: string;
    tipeRuang: string | null;
    luas: string | null;
    lantai: number;
    urutan: number;
    bangunanAsetId: string;
    _count: { aset: number; sensus: number };
  };
  gedung: AssetWithSensus;
  items: AssetWithSensus[];
  total: number;
  page: number;
  limit: number;
}

export interface DokumenItem {
  id: string;
  jenis: "FOTO" | "DOKUMEN";
  contentType: string | null;
  size: number | null;
  createdAt: string;
  uploadedBy: { id: string; nama: string };
  url: string;
  thumbUrl: string | null;
}

export interface DokumenListResponse {
  sensusStatus: SensusStatus;
  docsComplete: boolean;
  items: DokumenItem[];
}

export type DashboardTab =
  | "PERLU_DOKUMEN"
  | "PERLU_VERIFIKASI"
  | "PERLU_INPUT_SIMAN"
  | "PERLU_CETAK"
  | "PERLU_TEMPEL";

export interface DashboardItem {
  id: string;
  status: SensusStatus;
  jumlahFisik: number | null;
  kondisi: Kondisi | null;
  statusMatch: StatusMatch | null;
  isTemuanBaru: boolean;
  docsComplete: boolean;
  labelPrintedAt: string | null;
  labelAppliedAt: string | null;
  updatedAt: string;
  barangLama: {
    id: string;
    kodeRegister: string | null;
    kodeBarang: string | null;
    kodeSiman: string | null;
    nama: string;
    kategori: string | null;
    kodeSatker: string | null;
    statusAset: string | null;
    ruang: {
      id: string;
      kode: string;
      nama: string;
      lantai: number;
      bangunanAset: { id: string; nama: string };
    } | null;
  };
  diinputOleh: { id: string; nama: string } | null;
}

export interface DashboardResponse {
  counts: Record<DashboardTab, number>;
  tab: DashboardTab;
  items: DashboardItem[];
  total: number;
  page: number;
  limit: number;
}

export interface LabelItem {
  sensusId: string;
  barangLamaId: string;
  nama: string;
  kodeBarang: string | null;
  kodeSiman: string | null;
  kodeRegister: string | null;
  kategori: string | null;
  kodeSatker: string | null;
  statusAset: string | null;
  gedung: string | null;
  ruang: string | null;
  lantai: number | null;
  printedAt: string | null;
  appliedAt: string | null;
  qrContent: string | null;
}

export interface LabelEligibleResponse {
  items: LabelItem[];
  total: number;
  page: number;
  limit: number;
}

export interface PrintLabelResponse {
  printed: number;
  labels: LabelItem[];
}

export interface ScanResponse {
  asset: {
    id: string;
    kodeRegister: string | null;
    kodeBarang: string | null;
    kodeSiman: string | null;
    nama: string;
    kategori: string | null;
    kodeSatker: string | null;
    statusAset: string | null;
    syncStatus: string;
    ruang: {
      kode: string;
      nama: string;
      lantai: number;
      bangunanAset: { nama: string };
    } | null;
    sensus: {
      id: string;
      status: SensusStatus;
      jumlahFisik: number | null;
      kondisi: Kondisi | null;
      statusMatch: StatusMatch | null;
      isTemuanBaru: boolean;
      docsComplete: boolean;
      labelPrintedAt: string | null;
      labelAppliedAt: string | null;
      catatan: string | null;
      diverifikasiAt: string | null;
    } | null;
  };
  gate: { ok: boolean; reasons: string[] };
}
