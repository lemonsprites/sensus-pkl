import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";

import sharp from "sharp";

import { BUCKETS, minio, minioPresign } from "../lib/minio.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import type { DokumenConfirmInput, DokumenPresignInput } from "../schemas/dokumen.js";
import { ApiError } from "../utils/apiError.js";

const MAX_BYTES = 15 * 1024 * 1024;
const PRESIGN_SECONDS = 15 * 60;

type Jenis = "FOTO" | "DOKUMEN";

function bucketFor(jenis: Jenis): string {
  return jenis === "FOTO" ? BUCKETS.foto : BUCKETS.private;
}

function extensionFor(filename: string, contentType: string): string {
  const fromName = filename.split(".").pop()?.toLowerCase() ?? "";
  if (/^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "application/pdf") return "pdf";
  return "jpg";
}

function validateContent(jenis: Jenis, contentType: string): void {
  const type = contentType.toLowerCase();
  if (jenis === "FOTO" && !type.startsWith("image/")) {
    throw ApiError.badRequest("Foto harus berupa file gambar (JPEG/PNG/WebP)");
  }
  if (jenis === "DOKUMEN" && !(type.startsWith("image/") || type === "application/pdf")) {
    throw ApiError.badRequest("Dokumen harus berupa gambar atau PDF");
  }
}

async function getSensus(barangLamaId: string) {
  const sensus = await prisma.sensus.findUnique({
    where: { barangLamaId },
    select: { id: true, status: true, docsComplete: true },
  });
  if (!sensus) {
    throw ApiError.badRequest("Simpan hasil sensus dulu sebelum upload dokumen pendukung");
  }
  return sensus;
}

async function presignGet(bucket: string, key: string): Promise<string> {
  return minioPresign.presignedGetObject(bucket, key, PRESIGN_SECONDS);
}

async function serialize(doc: {
  id: string;
  jenis: Jenis;
  bucket: string;
  objectKey: string;
  thumbKey: string | null;
  contentType: string | null;
  size: number | null;
  createdAt: Date;
  uploadedBy: { id: string; nama: string };
}) {
  const [url, thumbUrl] = await Promise.all([
    presignGet(doc.bucket, doc.objectKey),
    doc.thumbKey ? presignGet(BUCKETS.thumb, doc.thumbKey) : Promise.resolve(null),
  ]);

  return {
    id: doc.id,
    jenis: doc.jenis,
    contentType: doc.contentType,
    size: doc.size,
    createdAt: doc.createdAt.toISOString(),
    uploadedBy: doc.uploadedBy,
    url,
    thumbUrl,
  };
}

async function makeThumbnail(sensusId: string, bucket: string, key: string): Promise<string | null> {
  try {
    const stream = (await minio.getObject(bucket, key)) as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    }

    const output = await sharp(Buffer.concat(chunks))
      .rotate()
      .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();

    const thumbKey = `thumb/${sensusId}/${randomUUID()}.jpg`;
    await minio.putObject(BUCKETS.thumb, thumbKey, output, output.length, {
      "Content-Type": "image/jpeg",
    });
    return thumbKey;
  } catch (error) {
    logger.warn({ err: (error as Error).message, key }, "Gagal membuat thumbnail");
    return null;
  }
}

/** ASSESSED + minimal 1 foto → DOCS_COMPLETE; foto habis → kembali ASSESSED. */
async function syncDocsComplete(sensusId: string): Promise<void> {
  const sensus = await prisma.sensus.findUnique({
    where: { id: sensusId },
    select: { status: true },
  });
  if (!sensus) return;

  const fotoCount = await prisma.sensusDokumen.count({
    where: { sensusId, jenis: "FOTO" },
  });

  if (sensus.status === "ASSESSED" && fotoCount > 0) {
    await prisma.sensus.update({
      where: { id: sensusId },
      data: { status: "DOCS_COMPLETE", docsComplete: true },
    });
  } else if (sensus.status === "DOCS_COMPLETE" && fotoCount === 0) {
    await prisma.sensus.update({
      where: { id: sensusId },
      data: { status: "ASSESSED", docsComplete: false },
    });
  }
}

