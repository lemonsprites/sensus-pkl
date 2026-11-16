import pino from "pino";

import { config } from "./config.js";

/**
 * Log JSON (aman untuk platform). Redaksi header sensitif supaya token/cookie
 * tidak pernah masuk berkas log.
 */
export const logger = pino({
  level: config.LOG_LEVEL,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers.set-cookie",
      "res.headers['set-cookie']",
    ],
    censor: "[disamarkan]",
  },
});
