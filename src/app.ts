import { existsSync } from "node:fs";
import { resolve } from "node:path";

import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { corsOrigins, isProduction } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { apiRouter } from "./routes/index.js";

export const app = express();

app.disable("x-powered-by");
// Platform menaruh aplikasi di belakang SATU proxy (nginx/load balancer).
// Jangan `true`: itu mempercayai X-Forwarded-For apa pun dari klien.
app.set("trust proxy", 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin(origin, callback) {
      // Tanpa Origin = curl / same-origin.
      if (!origin) return callback(null, true);
      // Dev: izinkan localhost/127.0.0.1 port apa pun.
      if (!isProduction && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(null, corsOrigins.includes(origin));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === "/api/health" },
  }),
);

app.use("/api", apiRouter);
// /api/* yang tidak match → JSON 404, JANGAN jatuh ke SPA fallback.
app.use("/api", notFoundHandler);

// SPA: hanya aktif kalau hasil build ada (dev frontend dilayani Vite).
const webDist = [resolve(process.cwd(), "dist/web"), resolve(import.meta.dirname, "../web")]
  .find((dir) => existsSync(resolve(dir, "index.html")));

if (webDist) {
  app.use(express.static(webDist, { index: false, maxAge: "1h" }));
  // Regex, BUKAN app.get("*"): path /api/* tidak boleh balik HTML.
  app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(resolve(webDist, "index.html"));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);