export async function presignUpload(
  actorId: string,
  barangLamaId: string,
  input: DokumenPresignInput,
) {
  void actorId;
  const sensus = await getSensus(barangLamaId);
  validateContent(input.jenis, input.contentType);

  const bucket = bucketFor(input.jenis);
  const ext = extensionFor(input.filename, input.contentType);
  const objectKey = `sensus/${sensus.id}/${randomUUID()}.${ext}`;
  const uploadUrl = await minioPresign.presignedPutObject(bucket, objectKey, PRESIGN_SECONDS);

  return {
    uploadUrl,
    method: "PUT" as const,
    bucket,
    objectKey,
    jenis: input.jenis,
    contentType: input.contentType,
    expiresIn: PRESIGN_SECONDS,
  };
}

export async function confirmUpload(
  actorId: string,
  barangLamaId: string,
  input: DokumenConfirmInput,
) {
  const sensus = await getSensus(barangLamaId);
  const bucket = bucketFor(input.jenis);

  if (!input.objectKey.startsWith(`sensus/${sensus.id}/`)) {
    throw ApiError.badRequest("Object key tidak sesuai dengan sensus ini");
  }

  const existing = await prisma.sensusDokumen.findUnique({
    where: { objectKey: input.objectKey },
    select: {
      id: true, jenis: true, bucket: true, objectKey: true, thumbKey: true,
      contentType: true, size: true, createdAt: true,
      uploadedBy: { select: { id: true, nama: true } },
    },
  });
  if (existing) return { dokumen: await serialize(existing as never), sensusStatus: sensus.status };

  let stat: { size: number; metaData?: Record<string, string> };
  try {
    stat = (await minio.statObject(bucket, input.objectKey)) as {
      size: number;
      metaData?: Record<string, string>;
    };
  } catch {
    throw ApiError.badRequest("File belum ditemukan di MinIO. Upload ke presigned URL dulu.");
  }

  if (stat.size > MAX_BYTES) throw ApiError.badRequest("Ukuran file maksimal 15 MB");

  const contentType =
    input.contentType ?? stat.metaData?.["content-type"] ?? "application/octet-stream";
  validateContent(input.jenis, contentType);

  const thumbKey =
    input.jenis === "FOTO" && contentType.startsWith("image/")
      ? await makeThumbnail(sensus.id, bucket, input.objectKey)
      : null;

  const created = await prisma.sensusDokumen.create({
    data: {
      sensusId: sensus.id,
      jenis: input.jenis,
      bucket,
      objectKey: input.objectKey,
      thumbKey,
      contentType,
      size: stat.size,
      uploadedById: actorId,
    },
    select: {
      id: true, jenis: true, bucket: true, objectKey: true, thumbKey: true,
      contentType: true, size: true, createdAt: true,
      uploadedBy: { select: { id: true, nama: true } },
    },
  });

  await syncDocsComplete(sensus.id);
  const updated = await getSensus(barangLamaId);

  return { dokumen: await serialize(created), sensusStatus: updated.status };
}

export async function listDokumen(barangLamaId: string) {
  const sensus = await getSensus(barangLamaId);
  const docs = await prisma.sensusDokumen.findMany({
    where: { sensusId: sensus.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, jenis: true, bucket: true, objectKey: true, thumbKey: true,
      contentType: true, size: true, createdAt: true,
      uploadedBy: { select: { id: true, nama: true } },
    },
  });

  const items = await Promise.all(docs.map((doc) => serialize(doc)));
  return { sensusStatus: sensus.status, docsComplete: sensus.docsComplete, items };
}

export async function deleteDokumen(
  barangLamaId: string,
  dokumenId: string,
): Promise<{ sensusStatus: string; docsComplete: boolean }> {
  const sensus = await getSensus(barangLamaId);
  const doc = await prisma.sensusDokumen.findFirst({
    where: { id: dokumenId, sensusId: sensus.id },
    select: { id: true, bucket: true, objectKey: true, thumbKey: true },
  });
  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");

  await Promise.allSettled([
    minio.removeObject(doc.bucket, doc.objectKey),
    doc.thumbKey ? minio.removeObject(BUCKETS.thumb, doc.thumbKey) : Promise.resolve(),
  ]);
  await prisma.sensusDokumen.delete({ where: { id: doc.id } });
  await syncDocsComplete(sensus.id);

  const updated = await getSensus(barangLamaId);
  return { sensusStatus: updated.status, docsComplete: updated.docsComplete };
}
