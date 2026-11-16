-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MAHASISWA', 'ADMIN', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('SNAPSHOT_AWAL', 'TERSINKRON', 'HILANG_DI_SIMAN');

-- CreateEnum
CREATE TYPE "SensusStatus" AS ENUM ('DRAFT', 'ASSESSED', 'DOCS_COMPLETE', 'VALIDATED', 'TIDAK_DITEMUKAN');

-- CreateEnum
CREATE TYPE "Kondisi" AS ENUM ('BAIK', 'RUSAK_RINGAN', 'RUSAK_BERAT');

-- CreateEnum
CREATE TYPE "StatusMatch" AS ENUM ('COCOK', 'TIDAK_COCOK', 'TEMUAN_BARU');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MAHASISWA',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarangLama" (
    "id" TEXT NOT NULL,
    "kodeSiman" TEXT,
    "kodeBarang" TEXT,
    "nama" TEXT NOT NULL,
    "kategori" TEXT,
    "parentAsetId" TEXT,
    "ruangId" TEXT,
    "kodeSatker" TEXT,
    "jumlahLama" INTEGER NOT NULL DEFAULT 1,
    "merk" TEXT,
    "noSeri" TEXT,
    "tahun" INTEGER,
    "nilaiPerolehan" DECIMAL(14,2),
    "lokasiSiman" TEXT,
    "kondisiSiman" TEXT,
    "statusAset" TEXT,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'SNAPSHOT_AWAL',
    "snapshotAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BarangLama_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ruang" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tipeRuang" TEXT,
    "luas" DECIMAL(10,2),
    "pic" TEXT,
    "bangunanAsetId" TEXT NOT NULL,
    "lantai" INTEGER NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ruang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sensus" (
    "id" TEXT NOT NULL,
    "barangLamaId" TEXT NOT NULL,
    "ruangId" TEXT,
    "status" "SensusStatus" NOT NULL DEFAULT 'DRAFT',
    "jumlahFisik" INTEGER,
    "kondisi" "Kondisi",
    "statusMatch" "StatusMatch",
    "isTemuanBaru" BOOLEAN NOT NULL DEFAULT false,
    "docsComplete" BOOLEAN NOT NULL DEFAULT false,
    "docsNote" TEXT,
    "labelAppliedAt" TIMESTAMP(3),
    "catatan" TEXT,
    "diinputOlehId" TEXT NOT NULL,
    "diverifikasiOlehId" TEXT,
    "diverifikasiAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sensus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditHistory" (
    "id" TEXT NOT NULL,
    "sensusId" TEXT NOT NULL,
    "olehId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "nilaiLama" TEXT,
    "nilaiBaru" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "inserted" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PREVIEW',
    "importedBy" TEXT NOT NULL,
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "BarangLama_kodeSiman_idx" ON "BarangLama"("kodeSiman");

-- CreateIndex
CREATE INDEX "BarangLama_nama_idx" ON "BarangLama"("nama");

-- CreateIndex
CREATE INDEX "BarangLama_parentAsetId_idx" ON "BarangLama"("parentAsetId");

-- CreateIndex
CREATE INDEX "BarangLama_ruangId_idx" ON "BarangLama"("ruangId");

-- CreateIndex
CREATE UNIQUE INDEX "BarangLama_kodeBarang_kodeSiman_key" ON "BarangLama"("kodeBarang", "kodeSiman");

-- CreateIndex
CREATE UNIQUE INDEX "Ruang_kode_key" ON "Ruang"("kode");

-- CreateIndex
CREATE INDEX "Ruang_bangunanAsetId_lantai_idx" ON "Ruang"("bangunanAsetId", "lantai");

-- CreateIndex
CREATE UNIQUE INDEX "Ruang_bangunanAsetId_lantai_kode_key" ON "Ruang"("bangunanAsetId", "lantai", "kode");

-- CreateIndex
CREATE INDEX "Sensus_status_idx" ON "Sensus"("status");

-- CreateIndex
CREATE INDEX "Sensus_statusMatch_idx" ON "Sensus"("statusMatch");

-- CreateIndex
CREATE INDEX "Sensus_ruangId_idx" ON "Sensus"("ruangId");

-- CreateIndex
CREATE INDEX "Sensus_barangLamaId_idx" ON "Sensus"("barangLamaId");

-- CreateIndex
CREATE INDEX "EditHistory_sensusId_createdAt_idx" ON "EditHistory"("sensusId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportBatch_status_createdAt_idx" ON "ImportBatch"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "BarangLama" ADD CONSTRAINT "BarangLama_parentAsetId_fkey" FOREIGN KEY ("parentAsetId") REFERENCES "BarangLama"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarangLama" ADD CONSTRAINT "BarangLama_ruangId_fkey" FOREIGN KEY ("ruangId") REFERENCES "Ruang"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ruang" ADD CONSTRAINT "Ruang_bangunanAsetId_fkey" FOREIGN KEY ("bangunanAsetId") REFERENCES "BarangLama"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sensus" ADD CONSTRAINT "Sensus_barangLamaId_fkey" FOREIGN KEY ("barangLamaId") REFERENCES "BarangLama"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sensus" ADD CONSTRAINT "Sensus_ruangId_fkey" FOREIGN KEY ("ruangId") REFERENCES "Ruang"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sensus" ADD CONSTRAINT "Sensus_diinputOlehId_fkey" FOREIGN KEY ("diinputOlehId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sensus" ADD CONSTRAINT "Sensus_diverifikasiOlehId_fkey" FOREIGN KEY ("diverifikasiOlehId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditHistory" ADD CONSTRAINT "EditHistory_sensusId_fkey" FOREIGN KEY ("sensusId") REFERENCES "Sensus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditHistory" ADD CONSTRAINT "EditHistory_olehId_fkey" FOREIGN KEY ("olehId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
