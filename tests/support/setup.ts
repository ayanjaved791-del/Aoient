import "dotenv/config";

// Point every module (including the shared Prisma client) at the test database.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.APP_URL = "http://localhost:3000";
(process.env as Record<string, string>).NODE_ENV = "test";
