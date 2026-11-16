// Prisma 7: .env TIDAK dimuat otomatis saat memakai prisma.config.ts.
import "dotenv/config";

import { defineConfig } from "prisma/config";

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL belum di-set. Salin .env.example menjadi .env.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
