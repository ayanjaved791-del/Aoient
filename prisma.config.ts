import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Optional so `prisma generate` (run on `npm install`) works without a database,
    // e.g. in browser-only account mode. Migrate/seed commands still need it.
    url: process.env.DATABASE_URL ?? "",
  },
});
