-- Kode Register SIMAN per ruangan (ruangan.xlsx kolom G) — isi QR ruangan.
ALTER TABLE "Ruang" ADD COLUMN "kodeRegister" TEXT;

CREATE UNIQUE INDEX "Ruang_kodeRegister_key" ON "Ruang"("kodeRegister");
