-- Kode Register SIMAN (kolom BX export) — dipakai sebagai isi QR label.
-- Unik: terverifikasi 19.976/19.976 baris master_aset.xlsx terisi & unik.
ALTER TABLE "BarangLama" ADD COLUMN "kodeRegister" TEXT;

CREATE UNIQUE INDEX "BarangLama_kodeRegister_key" ON "BarangLama"("kodeRegister");
