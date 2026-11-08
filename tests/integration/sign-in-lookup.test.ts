/** Explaining a refused sign-in: account or not, with limits so it can't test email lists. */
import { beforeEach, describe, expect, it } from "vitest";
import { createUser, db, resetDatabase } from "../support/db";
import { clientKeyFrom, explainSignInFailure } from "@/server/auth/account-lookup";

describe("explainSignInFailure", () => {
  beforeEach(resetDatabase);

  it("tells apart no account, wrong password, unconfirmed and deactivated", async () => {
    await createUser({ email: "ok@example.test" });
    await createUser({ email: "new@example.test", verified: false });
    const off = await createUser({ email: "off@example.test" });
    await db()`update profile set status = 'deactivated' where id = ${off.id}`;

    expect(await explainSignInFailure("nobody@example.test", "ip-1")).toBe("no-account");
    expect(await explainSignInFailure("  OK@Example.test ", "ip-1")).toBe("wrong-password");
    expect(await explainSignInFailure("new@example.test", "ip-1")).toBe("unconfirmed");
    expect(await explainSignInFailure("off@example.test", "ip-1")).toBe("deactivated");
    expect(await explainSignInFailure("not-an-email", "ip-1")).toBe("unknown");
  });

  it("stops answering after too many lookups from one address or for one email", async () => {
    for (let i = 0; i < 20; i++) await explainSignInFailure(`person${i}@example.test`, "ip-busy");
    expect(await explainSignInFailure("another@example.test", "ip-busy")).toBe("unknown");

    for (let i = 0; i < 10; i++) await explainSignInFailure("target@example.test", `ip-${i}`);
    expect(await explainSignInFailure("target@example.test", "ip-fresh")).toBe("unknown");
  });

  it("reads the caller's address from the platform headers", () => {
    expect(clientKeyFrom(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(clientKeyFrom(new Headers({ "x-real-ip": "198.51.100.7", "x-forwarded-for": "1.1.1.1" }))).toBe("198.51.100.7");
    expect(clientKeyFrom(new Headers())).toBe("unknown");
  });
});
