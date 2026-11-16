import { Client } from "minio";

import { config } from "./config.js";
import { logger } from "./logger.js";

function parseEndpoint(raw: string) {
  const url = new URL(raw);
  return {
    endPoint: url.hostname,
    port: url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80,
    useSSL: url.protocol === "https:",
  };
}

function createMinioClient(rawEndpoint: string): Client {
  const { endPoint, port, useSSL } = parseEndpoint(rawEndpoint);
  return new Client({
    endPoint,
    port,
    useSSL,
    accessKey: config.MINIO_ACCESS_KEY,
    secretKey: config.MINIO_SECRET_KEY,
    region: config.MINIO_REGION,
  });
}

/** Operasi server-side (upload worker, copy, hapus, stat). */
export const minio = createMinioClient(config.MINIO_ENDPOINT);

/**
 * Presigned URL WAJIB memakai client ini (endpoint publik s3.domain).
 * Kalau memakai `minio` (internal), browser akan 403.
 */
export const minioPresign = createMinioClient(config.MINIO_PUBLIC_ENDPOINT);

export const BUCKETS = {
  foto: config.MINIO_BUCKET_FOTO,
  thumb: config.MINIO_BUCKET_THUMB,
  private: config.MINIO_BUCKET_PRIVATE,
  staging: config.MINIO_BUCKET_STAGING,
} as const;

export async function checkMinio(): Promise<{ ok: boolean; buckets: Record<string, boolean> }> {
  const entries = await Promise.all(
    Object.entries(BUCKETS).map(async ([name, bucket]) => {
      try {
        return [name, await minio.bucketExists(bucket)] as const;
      } catch (error) {
        logger.warn({ err: (error as Error).message, bucket }, "Cek bucket MinIO gagal");
        return [name, false] as const;
      }
    }),
  );

  return {
    ok: entries.every(([, exists]) => exists),
    buckets: Object.fromEntries(entries),
  };
}

/** Dev/setup saja — jangan dipanggil otomatis saat boot produksi. */
export async function ensureBuckets(): Promise<string[]> {
  const created: string[] = [];
  for (const bucket of Object.values(BUCKETS)) {
    if (!(await minio.bucketExists(bucket))) {
      await minio.makeBucket(bucket, config.MINIO_REGION);
      created.push(bucket);
    }
  }
  return created;
}
