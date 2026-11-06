import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Single Prisma client per process. In development the instance is cached on
 * `globalThis` so hot reloads do not exhaust database connections.
 */
const globalForPrisma = globalThis as unknown as { __aoientPrisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set. See .env.example.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const db: PrismaClient = globalForPrisma.__aoientPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.__aoientPrisma = db;

export type Db = PrismaClient;
/** Transaction client type (the `tx` argument in `db.$transaction(async (tx) => …)`). */
export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;
