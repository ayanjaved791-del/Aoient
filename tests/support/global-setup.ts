import { execSync } from "node:child_process";
import "dotenv/config";

/** Apply migrations to the dedicated test database once per run. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    // Unit tests need no database. Integration tests will fail loudly without one.
    console.warn("TEST_DATABASE_URL is not set — integration tests will fail. Unit tests: npm run test:unit");
    return;
  }
  if (url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL — tests wipe it.");
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
