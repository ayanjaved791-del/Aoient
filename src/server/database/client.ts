import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Single Prisma client per process, created lazily on first use. Importing this
 * module never touches the database, so the app builds and runs without
 * DATABASE_URL in browser-only account mode (nothing calls the database then).
 * In development the instance is cached on `globalThis` so hot reloads do not
 * exhaust database connections.
 */
const globalForPrisma = globalThis as unknown as { __aoientPrisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set. See .env.example.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

function getClient(): PrismaClient {
  if (!globalForPrisma.__aoientPrisma) globalForPrisma.__aoientPrisma = createClient();
  return globalForPrisma.__aoientPrisma;
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export type Db = PrismaClient;
/** Transaction client type (the `tx` argument in `db.$transaction(async (tx) => …)`). */
export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;
