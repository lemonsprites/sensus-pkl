import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { gunzipSync, gzipSync } from "node:zlib";

import type { ImportBatchModel } from "../generated/prisma/models.js";
import type { Prisma } from "../generated/prisma/client.js";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import { BUCKETS, minio } from "../lib/minio.js";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { K } from "../lib/redisKeys.js";
import type { ImportRowPatchInput } from "../schemas/import.js";
import { ApiError } from "../utils/apiError.js";
import { logActivity } from "./activityService.js";
import {
  applyRowPatch,
  parseImportFile,
  validateImportRows,
  type ImportRow,
} from "./importParser.js";
import type { Actor } from "./userService.js";

const STAGING_PREFIX = "staging-import";
const TTL = config.IMPORT_TTL_SECONDS;

export interface StagingMeta {
  filename: string;
  fileSize: number;
  snapshotAt: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  backup: boolean;
}

const stagingKey = (batchId: string) => `${STAGING_PREFIX}/${batchId}.jsonl.gz`;

function serializeBatch(batch: ImportBatchModel) {
  return {
    id: batch.id,
    filename: batch.filename,
    fileSize: batch.fileSize,
    snapshotAt: batch.snapshotAt.toISOString(),
    totalRows: batch.totalRows,
    inserted: batch.inserted,
    updated: batch.updated,
    skipped: batch.skipped,
    status: batch.status,
    importedBy: batch.importedBy,
    committedAt: batch.committedAt?.toISOString() ?? null,
    createdAt: batch.createdAt.toISOString(),
    errors: batch.errors,
    headers: batch.headers,
  };
}

function countValid(rows: ImportRow[]) {
  const validRows = rows.filter((row) => row.errors.length === 0).length;
  return { validRows, invalidRows: rows.length - validRows };
}

async function writeStaging(batchId: string, rows: ImportRow[], meta: StagingMeta): Promise<void> {
  const rowKey = K.importBatch(batchId);
  const indexKey = K.importIndex(batchId);
  const metaKey = K.importMeta(batchId);
  const patchKey = K.importPatches(batchId);

  await redis.del(rowKey, indexKey, metaKey, patchKey);

  const chunkSize = 500;
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    const pipeline = redis.pipeline();
    for (const row of chunk) {
      const field = String(row.rowNum);
      const normalized = { ...row };
      delete normalized.dataMentah;
      pipeline.hset(rowKey, field, JSON.stringify(normalized));
      pipeline.zadd(indexKey, row.rowNum, field);
    }
    const results = await pipeline.exec();
    const failed = results?.find(([error]) => error !== null);
    if (failed?.[0]) throw failed[0];
  }

  await redis.hset(metaKey, "meta", JSON.stringify(meta));
  await Promise.all([
    redis.expire(rowKey, TTL),
    redis.expire(indexKey, TTL),
    redis.expire(metaKey, TTL),
    redis.expire(patchKey, TTL),
  ]);
}

async function backupToMinio(batchId: string, rows: ImportRow[]): Promise<boolean> {
  try {
    const jsonl = rows.map((row) => JSON.stringify(row)).join("\n");
    const gz = gzipSync(Buffer.from(jsonl, "utf8"));
    await minio.putObject(BUCKETS.staging, stagingKey(batchId), gz, gz.length, {
      "Content-Type": "application/gzip",
    });
    return true;
  } catch (error) {
    logger.warn({ err: (error as Error).message, batchId }, "Backup staging ke MinIO gagal");
    return false;
  }
}

async function removeBackup(batchId: string): Promise<void> {
  try {
    await minio.removeObject(BUCKETS.staging, stagingKey(batchId));
  } catch (error) {
    logger.warn({ err: (error as Error).message, batchId }, "Hapus object staging MinIO gagal");
  }
}

async function cleanupStaging(batchId: string): Promise<void> {
  await Promise.allSettled([
    redis.del(
      K.importBatch(batchId),
      K.importIndex(batchId),
      K.importMeta(batchId),
      K.importPatches(batchId),
    ),
    removeBackup(batchId),
  ]);
}

async function getBatchOrThrow(batchId: string): Promise<ImportBatchModel> {
  const batch = await prisma.importBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw ApiError.notFound("Batch import tidak ditemukan");
  return batch;
}

function assertAccess(actor: Actor, batch: ImportBatchModel): void {
  if (actor.role !== "SUPERADMIN" && batch.importedBy !== actor.id) {
    throw ApiError.forbidden("Batch ini bukan milik Anda");
  }
}

function assertPreview(batch: ImportBatchModel): void {
  if (batch.status !== "PREVIEW") {
    throw ApiError.conflict(`Batch berstatus ${batch.status}, tidak bisa diubah lagi`);
  }
}

