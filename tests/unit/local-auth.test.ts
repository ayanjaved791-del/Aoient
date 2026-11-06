import { beforeEach, describe, expect, it } from "vitest";
import {
  getLocalSessionUser,
  LocalAuthError,
  localSignIn,
  localSignOut,
  localSignUp,
  type KeyValueStore,
} from "@/lib/local-auth";

function memoryStore(): KeyValueStore & { dump(): string } {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    dump: () => [...m.values()].join("\n"),
  };
}

const alice = { name: "Alice Doe", email: "Alice@Example.com", password: "correct horse battery" };

describe("browser-only accounts", () => {
  let store: ReturnType<typeof memoryStore>;
  beforeEach(() => {
    store = memoryStore();
  });

  it("signs up, starts a session, and never stores the password in plain text", async () => {
    const user = await localSignUp(alice, store);
    expect(user.email).toBe("alice@example.com");
    expect(getLocalSessionUser(store)?.id).toBe(user.id);
    expect(store.dump()).not.toContain(alice.password);
  });

  it("rejects a duplicate email regardless of case", async () => {
    await localSignUp(alice, store);
    await expect(localSignUp({ ...alice, email: "ALICE@example.com" }, store)).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
  });

  it("signs in with the right password and rejects a wrong one or unknown email the same way", async () => {
    await localSignUp(alice, store);
    localSignOut(store);
    expect(getLocalSessionUser(store)).toBeNull();

    const wrong = await localSignIn({ email: alice.email, password: "wrong password!" }, store).catch((e) => e);
    const unknown = await localSignIn({ email: "bob@example.com", password: "whatever123" }, store).catch((e) => e);
    expect(wrong).toBeInstanceOf(LocalAuthError);
    expect(wrong.message).toBe(unknown.message);
    expect(getLocalSessionUser(store)).toBeNull();

    const user = await localSignIn({ email: " alice@example.com ", password: alice.password }, store);
    expect(getLocalSessionUser(store)?.id).toBe(user.id);
  });

  it("expires sessions after 7 days", async () => {
    const now = Date.UTC(2026, 0, 1);
    await localSignUp(alice, store, now);
    expect(getLocalSessionUser(store, now + 6 * 86_400_000)).not.toBeNull();
    expect(getLocalSessionUser(store, now + 7 * 86_400_000)).toBeNull();
  });

  it("treats corrupted storage as signed out", () => {
    store.setItem("aoient.local.session.v1", "{not json");
    expect(getLocalSessionUser(store)).toBeNull();
  });
});
