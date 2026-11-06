import { describe, expect, it } from "vitest";
import { describeAuthError } from "@/modules/auth/auth-error";

describe("describeAuthError", () => {
  it("reports server failures as a server problem, not a user mistake", () => {
    expect(describeAuthError({ status: 500 }, "fallback")).toMatch(/server couldn't complete/);
    expect(describeAuthError({}, "fallback")).toMatch(/npm run doctor/);
  });
  it("explains origin mismatches", () => {
    expect(describeAuthError({ status: 403, message: "Invalid origin" }, "fallback")).toMatch(/APP_URL/);
  });
  it("handles rate limits", () => {
    expect(describeAuthError({ status: 429 }, "fallback")).toMatch(/Too many attempts/);
  });
  it("passes through Better Auth's own client error messages", () => {
    expect(describeAuthError({ status: 422, message: "User already exists. Use another email." }, "fallback")).toBe(
      "User already exists. Use another email.",
    );
    expect(describeAuthError({ status: 400 }, "fallback")).toBe("fallback");
  });
});
