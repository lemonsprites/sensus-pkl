import { Redis } from "ioredis";

import { config } from "./config.js";
import { logger } from "./logger.js";

const redisOptions = {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
  retryStrategy: (times: number) => Math.min(times * 200, 5000),
};

/** Client utama (cache, counter, staging import). */
export const redis = new Redis(config.REDIS_URL, redisOptions);

/**
 * Koneksi mentah TANPA keyPrefix — dipakai rate-limit-redis (prefix diatur
 * eksplisit lewat K.rlPrefix) dan SCAN (SCAN tidak menghormati keyPrefix).
 */
export const redisRaw = new Redis(config.REDIS_URL, redisOptions);

for (const client of [redis, redisRaw]) {
  client.on("error", (error: Error) => {
    logger.warn({ err: error.message }, "Redis error");
  });
}

export async function connectRedis(): Promise<boolean> {
  try {
    await Promise.all(
      [redis, redisRaw].map((client) =>
        client.status === "wait" ? client.connect() : Promise.resolve(),
      ),
    );
    return true;
  } catch (error) {
    // Redis boleh hilang: API tetap hidup, /health melaporkan redis=false.
    logger.warn({ err: (error as Error).message }, "Redis tidak tersedia");
    return false;
  }
}

export const redisReady = () => redis.status === "ready";

/** SCAN dengan pattern LENGKAP dari K.scan(...) — bukan suffix. */
export async function scanKeys(pattern: string, count = 500): Promise<string[]> {
  const found: string[] = [];
  let cursor = "0";
  do {
    const [next, keys] = await redisRaw.scan(cursor, "MATCH", pattern, "COUNT", count);
    cursor = next;
    found.push(...keys);
  } while (cursor !== "0");
  return found;
}

export async function closeRedis(): Promise<void> {
  await Promise.allSettled(
    [redis, redisRaw].filter((client) => client.status !== "end").map((client) => client.quit()),
  );
}
