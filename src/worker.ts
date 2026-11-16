/**
 * Worker terpisah (service ke-2 di platform).
 * M1–M2: hanya koneksi + idle; job thumbnail/import masuk M5+.
 * Jangan pernah scale worker > 1 instance untuk job non-idempoten (lihat brief).
 */
import { config } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { closeRedis, connectRedis } from "./lib/redis.js";

async function main(): Promise<void> {
  const redisOk = await connectRedis();
  logger.info(
    { env: config.NODE_ENV, redis: redisOk },
    "Worker siap (belum ada job sampai M5)",
  );

  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info(`${signal} diterima — menutup worker`);
    await Promise.allSettled([prisma.$disconnect(), closeRedis()]);
    process.exit(0);
  };

  process.on("SIGTERM", () => void stop("SIGTERM"));
  process.on("SIGINT", () => void stop("SIGINT"));
}

void main().catch((error) => {
  logger.fatal({ err: error }, "Worker gagal start");
  process.exit(1);
});
