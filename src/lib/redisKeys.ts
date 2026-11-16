import { config } from "./config.js";

/**
 * Registry key Redis — SATU-SATUNYA tempat prefix dibentuk.
 *
 * Format wajib: {REDIS_KEY_VERSION}:{REDIS_PREFIX}:
 * Patch C menulis contoh `inv:v1:{prefix}`; direkonsiliasi menjadi `v1:inv:`
 * agar tetap sesuai aturan v1 ({version}:{prefix}:).
 *
 * Penting: client ioredis TIDAK memakai opsi keyPrefix. Semua key di sini
 * sudah lengkap, sehingga SCAN MATCH (yang tidak menghormati keyPrefix)
 * konsisten dan tidak terjadi double-prefix.
 */
const NS = `${config.REDIS_KEY_VERSION}:${config.REDIS_PREFIX}:`;

export const K = {
  namespace: () => NS,
  /** Key lengkap dari suffix. */
  key: (suffix: string) => `${NS}${suffix}`,
  /** Pattern lengkap untuk SCAN MATCH. */
  scan: (pattern: string) => `${NS}${pattern}`,

  // Rate limit (prefix eksplisit untuk rate-limit-redis).
  rlPrefix: (scope: string) => `${NS}rl:${scope}:`,
  rl: (scope: string, identity: string) => `${NS}rl:${scope}:${identity}`,

  // Import SIMAN (Patch C).
  importBatch: (batchId: string) => `${NS}import:${batchId}`,
  importIndex: (batchId: string) => `${NS}import:${batchId}:index`,
  importMeta: (batchId: string) => `${NS}import:meta:${batchId}`,
  importPatches: (batchId: string) => `${NS}import:${batchId}:patches`,

  // Umum.
  job: (queue: string, id: string) => `${NS}job:${queue}:${id}`,
  lock: (name: string) => `${NS}lock:${name}`,
  cache: (scope: string, key: string) => `${NS}cache:${scope}:${key}`,
} as const;
