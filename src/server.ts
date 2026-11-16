import { createServer } from "node:http";

import { app } from "./app.js";
import { config } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { closeRedis, connectRedis } from "./lib/redis.js";

const httpServer = createServer(app);

const start = async () => {
  await connectRedis();

  // WAJIB 0.0.0.0 — platform tidak bisa menjangkau 127.0.0.1.
  httpServer.listen(config.PORT, "0.0.0.0", () => {
    logger.info(
      { port: config.PORT, env: config.NODE_ENV },
      "API sensus siap di /api (health: /api/health)",
    );
  });
};

let shuttingDown = false;

const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} diterima — menutup server`);

  const force = setTimeout(() => {
    logger.error("Shutdown melebihi 10 detik — keluar paksa");
    process.exit(1);
  }, 10_000);
  force.unref();

  httpServer.close(() => {
    void (async () => {
      await Promise.allSettled([prisma.$disconnect(), closeRedis()]);
      clearTimeout(force);
      logger.info("Server ditutup");
      process.exit(0);
    })();
  });
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

start().catch((error) => {
  logger.fatal({ err: error }, "Gagal menjalankan API");
  process.exit(1);
});