/** Restore Redis dari MinIO bila key staging hilang/terevict. */
async function ensureStaging(batch: ImportBatchModel): Promise<StagingMeta> {
  const rowKey = K.importBatch(batch.id);
  const exists = await redis.exists(rowKey);
  if (exists) {
    const raw = await redis.hget(K.importMeta(batch.id), "meta");
    if (raw) return JSON.parse(raw) as StagingMeta;
  }

  let compressed: Buffer;
  try {
    const stream = (await minio.getObject(BUCKETS.staging, stagingKey(batch.id))) as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    }
    compressed = Buffer.concat(chunks);
  } catch (error) {
    logger.warn({ err: (error as Error).message, batchId: batch.id }, "Restore staging gagal");
    throw ApiError.notFound(
      "Staging batch tidak ditemukan (Redis dan MinIO kosong). Silakan upload ulang file.",
    );
  }

  const rows = gunzipSync(compressed)
    .toString("utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ImportRow);

  const counts = countValid(rows);
  const meta: StagingMeta = {
    filename: batch.filename,
    fileSize: batch.fileSize,
    snapshotAt: batch.snapshotAt.toISOString(),
    totalRows: rows.length,
    ...counts,
    backup: true,
  };

  await writeStaging(batch.id, rows, meta);
  logger.info({ batchId: batch.id, rows: rows.length }, "Staging import dipulihkan dari MinIO");
  return meta;
}

async function readAllRows(batchId: string): Promise<ImportRow[]> {
  const total = await redis.zcard(K.importIndex(batchId));
  if (total === 0) return [];

  const rows: ImportRow[] = [];
  const chunkSize = 2000;
  for (let start = 0; start < total; start += chunkSize) {
    const fields = await redis.zrange(K.importIndex(batchId), String(start), String(start + chunkSize - 1));
    if (fields.length === 0) break;
    const values = await redis.hmget(K.importBatch(batchId), ...fields);
    for (const value of values) {
      if (value) rows.push(JSON.parse(value) as ImportRow);
    }
  }
  return rows;
}

/** Ambil metadata lengkap (semua kolom) dari backup MinIO, bukan Redis. */
async function loadRawMap(batchId: string): Promise<Map<number, unknown>> {
  try {
    const stream = (await minio.getObject(BUCKETS.staging, stagingKey(batchId))) as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    }
    const rows = gunzipSync(Buffer.concat(chunks))
      .toString("utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ImportRow);
    return new Map(rows.map((row) => [row.rowNum, row.dataMentah ?? []]));
  } catch (error) {
    logger.error({ err: (error as Error).message, batchId }, "Gagal membaca metadata dari MinIO");
    throw ApiError.badRequest(
      "Metadata lengkap (semua kolom) hanya tersedia dari backup MinIO. Pastikan MinIO hidup lalu coba commit lagi.",
    );
  }
}

async function readPage(batchId: string, page: number, limit: number) {
  const total = await redis.zcard(K.importIndex(batchId));
  const start = (page - 1) * limit;
  const fields = await redis.zrange(K.importIndex(batchId), String(start), String(start + limit - 1));
  if (fields.length === 0) return { items: [] as ImportRow[], total };

  const values = await redis.hmget(K.importBatch(batchId), ...fields);
  const items: ImportRow[] = [];
  for (const value of values) {
    if (value) items.push(JSON.parse(value) as ImportRow);
  }
  return { items, total };
}

function refreshTtl(batchId: string): Promise<unknown> {
  return Promise.all([
    redis.expire(K.importBatch(batchId), TTL),
    redis.expire(K.importIndex(batchId), TTL),
    redis.expire(K.importMeta(batchId), TTL),
    redis.expire(K.importPatches(batchId), TTL),
  ]);
}

/** POST /preview — upload & staging. */
export async function createPreview(
  actor: Actor,
  file: { originalname: string; size: number; buffer: Buffer },
) {
  if (file.size > config.IMPORT_MAX_SIZE_MB * 1024 * 1024) {
    throw ApiError.badRequest(`Ukuran file melebihi ${config.IMPORT_MAX_SIZE_MB} MB`);
  }

  const active = await prisma.importBatch.count({
    where: {
      importedBy: actor.id,
      status: "PREVIEW",
      createdAt: { gt: new Date(Date.now() - TTL * 1000) },
    },
  });
  if (active >= 2) {
    throw ApiError.conflict(
      "Maksimal 2 batch preview aktif per user. Commit atau cancel batch sebelumnya dulu.",
    );
  }

  const { rows, headers } = parseImportFile(file.buffer, file.originalname);
  const counts = countValid(rows);
  const snapshotAt = new Date();
  const batchId = randomUUID();
  const invalidRows = rows.filter((row) => row.errors.length > 0);

  const batch = await prisma.importBatch.create({
    data: {
      id: batchId,
      filename: file.originalname,
      fileSize: file.size,
      snapshotAt,
      totalRows: rows.length,
      importedBy: actor.id,
      headers: headers as unknown as Prisma.InputJsonValue,
      // Audit: simpan maksimal 100 error pertama (Patch C).
      ...(invalidRows.length > 0
        ? { errors: invalidRows.slice(0, 100).map((row) => ({ rowNum: row.rowNum, errors: row.errors })) }
        : {}),
    },
  });

  const backup = await backupToMinio(batchId, rows);
  const meta: StagingMeta = {
    filename: file.originalname,
    fileSize: file.size,
    snapshotAt: snapshotAt.toISOString(),
    totalRows: rows.length,
    ...counts,
    backup,
  };

  try {
    await writeStaging(batchId, rows, meta);
  } catch (error) {
    await prisma.importBatch.delete({ where: { id: batchId } }).catch(() => undefined);
    await removeBackup(batchId);
    logger.error({ err: error, batchId }, "Gagal menulis staging ke Redis");
    throw ApiError.internal("Gagal menyimpan staging import. Coba lagi.");
  }

  return {
    batch: serializeBatch(batch),
    totalRows: rows.length,
    ...counts,
    backup,
  };
}

