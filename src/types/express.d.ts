import type { Role } from "../generated/prisma/enums.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
        tokenVersion: number;
      };
      /** Hasil parse Zod (validate.ts) — Express 5 membuat req.query read-only. */
      validated?: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
    }
  }
}

export {};
