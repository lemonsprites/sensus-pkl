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

-- CreateEnum
CREATE TYPE "JenisDokumen" AS ENUM ('FOTO', 'DOKUMEN');

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
CREATE TABLE "MasterAset" (
    "id" TEXT NOT NULL,
    "kodeSiman" TEXT,
    "kodeRegister" TEXT,
    "kodeBarang" TEXT,
    "nama" TEXT NOT NULL,
    "kategori" TEXT,
    "parentAsetId" TEXT,
    "kodeSatker" TEXT,
    "jumlahLama" INTEGER NOT NULL DEFAULT 1,
    "merk" TEXT,
    "noSeri" TEXT,
    "tahun" INTEGER,
    "nilaiPerolehan" DECIMAL(14,2),
    "kondisiSiman" TEXT,
    "statusAset" TEXT,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'SNAPSHOT_AWAL',
    "snapshotAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "catatan" TEXT,
    "dataMentah" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterAset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ruang" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "kodeRegister" TEXT,
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
CREATE TABLE "SensusGrup" (
    "id" TEXT NOT NULL,
    "ruangId" TEXT NOT NULL,
    "kodeBarang" TEXT NOT NULL,
    "namaBarang" TEXT NOT NULL,
    "kondisi" "Kondisi" NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "status" "SensusStatus" NOT NULL DEFAULT 'ASSESSED',
    "docsComplete" BOOLEAN NOT NULL DEFAULT false,
    "catatan" TEXT,
    "catatanOtomatis" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SensusGrup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sensus" (
    "id" TEXT NOT NULL,
    "masterAsetId" TEXT NOT NULL,
    "grupId" TEXT,
    "ruangId" TEXT,
    "status" "SensusStatus" NOT NULL DEFAULT 'DRAFT',
    "jumlahFisik" INTEGER,
    "kondisi" "Kondisi",
    "statusMatch" "StatusMatch",
    "isTemuanBaru" BOOLEAN NOT NULL DEFAULT false,
    "docsComplete" BOOLEAN NOT NULL DEFAULT false,
    "docsNote" TEXT,
    "labelPrintedAt" TIMESTAMP(3),
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
    "headers" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PREVIEW',
    "importedBy" TEXT NOT NULL,
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensusDokumen" (
    "id" TEXT NOT NULL,
    "sensusId" TEXT,
    "grupId" TEXT,
    "jenis" "JenisDokumen" NOT NULL DEFAULT 'FOTO',
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "thumbKey" TEXT,
    "contentType" TEXT,
    "size" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensusDokumen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MasterAset_kodeRegister_key" ON "MasterAset"("kodeRegister");

-- CreateIndex
CREATE INDEX "MasterAset_kodeSiman_idx" ON "MasterAset"("kodeSiman");

-- CreateIndex
CREATE INDEX "MasterAset_nama_idx" ON "MasterAset"("nama");

-- CreateIndex
CREATE INDEX "MasterAset_parentAsetId_idx" ON "MasterAset"("parentAsetId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterAset_kodeBarang_kodeSiman_key" ON "MasterAset"("kodeBarang", "kodeSiman");

-- CreateIndex
CREATE UNIQUE INDEX "Ruang_kode_key" ON "Ruang"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "Ruang_kodeRegister_key" ON "Ruang"("kodeRegister");

-- CreateIndex
CREATE INDEX "Ruang_bangunanAsetId_lantai_idx" ON "Ruang"("bangunanAsetId", "lantai");

-- CreateIndex
CREATE UNIQUE INDEX "Ruang_bangunanAsetId_lantai_kode_key" ON "Ruang"("bangunanAsetId", "lantai", "kode");

-- CreateIndex
CREATE INDEX "SensusGrup_ruangId_kodeBarang_idx" ON "SensusGrup"("ruangId", "kodeBarang");

-- CreateIndex
CREATE INDEX "SensusGrup_status_idx" ON "SensusGrup"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Sensus_masterAsetId_key" ON "Sensus"("masterAsetId");

-- CreateIndex
CREATE INDEX "Sensus_status_idx" ON "Sensus"("status");

-- CreateIndex
CREATE INDEX "Sensus_statusMatch_idx" ON "Sensus"("statusMatch");

-- CreateIndex
CREATE INDEX "Sensus_ruangId_idx" ON "Sensus"("ruangId");

-- CreateIndex
CREATE INDEX "Sensus_grupId_idx" ON "Sensus"("grupId");

-- CreateIndex
CREATE INDEX "EditHistory_sensusId_createdAt_idx" ON "EditHistory"("sensusId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportBatch_status_createdAt_idx" ON "ImportBatch"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SensusDokumen_objectKey_key" ON "SensusDokumen"("objectKey");

-- CreateIndex
CREATE INDEX "SensusDokumen_sensusId_jenis_idx" ON "SensusDokumen"("sensusId", "jenis");

-- CreateIndex
CREATE INDEX "SensusDokumen_grupId_jenis_idx" ON "SensusDokumen"("grupId", "jenis");

-- AddForeignKey
ALTER TABLE "MasterAset" ADD CONSTRAINT "MasterAset_parentAsetId_fkey" FOREIGN KEY ("parentAsetId") REFERENCES "MasterAset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ruang" ADD CONSTRAINT "Ruang_bangunanAsetId_fkey" FOREIGN KEY ("bangunanAsetId") REFERENCES "MasterAset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensusGrup" ADD CONSTRAINT "SensusGrup_ruangId_fkey" FOREIGN KEY ("ruangId") REFERENCES "Ruang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensusGrup" ADD CONSTRAINT "SensusGrup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sensus" ADD CONSTRAINT "Sensus_masterAsetId_fkey" FOREIGN KEY ("masterAsetId") REFERENCES "MasterAset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sensus" ADD CONSTRAINT "Sensus_grupId_fkey" FOREIGN KEY ("grupId") REFERENCES "SensusGrup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "SensusDokumen" ADD CONSTRAINT "SensusDokumen_sensusId_fkey" FOREIGN KEY ("sensusId") REFERENCES "Sensus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensusDokumen" ADD CONSTRAINT "SensusDokumen_grupId_fkey" FOREIGN KEY ("grupId") REFERENCES "SensusGrup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensusDokumen" ADD CONSTRAINT "SensusDokumen_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
