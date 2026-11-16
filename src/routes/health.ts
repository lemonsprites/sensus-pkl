import { Router } from "express";

import { checkMinio } from "../lib/minio.js";
import { prisma } from "../lib/prisma.js";
import { redis, redisReady } from "../lib/redis.js";
import { K } from "../lib/redisKeys.js";

export const healthRouter = Router();

async function checkPg(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  if (!redisReady()) return false;
  try {
    return (await redis.ping()) === "PONG";
  } catch {
    return false;
  }
}

/** GET /api/health — DoD M1: { ok, pg, redis, minio } semua true. */
healthRouter.get("/", async (_req, res) => {
  const [pg, redisOk, minioResult] = await Promise.all([
    checkPg(),
    checkRedis(),
    checkMinio(),
  ]);

  const ok = pg && redisOk && minioResult.ok;

  res.status(ok ? 200 : 503).json({
    ok,
    pg,
    redis: redisOk,
    minio: minioResult.ok,
    uptime: Math.round(process.uptime()),
    version: K.namespace(),
    timestamp: new Date().toISOString(),
    ...(ok ? {} : { detail: { minioBuckets: minioResult.buckets } }),
  });
});
