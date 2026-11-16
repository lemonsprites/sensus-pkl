export type Role = "MAHASISWA" | "ADMIN" | "SUPERADMIN";

export interface User {
  id: string;
  nama: string;
  email: string;
  role: Role;
  isActive: boolean;
  nim: string | null;
  programStudi: string | null;
  instansi: string | null;
  noHp: string | null;
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

export type SensusStatus = "DRAFT" | "ASSESSED" | "DOCS_COMPLETE" | "VALIDATED" | "TIDAK_DITEMUKAN";
export type Kondisi = "BAIK" | "RUSAK_RINGAN" | "RUSAK_BERAT";
export type StatusMatch = "COCOK" | "TIDAK_COCOK" | "TEMUAN_BARU";

export interface MasterAsetRef {
  id: string;
  kodeRegister: string | null;
  kodeBarang: string | null;
  kodeSiman: string | null;
  nama: string;
  kategori: string | null;
  merk?: string | null;
  noSeri?: string | null;
  tahun?: number | null;
  nilaiPerolehan?: string | null;
  kondisiSiman?: string | null;
  statusAset?: string | null;
  syncStatus?: string;
}

export interface Sensus {
  id: string;
  grupId: string | null;
  status: SensusStatus;
  jumlahFisik: number | null;
  kondisi: Kondisi | null;
  statusMatch: StatusMatch | null;
  isTemuanBaru: boolean;
  docsComplete: boolean;
  docsNote: string | null;
  labelPrintedAt: string | null;
  labelAppliedAt: string | null;
  catatan: string | null;
  diverifikasiAt: string | null;
  updatedAt: string;
  masterAset: MasterAsetRef;
  diinputOleh: { id: string; nama: string } | null;
  diverifikasiOleh: { id: string; nama: string } | null;
}

export interface SensusGrup {
  id: string;
  ruangId: string;
  kodeBarang: string;
  namaBarang: string;
  kondisi: Kondisi;
  jumlah: number;
  status: SensusStatus;
  docsComplete: boolean;
  catatan: string | null;
  catatanOtomatis: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; nama: string };
  updatedBy?: { id: string; nama: string } | null;
  sensus: Sensus[];
}

export interface RuangData {
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
    _count: { sensus: number; grup: number };
  };
  gedung: MasterAsetRef & { sensus: Sensus | null };
  groups: SensusGrup[];
  items: Sensus[];
}

export interface KandidatItem {
  kodeBarang: string;
  nama: string;
  kategori: string | null;
  tersedia: number;
}

