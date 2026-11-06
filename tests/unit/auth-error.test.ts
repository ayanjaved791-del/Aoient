import { describe, expect, it } from "vitest";
import { describeAuthError } from "@/modules/auth/auth-error";

describe("describeAuthError (Supabase Auth)", () => {
  it("translates known Supabase error codes", () => {
    expect(describeAuthError({ status: 400, code: "invalid_credentials" }, "x")).toBe("Incorrect email or password.");
    expect(describeAuthError({ status: 400, code: "email_not_confirmed" }, "x")).toMatch(/Verify your email/);
    expect(describeAuthError({ status: 422, code: "user_already_exists" }, "x")).toMatch(/already exists/);
    expect(describeAuthError({ status: 429, code: "over_email_send_rate_limit" }, "x")).toMatch(/Too many emails/);
  });
  it("reports server failures as a service problem, not a user mistake", () => {
    expect(describeAuthError({ status: 500 }, "x")).toMatch(/sign-in service/);
    expect(describeAuthError({}, "x")).toMatch(/sign-in service/);
  });
  it("falls back to the message, then the fallback", () => {
    expect(describeAuthError({ status: 400, message: "Password should contain a number" }, "x")).toBe("Password should contain a number");
    expect(describeAuthError({ status: 400 }, "fallback")).toBe("fallback");
  });
});
