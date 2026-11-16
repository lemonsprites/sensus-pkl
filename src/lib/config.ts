import { config as loadEnv } from "dotenv";
import { z } from "zod";

// Muat .env dari root repo (cwd saat dev/start). Di platform, env disuntikkan.
loadEnv({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined)),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),
  SHADOW_DATABASE_URL: z.string().optional(),

  REDIS_URL: z.string().min(1).default("redis://127.0.0.1:6379"),
  /** Prefix aplikasi. Key final: {REDIS_KEY_VERSION}:{REDIS_PREFIX}: */
  REDIS_PREFIX: z.string().min(1).default("inv"),
  REDIS_KEY_VERSION: z.string().min(1).default("v1"),

  JWT_SECRET: z.string().min(32, "JWT_SECRET minimal 32 karakter"),
  JWT_EXPIRES_IN: z.string().default("12h"),

  SEED_SUPERADMIN_USERNAME: z.string().optional(),
  /** @deprecated fallback kompatibilitas; gunakan SEED_SUPERADMIN_USERNAME. */
  SEED_SUPERADMIN_EMAIL: z.string().optional(),
  SEED_SUPERADMIN_PASSWORD: z.string().optional(),

  /** Endpoint internal untuk operasi server-side. */
  MINIO_ENDPOINT: z.string().url().default("http://127.0.0.1:9000"),
  /** Endpoint publik untuk presigned URL (produksi: https://s3.domain). */
  MINIO_PUBLIC_ENDPOINT: z.string().url().optional(),
  MINIO_REGION: z.string().default("us-east-1"),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET_FOTO: z.string().default("inventaris-foto"),
  MINIO_BUCKET_THUMB: z.string().default("inventaris-thumb"),
  MINIO_BUCKET_PRIVATE: z.string().default("private"),
  MINIO_BUCKET_STAGING: z.string().default("inventaris-staging"),

  SATKER_KODE: z.string().optional(),
  NUP_REGEX: z.string().optional(),
  /** Isi QR label: kode_register (default, unik) | nup | custom. */
  QR_CONTENT_FORMAT: z.enum(["kode_register", "nup", "custom"]).default("kode_register"),

  /** Patch C — batas & TTL staging import. */
  IMPORT_MAX_ROWS: z.coerce.number().int().min(1).max(50000).default(50000),
  IMPORT_MAX_SIZE_MB: z.coerce.number().int().min(1).max(200).default(50),
  IMPORT_TTL_SECONDS: z.coerce.number().int().min(300).default(7200),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detail = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Environment tidak valid:\n${detail}`);
}

export const config = {
  ...parsed.data,
  // Dev: endpoint publik = internal. Produksi wajib diisi s3.domain.
  MINIO_PUBLIC_ENDPOINT: parsed.data.MINIO_PUBLIC_ENDPOINT ?? parsed.data.MINIO_ENDPOINT,
};

export const isProduction = config.NODE_ENV === "production";
export const isTest = config.NODE_ENV === "test";

export const corsOrigins = config.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