/** GET /preview/:batchId — pagination dari Redis (restore dari MinIO bila perlu). */
export async function getPreview(
  actor: Actor,
  batchId: string,
  page: number,
  limit: number,
) {
  const batch = await getBatchOrThrow(batchId);
  assertAccess(actor, batch);
  assertPreview(batch);

  const meta = await ensureStaging(batch);
  const { items, total } = await readPage(batchId, page, limit);

  return {
    batch: serializeBatch(batch),
    items,
    total,
    page,
    limit,
    meta,
  };
}

/** PATCH /preview/:batchId/row/:rowNum — edit hanya di Redis (snapshot MinIO tetap). */
export async function updatePreviewRow(
  actor: Actor,
  batchId: string,
  rowNum: number,
  patch: ImportRowPatchInput,
) {
  const batch = await getBatchOrThrow(batchId);
  assertAccess(actor, batch);
  assertPreview(batch);
  const meta = await ensureStaging(batch);

  const rows = await readAllRows(batchId);
  const index = rows.findIndex((row) => row.rowNum === rowNum);
  if (index < 0) throw ApiError.notFound(`Baris ${rowNum} tidak ditemukan`);

  const beforeValidation = rows.map((row) => JSON.stringify([row.errors, row.warnings]));
  rows[index] = applyRowPatch(rows[index], patch);
  validateImportRows(rows);

  const changed = rows.filter(
    (row, i) => i === index || JSON.stringify([row.errors, row.warnings]) !== beforeValidation[i],
  );

  const pipeline = redis.pipeline();
  for (const row of changed) pipeline.hset(K.importBatch(batchId), String(row.rowNum), JSON.stringify(row));
  pipeline.hset(
    K.importPatches(batchId),
    String(rowNum),
    JSON.stringify({ at: new Date().toISOString(), by: actor.id, changes: patch }),
  );
  await pipeline.exec();
  await refreshTtl(batchId);

  const counts = countValid(rows);
  const nextMeta: StagingMeta = { ...meta, ...counts };
  await redis.hset(K.importMeta(batchId), "meta", JSON.stringify(nextMeta));

  return { row: rows[index], ...counts };
}

