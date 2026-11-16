-- Profil PKL + audit aktivitas + aktor koreksi/label.
ALTER TABLE "User" ADD COLUMN "nim" TEXT,
ADD COLUMN "programStudi" TEXT,
ADD COLUMN "instansi" TEXT,
ADD COLUMN "noHp" TEXT;

CREATE UNIQUE INDEX "User_nim_key" ON "User"("nim");

ALTER TABLE "SensusGrup" ADD COLUMN "updatedById" TEXT;
ALTER TABLE "Sensus" ADD COLUMN "labelPrintedById" TEXT,
ADD COLUMN "labelAppliedById" TEXT;

CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorNama" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActivityLog_actorId_createdAt_idx" ON "ActivityLog"("actorId", "createdAt");
CREATE INDEX "ActivityLog_action_createdAt_idx" ON "ActivityLog"("action", "createdAt");
CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SensusGrup" ADD CONSTRAINT "SensusGrup_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sensus" ADD CONSTRAINT "Sensus_labelPrintedById_fkey" FOREIGN KEY ("labelPrintedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sensus" ADD CONSTRAINT "Sensus_labelAppliedById_fkey" FOREIGN KEY ("labelAppliedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
