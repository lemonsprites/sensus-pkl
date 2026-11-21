import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";

import sharp from "sharp";

import { BUCKETS, minio, minioPresign } from "../lib/minio.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { logActivity } from "./activityService.js";
import type { DokumenConfirmInput, DokumenPresignInput } from "../schemas/dokumen.js";
import { ApiError } from "../utils/apiError.js";

export const MAX_DOKUMEN_BYTES = 15 * 1024 * 1024;
const PRESIGN_SECONDS = 15 * 60;
type Jenis = "FOTO" | "DOKUMEN";

/** Ekstensi dokumen pendukung yang diterima (selain gambar & PDF). */
const DOKUMEN_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "webp", "gif", "bmp", "heic", "heif", "tif", "tiff",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp",
  "csv", "txt", "rtf", "zip", "rar", "7z", "tar", "gz",
]);

/** MIME fallback saat browser mengirim application/octet-stream atau kosong. */
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  gif: "image/gif", bmp: "image/bmp", heic: "image/heic", heif: "image/heif",
  tif: "image/tiff", tiff: "image/tiff", pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  csv: "text/csv", txt: "text/plain", rtf: "application/rtf",
  zip: "application/zip", rar: "application/vnd.rar", "7z": "application/x-7z-compressed",
  tar: "application/x-tar", gz: "application/gzip",
};