export interface KandidatResponse {
  items: KandidatItem[];
  total: number;
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
  jumlahGrup: number;
  jumlahNup: number;
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
  total: { bangunan: number; ruang: number; nupDisensus: number; tanah: number };
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

export type DashboardTab = "PERLU_DOKUMEN" | "PERLU_VERIFIKASI" | "PERLU_CETAK" | "PERLU_TEMPEL";

export interface DashboardGroupItem {
  kind: "GROUP";
  id: string;
  kodeBarang: string;
  namaBarang: string;
  kondisi: Kondisi;
  jumlah: number;
  status: SensusStatus;
  docsComplete: boolean;
  catatan: string | null;
  catatanOtomatis: string | null;
  updatedAt: string;
  ruang: { id: string; kode: string; nama: string; lantai: number; bangunanAset: { nama: string } };
  createdBy: { nama: string };
}

export interface DashboardNupItem {
  kind: "NUP";
  id: string;
  status: SensusStatus;
  labelPrintedAt: string | null;
  labelAppliedAt: string | null;
  updatedAt: string;
  masterAset: { id: string; kodeRegister: string | null; kodeBarang: string | null; kodeSiman: string | null; nama: string; kategori: string | null };
  ruang: { id: string; kode: string; nama: string; lantai: number; bangunanAset: { nama: string } } | null;
  grup: { id: string; kondisi: Kondisi; jumlah: number } | null;
}

export interface DashboardResponse {
  counts: Record<DashboardTab, number>;
  tab: DashboardTab;
  kind: "GROUP" | "NUP";
  items: Array<DashboardGroupItem | DashboardNupItem>;
  total: number;
  page: number;
  limit: number;
}

export interface LabelItem {
  sensusId: string;
  masterAsetId: string;
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
  grupId: string | null;
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
  asset: MasterAsetRef & {
    syncStatus: string;
    sensus: (Sensus & {
      ruang: { kode: string; nama: string; lantai: number; bangunanAset: { nama: string } } | null;
      grup: { id: string; kondisi: Kondisi; jumlah: number } | null;
    }) | null;
  };
  gate: { ok: boolean; reasons: string[] };
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


export interface ActivityLogItem {
  id: string;
  actorId: string | null;
  actorNama: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata: unknown;
  createdAt: string;
  actor: { id: string; nama: string; role: Role } | null;
}

export type LogListResponse = Paginated<ActivityLogItem>;

export interface MonitoringUser {
  id: string;
  nama: string;
  email: string;
  role: Role;
  nim: string | null;
  programStudi: string | null;
  instansi: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  groupsCreated: number;
  nupAllocated: number;
  docsUploaded: number;
  corrections: number;
  validatedGroups: number;
  activityCount: number;
  lastActivityAt: string | null;
  ruangCount: number;
  status: Record<SensusStatus, number>;
}

export interface MonitoringRoom {
  id: string;
  kode: string;
  nama: string;
  gedung: string;
  groups: number;
  nup: number;
  docs: number;
  contributors: number;
  status: Record<SensusStatus, number>;
  lastActivityAt: string;
}

export interface MonitoringResponse {
  period: { from: string | null; to: string | null };
  summary: {
    totalGroups: number;
    totalNup: number;
    totalDocs: number;
    totalStudents: number;
    activeContributors: number;
    validatedNup: number;
    status: Record<SensusStatus, number>;
  };
  mahasiswa: MonitoringUser[];
  ruang: MonitoringRoom[];
}

export interface AdminGroupItem {
  id: string;
  ruangId: string;
  kodeBarang: string;
  namaBarang: string;
  kondisi: Kondisi;
  jumlah: number;
  status: SensusStatus;
  docsComplete: boolean;
  catatan: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; nama: string; nim: string | null };
  updatedBy: { id: string; nama: string } | null;
  ruang: { id: string; kode: string; nama: string; bangunanAset: { nama: string } };
  sensus: Array<{
    id: string;
    status: SensusStatus;
    masterAset: { kodeSiman: string | null; kodeRegister: string | null };
  }>;
  dokumen: Array<{ id: string; jenis: string; createdAt: string; uploadedBy: { nama: string } }>;
}

export interface AdminGroupResponse extends Paginated<AdminGroupItem> {
  statusCounts: Record<SensusStatus, number>;
}

export interface ReportData {
  meta: {
    generatedAt: string;
    generatedBy: { id: string; role: Role };
    periode: { from: string | null; to: string | null };
    sekolah: string;
    alamat: string;
    kota: string;
    satker: string | null;
    scope: { buildingId: string | null; roomId: string | null; gedung: string[] };
    signatures: { kepala: string; adminBmn: string; pembimbing: string };
  };
  summary: {
    totalMaster: number;
    totalSensus: number;
    totalGroups: number;
    totalNup: number;
    totalDocs: number;
    coverage: number;
    conditions: Record<Kondisi, number>;
    status: Record<SensusStatus, number>;
    findings: number;
    validatedGroups: number;
  };
  perRuang: Array<{
    id: string; kode: string; nama: string; lantai: number; gedung: string;
    groups: number; nup: number; docs: number;
    conditions: Record<Kondisi, number>;
    status: Record<SensusStatus, number>;
  }>;
  perGedung: Array<{
    id: string; nama: string; kode: string; rooms: number; groups: number; nup: number;
    docs: number; conditions: Record<Kondisi, number>;
  }>;
  findings: Array<{
    grupId: string; ruang: string; gedung: string; namaBarang: string; kodeBarang: string;
    kondisi: Kondisi; jumlah: number; status: SensusStatus; catatan: string | null;
  }>;
  contributors: Array<{
    id: string; nama: string; nim: string | null; groups: number; nup: number;
    docs: number; corrections: number; validated: number;
  }>;
  groups: Array<{
    id: string; ruang: string; kodeRuang: string; lantai: number; gedung: string;
    kodeBarang: string; namaBarang: string; kondisi: Kondisi; jumlah: number;
    status: SensusStatus; docs: number;
    nup: Array<{
      kodeSiman: string | null; kodeRegister: string | null; nama: string;
      status: SensusStatus; kondisi: Kondisi | null; temuanBaru: boolean;
    }>;
  }>;
  logs: ActivityLogItem[];
}

export interface ImportBatchList {
  items: ImportBatch[];
  total: number;
  page: number;
  limit: number;
}
