# Sensus Aset BMN — Deploy & Operasional

Aplikasi internal sensus fisik aset BMN + rekonsiliasi SIMAN v2. **Bukan sumber kebenaran NUP** — SIMAN v2 tetap sistem resmi. Label dicetak dari NUP/Kode Register SIMAN, app tidak membuat kode final.

## 1. Prasyarat

- Node.js **>= 22.12** (Vite 8).
- PostgreSQL **16** dengan role yang boleh `CREATE` schema/tabel.
- Redis **7** shared dengan aplikasi lain (prefix wajib).
- MinIO/S3-compatible dengan 4 bucket: `inventaris-foto`, `inventaris-thumb`, `private`, `inventaris-staging`.
- Dua service di platform: **web** (API + SPA) dan **worker** (job thumbnail/berikutnya).

## 2. Environment

Salin `.env.example` → `.env` (jangan commit). Variabel wajib:

| Variabel | Keterangan |
|---|---|
| `DATABASE_URL` | Postgres, mis. `postgresql://user:pass@host:5432/sensus_pkl?schema=public` |
| `SHADOW_DATABASE_URL` | Untuk `prisma migrate dev` (dev). |
| `REDIS_URL` | Redis shared. |
| `REDIS_PREFIX` / `REDIS_KEY_VERSION` | Key final `{version}:{prefix}:` (mis. `v1:inv:`). |
| `JWT_SECRET` | Minimal 32 karakter acak. |
| `JWT_EXPIRES_IN` | Default `12h`. |
| `MINIO_ENDPOINT` | Endpoint internal/server-side. |
| `MINIO_PUBLIC_ENDPOINT` | **Wajib** `https://s3.domain` untuk presigned URL browser. Jangan pakai `storage.domain`. |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | Service account khusus app. |
| `MINIO_BUCKET_FOTO` / `_THUMB` / `_PRIVATE` / `_STAGING` | Nama bucket. |
| `SATKER_KODE` | Kode satker sekolah (validasi import + gate label). |
| `NUP_REGEX` | Regex NUP (contoh `^[0-9]+$`). |
| `QR_CONTENT_FORMAT` | Default `kode_register` (isi QR = Kode Register SIMAN). |
| `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD` | Seeder SUPERADMIN. Password kosong → digenerate & dicetak sekali. |
| `IMPORT_MAX_ROWS` / `IMPORT_MAX_SIZE_MB` / `IMPORT_TTL_SECONDS` | Batas staging import (default 50.000 / 50 MB / 2 jam). |
| `LOG_LEVEL` | `info`/`debug`. |

## 3. Setup awal

```bash
npm ci
npm run prisma:generate
npm run prisma:deploy       # prisma migrate deploy
npm run prisma:seed         # buat SUPERADMIN (idempoten)
npm run build
npm start                   # web: API + SPA di PORT (default 3000)
```

Service worker (platform service ke-2):

```bash
npm run worker
```

Jangan scale worker > 1 instance untuk job non-idempoten.

## 4. MinIO

Buat bucket (private):

- `inventaris-foto` — foto aset
- `inventaris-thumb` — thumbnail
- `private` — dokumen pendukung
- `inventaris-staging` — snapshot import (lifecycle hapus > 7 hari, tanpa CORS)

Policy service account minimal:

- foto/thumb/private: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`
- staging: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`

**CORS bucket foto/private** wajib mengizinkan `PUT` dari origin aplikasi untuk presigned upload (method `PUT`, header `Content-Type`, expose `ETag`). Tanpa CORS, browser akan gagal upload meski URL valid.

## 5. Import SIMAN (M3)

- Login sebagai ADMIN/SUPERADMIN → menu **Import SIMAN**.
- Upload `.xlsx`/`.csv` (kolom minimal: Kode Register, Kode Barang, NUP, Nama Barang, Kode Satker).
- Semua baris masuk ke **`MasterAset`** (SSOT; tidak diubah oleh sensus).
- **Semua kolom asli disimpan di `MasterAset.dataMentah`** sebagai array `{header,value,column}`. Tidak ada kolom Excel yang dibuang; `ImportBatch.headers` menyimpan daftar header untuk audit.
- Preview disimpan di Redis (`v1:inv:import:<batchId>`, TTL 2 jam) + backup MinIO (`inventaris-staging`). Metadata lengkap dibaca dari MinIO saat commit agar Redis tetap ringan.
- Redis flush/evict → GET preview/commit otomatis restore dari MinIO.
- Commit transaksional oleh `kodeRegister` (fallback composite), baris yang hilang dari file baru ditandai `HILANG_DI_SIMAN`.
- Import **tidak menimpa** data sensus dan tidak mengisi ruang.

## 6. Seeding ruang (M3b)

Setelah import pertama:

```bash
npm run seed:ruang -- --dry-run   # validasi mapping bangunan
npm run seed:ruang                # upsert 65 ruang kosong
```

Input: `data/ruangan.csv` (turunan `data/ruangan.xlsx`). Semua ruang dibuat **kosong**; tidak ada mapping aset dan tidak ada ruang virtual.

## 7. Alur sensus

1. Login → **Hierarki** → pilih ruang.
2. Pilih jenis aset (kandidat global per `kodeBarang`), isi **kondisi + jumlah** per baris (mis. 12 BAIK, 3 RUSAK_RINGAN).
3. Submit → sistem mengambil **NUP terakhir yang belum disensus** (numerik menurun) dan membuat satu baris `Sensus` per NUP dengan `ruangId` ruang tersebut. `MasterAset` tidak diubah.
4. Jika NUP kurang → transaksi rollback, 422 + catatan shortfall (diminta/tersedia/kurang). Sisa NUP yang tidak diminta tetap belum disensus.
5. Foto grup → grup **DOCS_COMPLETE**, semua NUP dalam grup ikut.
6. ADMIN/SUPERADMIN verifikasi grup → semua NUP **VALIDATED**.
7. **Dashboard** 4 tab: Perlu Dokumen, Perlu Verifikasi, Perlu Cetak, Perlu Tempel.
8. **Label**: gate ketat NUP valid + unik per kode barang + aktif + satker cocok + VALIDATED + bukan temuan baru. QR = Kode Register SIMAN.
9. **Scan**: masukkan Kode Register untuk verifikasi aset/ruang/status/gate.

## 8. Health & smoke test

```bash
curl -s https://<domain>/api/health
# {"ok":true,"pg":true,"redis":true,"minio":true,...}

npm run smoke
# butuh SEED_SUPERADMIN_EMAIL/PASSWORD di .env; opsional SMOKE_KODE_REGISTER
```

## 9. Catatan operasional

- `app.set("trust proxy", 1)` dan `listen(port, "0.0.0.0")` wajib di platform.
- SPA fallback memakai regex; `/api/*` yang tidak ada mengembalikan JSON 404.
- Redis key WAJIB lewat registry `K.*`; rate-limit memakai prefix eksplisit.
- Presigned PUT/GET memakai `MINIO_PUBLIC_ENDPOINT`; server-side memakai endpoint internal.
- Migrasi: `npm run prisma:deploy` saat deploy; jangan `db push` di produksi.
- Backup: DB Postgres + bucket MinIO. Staging import bersifat sementara (2 jam/7 hari).
- Asumsi saat brief v1 belum lengkap: 1 foto minimum untuk DOCS_COMPLETE, JWT tanpa refresh token, logout mereset semua sesi, reset password mengembalikan password sementara 16 karakter.
