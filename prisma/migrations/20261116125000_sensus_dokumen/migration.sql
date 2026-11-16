-- M5: dokumen pendukung + penanda cetak label.
CREATE TYPE "JenisDokumen" AS ENUM ('FOTO', 'DOKUMEN');

ALTER TABLE "Sensus" ADD COLUMN "labelPrintedAt" TIMESTAMP(3);

CREATE TABLE "SensusDokumen" (
    "id" TEXT NOT NULL,
    "sensusId" TEXT NOT NULL,
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

CREATE UNIQUE INDEX "SensusDokumen_objectKey_key" ON "SensusDokumen"("objectKey");
CREATE INDEX "SensusDokumen_sensusId_jenis_idx" ON "SensusDokumen"("sensusId", "jenis");

ALTER TABLE "SensusDokumen" ADD CONSTRAINT "SensusDokumen_sensusId_fkey" FOREIGN KEY ("sensusId") REFERENCES "Sensus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SensusDokumen" ADD CONSTRAINT "SensusDokumen_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
