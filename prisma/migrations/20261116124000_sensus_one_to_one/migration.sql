-- Satu baris Sensus per aset (upsert by barangLamaId).
CREATE UNIQUE INDEX "Sensus_barangLamaId_key" ON "Sensus"("barangLamaId");