/** POST /commit — transaksi UPSERT, lalu bersihkan Redis + MinIO. */
export async function commitPreview(actor: Actor, batchId: string) {
  const batch = await getBatchOrThrow(batchId);
  assertAccess(actor, batch);
  assertPreview(batch);
  await ensureStaging(batch);

  const rows = await readAllRows(batchId);
  if (rows.length === 0) throw ApiError.badRequest("Staging kosong — upload ulang file");

  const rawMap = await loadRawMap(batchId);
  const rowsWithRaw = rows.map((row) => ({
    ...row,
    dataMentah: (rawMap.get(row.rowNum) ?? []) as ImportRow["dataMentah"],
  }));
  const rowsForCommit = rowsWithRaw;
  validateImportRows(rowsForCommit);
  const invalid = rowsForCommit.filter((row) => row.errors.length > 0);
  if (invalid.length > 0) {
    throw ApiError.badRequest(
      `${invalid.length} baris masih memiliki error. Perbaiki dulu sebelum commit.`,
      invalid.slice(0, 20).map((row) => ({ rowNum: row.rowNum, errors: row.errors })),
    );
  }

  const registers = rowsForCommit
    .map((row) => row.kodeRegister)
    .filter((value): value is string => value !== null);

  const existingRegisters = new Set<string>();
  const lookupChunk = 5000;
  for (let start = 0; start < registers.length; start += lookupChunk) {
    const chunk = registers.slice(start, start + lookupChunk);
    const found = await prisma.masterAset.findMany({
      where: { kodeRegister: { in: chunk } },
      select: { kodeRegister: true },
    });
    for (const item of found) {
      if (item.kodeRegister) existingRegisters.add(item.kodeRegister);
    }
  }

  let updated = 0;
  let inserted = 0;
  for (const row of rowsForCommit) {
    if (row.kodeRegister && existingRegisters.has(row.kodeRegister)) {
      updated += 1;
    } else if (!row.kodeRegister && row.kodeBarang && row.kodeSiman) {
      const found = await prisma.masterAset.findFirst({
        where: { kodeBarang: row.kodeBarang, kodeSiman: row.kodeSiman },
        select: { id: true },
      });
      if (found) updated += 1;
      else inserted += 1;
    } else {
      inserted += 1;
    }
  }

  const now = new Date();
  const startedAt = Date.now();

  await prisma.$transaction(
    async (tx) => {
      for (const row of rowsForCommit) {
        const data = {
          kodeSiman: row.kodeSiman,
          kodeBarang: row.kodeBarang,
          nama: row.nama,
          kategori: row.kategori,
          kodeSatker: row.kodeSatker ?? config.SATKER_KODE ?? null,
          jumlahLama: row.jumlahLama,
          merk: row.merk,
          noSeri: row.noSeri,
          tahun: row.tahun,
          nilaiPerolehan: row.nilaiPerolehan,
          kondisiSiman: row.kondisiSiman,
          statusAset: row.statusAset,
          catatan: row.catatan,
          dataMentah: (row.dataMentah ?? []) as unknown as Prisma.InputJsonValue,
          syncStatus: "TERSINKRON" as const,
          snapshotAt: batch.snapshotAt,
          lastSyncAt: now,
        };

        if (row.kodeRegister) {
          await tx.masterAset.upsert({
            where: { kodeRegister: row.kodeRegister },
            update: data,
            create: { kodeRegister: row.kodeRegister, ...data },
          });
        } else if (row.kodeBarang && row.kodeSiman) {
          await tx.masterAset.upsert({
            where: { kodeBarang_kodeSiman: { kodeBarang: row.kodeBarang, kodeSiman: row.kodeSiman } },
            update: data,
            create: { ...data, kodeBarang: row.kodeBarang, kodeSiman: row.kodeSiman },
          });
        } else {
          throw ApiError.badRequest(`Baris ${row.rowNum} tidak punya kunci unik`);
        }
      }

      if (registers.length > 0) {
        await tx.masterAset.updateMany({
          where: {
            kodeRegister: { not: null, notIn: registers },
            ...(config.SATKER_KODE ? { kodeSatker: config.SATKER_KODE } : {}),
          },
          data: { syncStatus: "HILANG_DI_SIMAN", lastSyncAt: now },
        });
      }

      await tx.importBatch.update({
        where: { id: batchId },
        data: {
          status: "COMMITTED",
          inserted,
          updated,
          skipped: 0,
          committedAt: now,
        },
      });
    },
    { timeout: 300_000, maxWait: 10_000 },
  );

  const committed = await getBatchOrThrow(batchId);
  await cleanupStaging(batchId);
  await logActivity({
    actorId: actor.id,
    action: "IMPORT_COMMIT",
    entityType: "IMPORT",
    entityId: batchId,
    summary: `Import SIMAN ${batch.filename}: ${inserted} baru, ${updated} diperbarui`,
    metadata: { inserted, updated, rows: rows.length, snapshotAt: batch.snapshotAt.toISOString() },
  });
  logger.info(
    { batchId, inserted, updated, rows: rows.length, durationMs: Date.now() - startedAt },
    "Import SIMAN di-commit",
  );

  return {
    batch: serializeBatch(committed),
    inserted,
    updated,
    skipped: 0,
    durationMs: Date.now() - startedAt,
  };
}

/** POST /cancel */
export async function cancelPreview(actor: Actor, batchId: string) {
  const batch = await getBatchOrThrow(batchId);
  assertAccess(actor, batch);
  assertPreview(batch);

  const cancelled = await prisma.importBatch.update({
    where: { id: batchId },
    data: { status: "CANCELLED" },
  });
  await cleanupStaging(batchId);

  return { batch: serializeBatch(cancelled) };
}

/** GET /batches */
export async function listBatches(actor: Actor, page: number, limit: number) {
  const where = actor.role === "SUPERADMIN" ? {} : { importedBy: actor.id };
  const [items, total] = await prisma.$transaction([
    prisma.importBatch.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.importBatch.count({ where }),
  ]);

  return {
    items: items.map((batch) => ({
      ...serializeBatch(batch),
      expiresAt:
        batch.status === "PREVIEW"
          ? new Date(batch.createdAt.getTime() + TTL * 1000).toISOString()
          : null,
    })),
    total,
    page,
    limit,
  };
}