function extensionOf(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function bucketFor(jenis: Jenis): string {
  return jenis === "FOTO" ? BUCKETS.foto : BUCKETS.private;
}

function extensionFor(filename: string, contentType: string): string {
  const fromName = extensionOf(filename);
  if (/^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "application/pdf") return "pdf";
  return "jpg";
}

function normalizeContentType(contentType: string | undefined, filename: string): string {
  const type = (contentType ?? "").trim().toLowerCase();
  if (type && type !== "application/octet-stream") return type;
  return MIME_BY_EXTENSION[extensionOf(filename)] ?? type ?? "application/octet-stream";
}

function validateContent(jenis: Jenis, contentType: string, filename = ""): void {
  const type = contentType.toLowerCase();
  if (jenis === "FOTO" && !type.startsWith("image/")) {
    throw ApiError.badRequest("Foto harus berupa file gambar (JPEG/PNG/WebP)");
  }
  if (jenis === "DOKUMEN") {
    const knownMime =
      type.startsWith("image/") ||
      /pdf|msword|ms-excel|ms-powerpoint|officedocument|opendocument|text\/|csv|zip|rar|7z|gzip|tar/.test(type);
    const knownExtension = DOKUMEN_EXTENSIONS.has(extensionOf(filename));
    const genericType = !type || type === "application/octet-stream" || type === "binary/octet-stream";
    if (!knownMime && !(genericType && knownExtension)) {
      throw ApiError.badRequest(
        "Dokumen harus berupa gambar, PDF, Office (Word/Excel/PowerPoint), atau arsip",
      );
    }
  }
}

async function getGrup(grupId: string) {
  const group = await prisma.sensusGrup.findUnique({
    where: { id: grupId },
    select: { id: true, status: true, docsComplete: true, kodeBarang: true, namaBarang: true, jumlah: true },
  });
  if (!group) throw ApiError.notFound("Grup sensus tidak ditemukan");
  return group;
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

async function makeThumbnail(grupId: string, bucket: string, key: string): Promise<string | null> {
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
    const thumbKey = `thumb/${grupId}/${randomUUID()}.jpg`;
    await minio.putObject(BUCKETS.thumb, thumbKey, output, output.length, {
      "Content-Type": "image/jpeg",
    });
    return thumbKey;
  } catch (error) {
    logger.warn({ err: (error as Error).message, key }, "Gagal membuat thumbnail");
    return null;
  }
}

/** Foto grup → DOCS_COMPLETE untuk seluruh NUP dalam grup. */
async function syncDocsComplete(grupId: string): Promise<void> {
  const group = await prisma.sensusGrup.findUnique({
    where: { id: grupId },
    select: { status: true },
  });
  if (!group) return;

  const fotoCount = await prisma.sensusDokumen.count({
    where: { grupId, jenis: "FOTO" },
  });

  if (group.status === "ASSESSED" && fotoCount > 0) {
    await prisma.$transaction([
      prisma.sensusGrup.update({
        where: { id: grupId },
        data: { status: "DOCS_COMPLETE", docsComplete: true },
      }),
      prisma.sensus.updateMany({
        where: { grupId },
        data: { status: "DOCS_COMPLETE", docsComplete: true },
      }),
    ]);
  } else if (group.status === "DOCS_COMPLETE" && fotoCount === 0) {
    await prisma.$transaction([
      prisma.sensusGrup.update({
        where: { id: grupId },
        data: { status: "ASSESSED", docsComplete: false },
      }),
      prisma.sensus.updateMany({
        where: { grupId },
        data: { status: "ASSESSED", docsComplete: false },
      }),
    ]);
  }
}

export async function presignUpload(grupId: string, input: DokumenPresignInput) {
  const group = await getGrup(grupId);
  validateContent(input.jenis, input.contentType);
  const bucket = bucketFor(input.jenis);
  const ext = extensionFor(input.filename, input.contentType);
  const objectKey = `grup/${group.id}/${randomUUID()}.${ext}`;
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

/** Simpan metadata + thumbnail setelah objek dipastikan ada di MinIO. */
async function finalizeUpload(
  actorId: string,
  group: { id: string; kodeBarang: string; namaBarang: string },
  jenis: Jenis,
  bucket: string,
  objectKey: string,
  contentType: string,
  size: number,
) {
  const thumbKey =
    jenis === "FOTO" && contentType.startsWith("image/")
      ? await makeThumbnail(group.id, bucket, objectKey)
      : null;

  const created = await prisma.sensusDokumen.create({
    data: {
      grupId: group.id,
      jenis,
      bucket,
      objectKey,
      thumbKey,
      contentType,
      size,
      uploadedById: actorId,
    },
    select: {
      id: true, jenis: true, bucket: true, objectKey: true, thumbKey: true,
      contentType: true, size: true, createdAt: true,
      uploadedBy: { select: { id: true, nama: true } },
    },
  });

  await syncDocsComplete(group.id);
  const updated = await getGrup(group.id);
  await logActivity({
    actorId,
    action: "DOC_UPLOAD",
    entityType: "SENSUS_GRUP",
    entityId: group.id,
    summary: `Unggah ${jenis} ${group.namaBarang} (${group.kodeBarang})`,
    metadata: { dokumenId: created.id, objectKey: created.objectKey, jenis: created.jenis },
  });
  return { dokumen: await serialize(created), sensusStatus: updated.status };
}

export async function confirmUpload(actorId: string, grupId: string, input: DokumenConfirmInput) {
  const group = await getGrup(grupId);
  const bucket = bucketFor(input.jenis);
  if (!input.objectKey.startsWith(`grup/${group.id}/`)) {
    throw ApiError.badRequest("Object key tidak sesuai dengan grup sensus ini");
  }

  const existing = await prisma.sensusDokumen.findUnique({
    where: { objectKey: input.objectKey },
    select: {
      id: true, jenis: true, bucket: true, objectKey: true, thumbKey: true,
      contentType: true, size: true, createdAt: true,
      uploadedBy: { select: { id: true, nama: true } },
    },
  });
  if (existing) return { dokumen: await serialize(existing), sensusStatus: group.status };

  let stat: { size: number; metaData?: Record<string, string> };
  try {
    stat = (await minio.statObject(bucket, input.objectKey)) as {
      size: number;
      metaData?: Record<string, string>;
    };
  } catch {
    throw ApiError.badRequest("File belum ditemukan di MinIO. Upload ke presigned URL dulu.");
  }
  if (stat.size > MAX_DOKUMEN_BYTES) throw ApiError.badRequest("Ukuran file maksimal 15 MB");

  const contentType = normalizeContentType(
    input.contentType ?? stat.metaData?.["content-type"],
    input.objectKey,
  );
  validateContent(input.jenis, contentType, input.objectKey);

  return finalizeUpload(actorId, group, input.jenis, bucket, input.objectKey, contentType, stat.size);
}

export interface DirectUploadInput {
  jenis: Jenis;
  filename: string;
  contentType?: string;
  buffer: Buffer;
}

/**
 * Upload via server (multipart). Tidak bergantung CORS MinIO di browser,
 * jadi tetap berhasil meski presigned PUT diblokir CORS/DNS publik.
 */
export async function uploadDirect(actorId: string, grupId: string, input: DirectUploadInput) {
  const group = await getGrup(grupId);
  if (!input.buffer || input.buffer.length === 0) {
    throw ApiError.badRequest("File kosong atau gagal dibaca");
  }
  if (input.buffer.length > MAX_DOKUMEN_BYTES) {
    throw ApiError.badRequest("Ukuran file maksimal 15 MB");
  }

  const contentType = normalizeContentType(input.contentType, input.filename);
  validateContent(input.jenis, contentType, input.filename);

  const bucket = bucketFor(input.jenis);
  const objectKey = `grup/${group.id}/${randomUUID()}.${extensionFor(input.filename, contentType)}`;
  await minio.putObject(bucket, objectKey, input.buffer, input.buffer.length, {
    "Content-Type": contentType,
  });

  return finalizeUpload(
    actorId,
    group,
    input.jenis,
    bucket,
    objectKey,
    contentType,
    input.buffer.length,
  );
}

export async function listDokumen(grupId: string) {
  const group = await getGrup(grupId);
  const docs = await prisma.sensusDokumen.findMany({
    where: { grupId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, jenis: true, bucket: true, objectKey: true, thumbKey: true,
      contentType: true, size: true, createdAt: true,
      uploadedBy: { select: { id: true, nama: true } },
    },
  });
  const items = await Promise.all(docs.map((doc) => serialize(doc)));
  return { sensusStatus: group.status, docsComplete: group.docsComplete, items };
}

export async function deleteDokumen(
  actor: { id: string; role: string },
  grupId: string,
  dokumenId: string,
) {
  const group = await getGrup(grupId);
  const doc = await prisma.sensusDokumen.findFirst({
    where: { id: dokumenId, grupId },
    select: { id: true, bucket: true, objectKey: true, thumbKey: true, uploadedById: true },
  });
  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");
  if (actor.role !== "ADMIN" && actor.role !== "SUPERADMIN" && doc.uploadedById !== actor.id) {
    throw ApiError.forbidden("Hanya pengunggah atau ADMIN yang boleh menghapus dokumen");
  }
  await Promise.allSettled([
    minio.removeObject(doc.bucket, doc.objectKey),
    doc.thumbKey ? minio.removeObject(BUCKETS.thumb, doc.thumbKey) : Promise.resolve(),
  ]);
  await prisma.sensusDokumen.delete({ where: { id: doc.id } });
  await syncDocsComplete(group.id);
  const updated = await getGrup(group.id);
  await logActivity({
    actorId: actor.id,
    action: "DOC_DELETE",
    entityType: "SENSUS_GRUP",
    entityId: group.id,
    summary: `Hapus dokumen ${group.namaBarang} (${group.kodeBarang})`,
    metadata: { dokumenId: doc.id, objectKey: doc.objectKey },
  });
  return { sensusStatus: updated.status, docsComplete: updated.docsComplete };
}
